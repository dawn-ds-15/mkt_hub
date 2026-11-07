import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ExpenseAttachmentsService,
  formatExpenseLineAttachment,
  linkAttachmentsToLine,
  parseDocsAttachmentName,
  syncLineLegacyAttachments,
} from '../../../src/modules/expense/expense-attachments.service';
import { fileStorage } from '../../../src/common/storage/file-storage';

/** Minimal in-memory ExpenseLineAttachment table (findMany / findFirst / create / update). */
function attachmentTable(initial: any[] = []) {
  const rows = initial.map((r) => ({
    archivedAt: null,
    sourceDocumentId: null,
    ...r,
  }));
  let seq = 0;
  const matches = (row: any, where: any = {}) =>
    Object.entries(where).every(([key, cond]: [string, any]) => {
      if (cond && typeof cond === 'object' && 'in' in cond)
        return cond.in.includes(row[key]);
      return row[key] === cond;
    });
  return {
    rows,
    findMany: jest.fn(async ({ where }: any = {}) =>
      rows.filter((r) => matches(r, where)),
    ),
    findFirst: jest.fn(
      async ({ where }: any = {}) =>
        rows.find((r) => matches(r, where)) ?? null,
    ),
    create: jest.fn(async ({ data }: any) => {
      const row = {
        id: `new-${++seq}`,
        archivedAt: null,
        sourceDocumentId: null,
        uploadedAt: new Date('2026-09-29'),
        ...data,
      };
      rows.push(row);
      return row;
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const row = rows.find((r) => r.id === where.id);
      Object.assign(row, data);
      return row;
    }),
  };
}

describe('Expense line attachments (BE_requirement_29_09_26 §1)', () => {
  describe('helpers', () => {
    it('parses the FE workaround docs:<id>,<id>', () => {
      expect(parseDocsAttachmentName('docs:a, b,,a')).toEqual(['a', 'b']);
      expect(parseDocsAttachmentName('hoa-don.pdf')).toEqual([]);
      expect(parseDocsAttachmentName(null)).toEqual([]);
    });

    it('formats { id, lineId, name, size, mimeType, url, uploadedBy, uploadedAt }', () => {
      const at = new Date('2026-09-29');
      expect(
        formatExpenseLineAttachment(
          {
            id: 'a1',
            lineId: 'l1',
            name: 'HĐ.pdf',
            size: 10,
            mimeType: 'application/pdf',
            filePath: 'x',
            uploadedBy: 'u1',
            uploadedAt: at,
          },
          'https://api.test/',
        ),
      ).toEqual({
        id: 'a1',
        lineId: 'l1',
        name: 'HĐ.pdf',
        size: 10,
        mimeType: 'application/pdf',
        url: 'https://api.test/api/v1/expenses/attachments/a1/file',
        uploadedBy: 'u1',
        uploadedAt: at,
      });
    });
  });

  describe('linkAttachmentsToLine (attachmentIds of a new snapshot)', () => {
    it('adds rows pointing to the same stored files, skipping unknown / removed / duplicate files', async () => {
      const table = attachmentTable([
        {
          id: 'a1',
          lineId: 'old',
          name: 'a.pdf',
          size: 5,
          mimeType: 'application/pdf',
          filePath: 'uploads/expenses/a.pdf',
          uploadedBy: 'u1',
          uploadedAt: new Date('2026-09-01'),
        },
        {
          id: 'a2',
          lineId: 'old',
          name: 'b.png',
          size: 7,
          mimeType: 'image/png',
          filePath: 'supabase://bucket/expenses/b.png',
        },
        {
          id: 'a3',
          lineId: 'old',
          name: 'gone.pdf',
          size: 1,
          filePath: 'uploads/expenses/gone.pdf',
          archivedAt: new Date(),
        },
        {
          id: 'a4',
          lineId: 'other',
          name: 'a-copy.pdf',
          size: 5,
          filePath: 'uploads/expenses/a.pdf',
        },
      ]);
      const client = { expenseLineAttachment: table };

      const linked = await linkAttachmentsToLine(client, 'new', [
        'a1',
        'a2',
        'a3',
        'a4',
        'missing',
        'a1',
      ]);

      expect(linked).toBe(2);
      const added = table.rows.filter((r) => r.lineId === 'new');
      expect(added.map((r) => r.filePath)).toEqual([
        'uploads/expenses/a.pdf',
        'supabase://bucket/expenses/b.png',
      ]);
      expect(added[0]).toMatchObject({
        name: 'a.pdf',
        size: 5,
        uploadedBy: 'u1',
        uploadedAt: new Date('2026-09-01'),
      });
      // the old line keeps its files
      expect(
        table.rows.filter((r) => r.lineId === 'old' && !r.archivedAt),
      ).toHaveLength(2);
    });

    it('does nothing without ids or without the attachment table', async () => {
      expect(await linkAttachmentsToLine({}, 'l', ['a'])).toBe(0);
      const table = attachmentTable();
      expect(
        await linkAttachmentsToLine({ expenseLineAttachment: table }, 'l', []),
      ).toBe(0);
      expect(table.findMany).not.toHaveBeenCalled();
    });
  });

  describe('syncLineLegacyAttachments (older ways of attaching a file)', () => {
    const lines: Record<string, any> = {
      single: {
        id: 'single',
        attachmentPath: 'uploads/expenses/1.pdf',
        attachmentName: 'Hóa đơn.pdf',
        attachmentMime: 'application/pdf',
        attachmentUrl: null,
      },
      shared: {
        id: 'shared',
        attachmentPath: null,
        attachmentName: null,
        attachmentUrl:
          'https://x/api/v1/expenses/lines/11111111-1111-4111-8111-111111111111/attachment',
      },
      source: {
        id: '11111111-1111-4111-8111-111111111111',
        attachmentPath: 'uploads/expenses/src.pdf',
        attachmentName: 'src.pdf',
        attachmentMime: 'application/pdf',
      },
      docs: {
        id: 'docs',
        attachmentPath: null,
        attachmentName: 'docs:d1,d2,d-archived',
        attachmentUrl: null,
      },
    };
    const client = (table: any) => ({
      expenseLineAttachment: table,
      expenseLine: {
        findFirst: jest.fn(async ({ where }: any) => {
          const line =
            lines[where.id] ||
            Object.values(lines).find((l: any) => l.id === where.id);
          if (!line) return null;
          if (where.attachmentPath && !line.attachmentPath) return null;
          return line;
        }),
      },
      projectDocument: {
        findMany: jest.fn(async ({ where }: any) =>
          [
            {
              id: 'd1',
              name: 'Hợp đồng.pdf',
              size: 100,
              mimeType: 'application/pdf',
              filePath: 'uploads/documents/d1.pdf',
              uploadedBy: 'u2',
              uploadedAt: new Date('2026-09-20'),
            },
            {
              id: 'd2',
              name: 'Ảnh.png',
              size: 50,
              mimeType: 'image/png',
              filePath: 'uploads/documents/d2.png',
            },
          ].filter((d) => where.id.in.includes(d.id)),
        ),
      },
    });

    it('lists the single file of a line once', async () => {
      const table = attachmentTable();
      const c = client(table);
      expect(await syncLineLegacyAttachments(c, 'single')).toBe(1);
      expect(await syncLineLegacyAttachments(c, 'single')).toBe(0);
      expect(table.rows[0]).toMatchObject({
        lineId: 'single',
        name: 'Hóa đơn.pdf',
        filePath: 'uploads/expenses/1.pdf',
        size: 0,
      });
    });

    it('lists a file shared through attachmentUrl', async () => {
      const table = attachmentTable();
      expect(await syncLineLegacyAttachments(client(table), 'shared')).toBe(1);
      expect(table.rows[0]).toMatchObject({
        lineId: 'shared',
        name: 'src.pdf',
        filePath: 'uploads/expenses/src.pdf',
      });
    });

    it('lists project documents of docs:<id>,<id> (skipping deleted documents)', async () => {
      const table = attachmentTable();
      expect(await syncLineLegacyAttachments(client(table), 'docs')).toBe(2);
      expect(
        table.rows.map((r) => [r.sourceDocumentId, r.name, r.size]),
      ).toEqual([
        ['d1', 'Hợp đồng.pdf', 100],
        ['d2', 'Ảnh.png', 50],
      ]);
    });

    it('never re-adds a file the user removed', async () => {
      const table = attachmentTable([
        {
          id: 'x',
          lineId: 'single',
          name: 'Hóa đơn.pdf',
          filePath: 'uploads/expenses/1.pdf',
          archivedAt: new Date(),
        },
        {
          id: 'y',
          lineId: 'docs',
          name: 'Hợp đồng.pdf',
          filePath: 'uploads/documents/d1.pdf',
          sourceDocumentId: 'd1',
          archivedAt: new Date(),
        },
      ]);
      const c = client(table);
      expect(await syncLineLegacyAttachments(c, 'single')).toBe(0);
      expect(await syncLineLegacyAttachments(c, 'docs')).toBe(1); // only d2
    });
  });

  describe('ExpenseAttachmentsService', () => {
    let table: ReturnType<typeof attachmentTable>;
    let prisma: any;
    let service: ExpenseAttachmentsService;

    beforeEach(() => {
      table = attachmentTable([
        {
          id: 'a1',
          lineId: 'l1',
          name: 'one.pdf',
          size: 1,
          filePath: 'uploads/expenses/one.pdf',
          uploadedAt: new Date('2026-09-01'),
        },
      ]);
      prisma = {
        expenseLineAttachment: table,
        expenseLine: {
          findFirst: jest.fn(async ({ where }: any) =>
            where.id === 'l1'
              ? { id: 'l1', expense: { archivedAt: null } }
              : null,
          ),
          update: jest.fn(),
        },
        $transaction: jest.fn((cb: any) => cb(prisma)),
      };
      service = new ExpenseAttachmentsService(prisma);
    });

    afterEach(() => jest.restoreAllMocks());

    it('GET returns the active files of the line; 404 for an unknown line', async () => {
      const list = await service.getLineAttachments('l1', 'https://api.test');
      expect(list).toHaveLength(1);
      expect(list[0].url).toBe(
        'https://api.test/api/v1/expenses/attachments/a1/file',
      );
      await expect(service.getLineAttachments('nope')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('POST stores several files and returns them', async () => {
      const save = jest
        .spyOn(fileStorage, 'save')
        .mockImplementation(async (_f, name) => `uploads/expenses/${name}`);
      const files: any[] = [
        {
          originalname: Buffer.from('Hóa đơn.pdf', 'utf8').toString('latin1'),
          mimetype: 'application/pdf',
          size: 20,
          buffer: Buffer.from('a'),
        },
        {
          originalname: 'bang-ke.xlsx',
          mimetype: 'application/octet-stream',
          size: 30,
          buffer: Buffer.from('b'),
        },
      ];
      const created = await service.uploadLineAttachments(
        'l1',
        files,
        'u1',
        '',
      );
      expect(save).toHaveBeenCalledTimes(2);
      expect(
        created.map((a) => [a.name, a.size, a.lineId, a.uploadedBy]),
      ).toEqual([
        ['Hóa đơn.pdf', 20, 'l1', 'u1'],
        ['bang-ke.xlsx', 30, 'l1', 'u1'],
      ]);
      expect(await service.getLineAttachments('l1')).toHaveLength(3);
    });

    it('POST validates every file before storing anything', async () => {
      const save = jest.spyOn(fileStorage, 'save');
      const ok = {
        originalname: 'a.pdf',
        mimetype: 'application/pdf',
        size: 1,
        buffer: Buffer.from('a'),
      };
      await expect(
        service.uploadLineAttachments(
          'l1',
          [
            ok,
            {
              originalname: 'x.exe',
              mimetype: 'application/x-msdownload',
              size: 1,
              buffer: Buffer.from('x'),
            },
          ] as any,
          'u1',
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.uploadLineAttachments(
          'l1',
          [ok, { ...ok, size: 11 * 1024 * 1024 }] as any,
          'u1',
        ),
      ).rejects.toThrow('10MB');
      await expect(
        service.uploadLineAttachments('l1', [], 'u1'),
      ).rejects.toThrow(BadRequestException);
      expect(save).not.toHaveBeenCalled();
    });

    it('DELETE archives the row and clears the older fields that pointed to the same file', async () => {
      table.rows.push(
        {
          id: 'legacy',
          lineId: 'l2',
          name: 'old.pdf',
          filePath: 'uploads/expenses/old.pdf',
          archivedAt: null,
          sourceDocumentId: null,
        },
        {
          id: 'doc',
          lineId: 'l2',
          name: 'HĐ.pdf',
          filePath: 'uploads/documents/d1.pdf',
          archivedAt: null,
          sourceDocumentId: 'd1',
        },
      );
      const line = {
        id: 'l2',
        attachmentPath: 'uploads/expenses/old.pdf',
        attachmentName: 'docs:d1,d2',
        attachmentUrl: 'u',
      };
      table.findFirst.mockImplementation(async ({ where }: any) => {
        const row = table.rows.find((r) => r.id === where.id && !r.archivedAt);
        return row ? { ...row, line } : null;
      });

      expect(await service.deleteAttachment('doc')).toEqual({ success: true });
      expect(table.rows.find((r) => r.id === 'doc')!.archivedAt).toBeInstanceOf(
        Date,
      );
      // project document: only its id leaves the docs: list
      expect(prisma.expenseLine.update).toHaveBeenLastCalledWith({
        where: { id: 'l2' },
        data: { attachmentName: 'docs:d2' },
      });
      await expect(service.deleteAttachment('doc')).rejects.toThrow(
        NotFoundException,
      );

      // old single file: the line no longer points to it
      await service.deleteAttachment('legacy');
      expect(prisma.expenseLine.update).toHaveBeenLastCalledWith({
        where: { id: 'l2' },
        data: {
          attachmentPath: null,
          attachmentMime: null,
          attachmentUrl: null,
        },
      });
    });

    it('GET file streams the stored file; 404 when removed or the line is deleted', async () => {
      jest
        .spyOn(fileStorage, 'read')
        .mockResolvedValue({ buffer: Buffer.from('pdf') });
      table.findFirst.mockImplementation(async ({ where }: any) => {
        const row = table.rows.find((r) => r.id === where.id && !r.archivedAt);
        return row
          ? {
              ...row,
              line: { archivedAt: null, expense: { archivedAt: null } },
            }
          : null;
      });
      const file = await service.getAttachmentFile('a1');
      expect(file).toMatchObject({
        fileName: 'one.pdf',
        mimeType: 'application/octet-stream',
      });
      expect(file.buffer!.toString()).toBe('pdf');

      table.findFirst.mockResolvedValueOnce({
        ...table.rows[0],
        line: { archivedAt: new Date() },
      });
      await expect(service.getAttachmentFile('a1')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getAttachmentFile('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
