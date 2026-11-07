import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    writeFileSync: jest.fn(),
    copyFileSync: jest.fn(),
    unlinkSync: jest.fn(),
  };
});
import {
  decodeUploadFilename,
  InventoryAttachmentsService,
  isAllowedInventoryAttachment,
} from '../../../src/modules/inventory/inventory-attachments.service';
import {
  InventoryAttachmentsController,
  resolveRequestBaseUrl,
} from '../../../src/modules/inventory/inventory-attachments.controller';

// Browser/multer sends UTF-8 bytes that multer exposes as a latin1 string
const toMulterName = (name: string) => Buffer.from(name, 'utf8').toString('latin1');

const makeFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File =>
  ({
    fieldname: 'files',
    originalname: toMulterName('Hoá đơn nhập kho.pdf'),
    mimetype: 'application/pdf',
    size: 1234,
    buffer: Buffer.from('%PDF-1.4'),
    ...overrides,
  }) as Express.Multer.File;

describe('Inventory batch attachments (BE_requirement_26_09_26 §5)', () => {
  let prisma: any;
  let service: InventoryAttachmentsService;
  const writeSpy = fs.writeFileSync as unknown as jest.Mock;
  const existsSpy = fs.existsSync as unknown as jest.Mock;
  const unlinkSpy = fs.unlinkSync as unknown as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    existsSpy.mockReturnValue(true);

    prisma = {
      inventoryBatch: {
        findFirst: jest.fn().mockResolvedValue({ id: 'batch-1' }),
      },
      inventoryBatchAttachment: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'att-1',
            uploadedAt: new Date('2026-09-26T03:00:00.000Z'),
            archivedAt: null,
            ...data,
          }),
        ),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    service = new InventoryAttachmentsService(prisma);
  });

  describe('helpers', () => {
    it('decodes multer latin1 filenames to UTF-8 (Vietnamese) and leaves proper names alone', () => {
      expect(decodeUploadFilename(toMulterName('Hồ sơ lô hàng.xlsx'))).toBe('Hồ sơ lô hàng.xlsx');
      expect(decodeUploadFilename('Hồ sơ.pdf')).toBe('Hồ sơ.pdf');
      expect(decodeUploadFilename('invoice.pdf')).toBe('invoice.pdf');
    });

    it('accepts PDF / images / Excel / Word and rejects other types', () => {
      expect(isAllowedInventoryAttachment({ originalname: 'a.pdf', mimetype: 'application/pdf' })).toBe(true);
      expect(isAllowedInventoryAttachment({ originalname: 'a.jpg', mimetype: 'image/jpeg' })).toBe(true);
      expect(
        isAllowedInventoryAttachment({
          originalname: 'a.xlsx',
          mimetype: 'application/octet-stream',
        }),
      ).toBe(true);
      expect(
        isAllowedInventoryAttachment({
          originalname: 'a.docx',
          mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }),
      ).toBe(true);
      expect(isAllowedInventoryAttachment({ originalname: 'a.exe', mimetype: 'application/x-msdownload' })).toBe(false);
      expect(isAllowedInventoryAttachment({ originalname: 'a.svg', mimetype: 'image/svg+xml' })).toBe(false);
      expect(isAllowedInventoryAttachment({ originalname: 'a.html', mimetype: 'text/html' })).toBe(false);
    });

    it('builds the base URL from the request (proxy headers first), never a localhost env fallback', () => {
      const req: any = {
        headers: { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'mkt-hub.onrender.com' },
        protocol: 'http',
        get: () => 'internal:10000',
      };
      expect(resolveRequestBaseUrl(req)).toBe('https://mkt-hub.onrender.com');

      const prev = process.env.APP_URL;
      process.env.APP_URL = 'http://localhost:3000';
      try {
        expect(resolveRequestBaseUrl({ headers: {}, get: () => undefined } as any)).toBe('');
      } finally {
        if (prev === undefined) delete process.env.APP_URL;
        else process.env.APP_URL = prev;
      }
    });
  });

  describe('GET /batches/{batchId}/attachments', () => {
    it('404 when the batch does not exist or is archived', async () => {
      prisma.inventoryBatch.findFirst.mockResolvedValue(null);
      await expect(service.getBatchAttachments('missing')).rejects.toThrow(NotFoundException);
      expect(prisma.inventoryBatch.findFirst).toHaveBeenCalledWith({
        where: { id: 'missing', archivedAt: null },
        select: { id: true },
      });
    });

    it('returns non-archived attachments in the contract shape', async () => {
      prisma.inventoryBatchAttachment.findMany.mockResolvedValue([
        {
          id: 'att-1',
          batchId: 'batch-1',
          name: 'Hoá đơn.pdf',
          size: 10,
          mimeType: 'application/pdf',
          filePath: 'uploads/inventory-batches/x.pdf',
          uploadedBy: 'user-1',
          uploadedAt: new Date('2026-09-26T03:00:00.000Z'),
          archivedAt: null,
        },
      ]);

      const list = await service.getBatchAttachments('batch-1', 'https://api.example.com/');

      expect(prisma.inventoryBatchAttachment.findMany).toHaveBeenCalledWith({
        where: { batchId: 'batch-1', archivedAt: null },
        orderBy: { uploadedAt: 'desc' },
      });
      expect(list).toEqual([
        {
          id: 'att-1',
          batchId: 'batch-1',
          name: 'Hoá đơn.pdf',
          size: 10,
          mimeType: 'application/pdf',
          url: 'https://api.example.com/api/v1/inventory/attachments/att-1/file',
          uploadedBy: 'user-1',
          uploadedAt: new Date('2026-09-26T03:00:00.000Z'),
        },
      ]);
    });
  });

  describe('POST /batches/{batchId}/attachments', () => {
    it('404 when the batch does not exist', async () => {
      prisma.inventoryBatch.findFirst.mockResolvedValue(null);
      await expect(service.uploadBatchAttachments('missing', [makeFile()], 'user-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(writeSpy).not.toHaveBeenCalled();
    });

    it('400 when no file is sent', async () => {
      await expect(service.uploadBatchAttachments('batch-1', [], 'user-1')).rejects.toThrow(
        'Vui lòng chọn ít nhất một file để tải lên.',
      );
    });

    it('400 for an unsupported type, before writing any file', async () => {
      await expect(
        service.uploadBatchAttachments(
          'batch-1',
          [makeFile(), makeFile({ originalname: 'virus.exe', mimetype: 'application/x-msdownload' })],
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(writeSpy).not.toHaveBeenCalled();
      expect(prisma.inventoryBatchAttachment.create).not.toHaveBeenCalled();
    });

    it('400 for a file over 10MB', async () => {
      await expect(
        service.uploadBatchAttachments('batch-1', [makeFile({ size: 10 * 1024 * 1024 + 1 })], 'user-1'),
      ).rejects.toThrow('vượt quá dung lượng tối đa 10MB');
    });

    it('stores every file with its decoded UTF-8 name and returns the new attachments', async () => {
      const result = await service.uploadBatchAttachments(
        'batch-1',
        [makeFile(), makeFile({ originalname: 'anh.png', mimetype: 'image/png', size: 99 })],
        'user-1',
        '',
      );

      expect(writeSpy).toHaveBeenCalledTimes(2);
      const writtenPath: string = writeSpy.mock.calls[0][0];
      expect(path.dirname(writtenPath)).toBe(path.join(process.cwd(), 'uploads', 'inventory-batches'));
      expect(path.basename(writtenPath)).toMatch(/^\d+_[a-z0-9]+_Ho____n_nh_p_kho\.pdf$/);

      expect(prisma.inventoryBatchAttachment.create).toHaveBeenCalledTimes(2);
      const data = prisma.inventoryBatchAttachment.create.mock.calls[0][0].data;
      expect(data).toEqual({
        batchId: 'batch-1',
        name: 'Hoá đơn nhập kho.pdf',
        size: 1234,
        mimeType: 'application/pdf',
        filePath: `uploads/inventory-batches/${path.basename(writtenPath)}`,
        uploadedBy: 'user-1',
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'att-1',
        batchId: 'batch-1',
        name: 'Hoá đơn nhập kho.pdf',
        size: 1234,
        mimeType: 'application/pdf',
        url: '/api/v1/inventory/attachments/att-1/file',
        uploadedBy: 'user-1',
        uploadedAt: new Date('2026-09-26T03:00:00.000Z'),
      });
      expect(result[0]).not.toHaveProperty('filePath');
    });

    it('removes the written file when the DB row cannot be created', async () => {
      prisma.inventoryBatchAttachment.create.mockRejectedValueOnce(new Error('db down'));

      await expect(service.uploadBatchAttachments('batch-1', [makeFile()], 'user-1')).rejects.toThrow('db down');
      expect(unlinkSpy).toHaveBeenCalledWith(writeSpy.mock.calls[0][0]);
    });
  });

  describe('DELETE /attachments/{id}', () => {
    it('404 when missing or already archived', async () => {
      prisma.inventoryBatchAttachment.findFirst.mockResolvedValue(null);
      await expect(service.deleteAttachment('att-x')).rejects.toThrow(NotFoundException);
      expect(prisma.inventoryBatchAttachment.findFirst).toHaveBeenCalledWith({
        where: { id: 'att-x', archivedAt: null },
        select: { id: true },
      });
      expect(prisma.inventoryBatchAttachment.update).not.toHaveBeenCalled();
    });

    it('soft-deletes with a single-row update and returns { success: true }', async () => {
      prisma.inventoryBatchAttachment.findFirst.mockResolvedValue({ id: 'att-1' });

      await expect(service.deleteAttachment('att-1')).resolves.toEqual({ success: true });
      expect(prisma.inventoryBatchAttachment.update).toHaveBeenCalledWith({
        where: { id: 'att-1' },
        data: { archivedAt: expect.any(Date) },
      });
    });
  });

  describe('GET /attachments/{id}/file', () => {
    it('404 when the attachment or its batch is archived', async () => {
      prisma.inventoryBatchAttachment.findFirst.mockResolvedValueOnce(null);
      await expect(service.getAttachmentFile('att-1')).rejects.toThrow(NotFoundException);

      prisma.inventoryBatchAttachment.findFirst.mockResolvedValueOnce({
        id: 'att-1',
        filePath: 'uploads/inventory-batches/x.pdf',
        batch: { archivedAt: new Date() },
      });
      await expect(service.getAttachmentFile('att-1')).rejects.toThrow(NotFoundException);
    });

    it('404 when the physical file is gone', async () => {
      prisma.inventoryBatchAttachment.findFirst.mockResolvedValue({
        id: 'att-1',
        name: 'x.pdf',
        filePath: 'uploads/inventory-batches/x.pdf',
        batch: { archivedAt: null },
      });
      existsSpy.mockReturnValue(false);
      await expect(service.getAttachmentFile('att-1')).rejects.toThrow('File vật lý không tồn tại');
    });

    it('controller streams the file with a UTF-8 Content-Disposition', async () => {
      prisma.inventoryBatchAttachment.findFirst.mockResolvedValue({
        id: 'att-1',
        name: 'Hoá đơn.pdf',
        mimeType: 'application/pdf',
        filePath: 'uploads/inventory-batches/x.pdf',
        batch: { archivedAt: null },
      });
      const controller = new InventoryAttachmentsController(service);
      const res: any = { setHeader: jest.fn(), sendFile: jest.fn() };

      await controller.getAttachmentFile('att-1', res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        `inline; filename="Hoa don.pdf"; filename*=UTF-8''${encodeURIComponent('Hoá đơn.pdf')}`,
      );
      expect(res.sendFile).toHaveBeenCalledWith(path.join(process.cwd(), 'uploads/inventory-batches/x.pdf'));
    });

    it('controller wraps list/upload/delete results in { data }', async () => {
      prisma.inventoryBatchAttachment.findFirst.mockResolvedValue({ id: 'att-1' });
      const controller = new InventoryAttachmentsController(service);
      const req: any = { headers: {}, protocol: 'https', get: () => 'mkt-hub.onrender.com' };

      await expect(controller.deleteAttachment('att-1')).resolves.toEqual({ data: { success: true } });
      await expect(controller.getBatchAttachments('batch-1', req)).resolves.toEqual({ data: [] });
      const uploaded = await controller.uploadBatchAttachments('batch-1', [makeFile()], { id: 'u-1' } as any, req);
      expect(uploaded.data[0].url).toBe('https://mkt-hub.onrender.com/api/v1/inventory/attachments/att-1/file');
    });
  });
});
