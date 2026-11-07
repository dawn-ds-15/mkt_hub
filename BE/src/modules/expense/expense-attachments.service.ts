import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  fileStorage,
  readUploadedFile,
} from '../../common/storage/file-storage';
import {
  ATTACHMENT_MAX_FILE_SIZE,
  buildStoredFileName,
  decodeUploadFilename,
  isAllowedAttachment,
} from '../../common/storage/attachment-upload';

/**
 * Files of an expense line (BE_requirement_29_09_26 §1).
 *
 * Every "Lưu chi phí" creates a new snapshot (record + lines). The files of a line are carried
 * over with `attachmentIds`: a new row is added for the new line pointing to the same stored
 * file, so older snapshots keep their own list and nothing is copied in storage.
 *
 * Older ways of attaching a file are listed too (see PrismaService.syncLegacyExpenseLineAttachments):
 * the single file of a line (attachmentPath), a file shared through attachmentUrl, and project
 * documents referenced by the FE workaround `attachmentName = "docs:<id>,<id>"`.
 */

const DOCS_PREFIX = 'docs:';
const SHARED_LINE_URL =
  /\/expenses\/lines\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/attachment/i;

/** Project document ids of the FE workaround `docs:<id>,<id>` (empty for any other value). */
export function parseDocsAttachmentName(name?: string | null): string[] {
  if (!name || !name.startsWith(DOCS_PREFIX)) return [];
  const ids = name
    .slice(DOCS_PREFIX.length)
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  return Array.from(new Set(ids));
}

/** Public shape: { id, lineId, name, size, mimeType, url, uploadedBy, uploadedAt }. */
export function formatExpenseLineAttachment(attachment: any, baseUrl?: string) {
  const base = (baseUrl || '').replace(/\/+$/, '');
  return {
    id: attachment.id,
    lineId: attachment.lineId,
    name: attachment.name,
    size: Number(attachment.size ?? 0),
    mimeType: attachment.mimeType ?? null,
    url: `${base}/api/v1/expenses/attachments/${attachment.id}/file`,
    uploadedBy: attachment.uploadedBy ?? null,
    uploadedAt: attachment.uploadedAt,
  };
}

const hasAttachmentTable = (client: any) =>
  !!client?.expenseLineAttachment?.findMany &&
  !!client?.expenseLineAttachment?.create;

/** Active attachments of the given lines, oldest first. */
export async function loadLineAttachments(
  client: any,
  lineIds: string[],
): Promise<any[]> {
  if (!hasAttachmentTable(client) || lineIds.length === 0) return [];
  const rows = await client.expenseLineAttachment.findMany({
    where: { lineId: { in: lineIds }, archivedAt: null },
    orderBy: [{ uploadedAt: 'asc' }, { id: 'asc' }],
  });
  return Array.isArray(rows) ? rows : [];
}

/**
 * Re-attaches existing files (by attachment id, from any line) to `lineId`.
 * Unknown / removed ids and files the line already has are skipped.
 */
export async function linkAttachmentsToLine(
  client: any,
  lineId: string,
  attachmentIds: string[] | undefined | null,
): Promise<number> {
  const ids = Array.from(
    new Set(
      (attachmentIds || [])
        .filter((id) => typeof id === 'string' && id.trim())
        .map((id) => id.trim()),
    ),
  );
  if (ids.length === 0 || !hasAttachmentTable(client)) return 0;

  const [sources, existing] = await Promise.all([
    client.expenseLineAttachment.findMany({
      where: { id: { in: ids }, archivedAt: null },
    }),
    client.expenseLineAttachment.findMany({
      where: { lineId, archivedAt: null },
      select: { filePath: true },
    }),
  ]);
  const present = new Set<string>((existing || []).map((a: any) => a.filePath));
  const byId = new Map<string, any>((sources || []).map((a: any) => [a.id, a]));

  let linked = 0;
  for (const id of ids) {
    const source = byId.get(id);
    if (!source || present.has(source.filePath)) continue;
    await client.expenseLineAttachment.create({
      data: {
        lineId,
        name: source.name,
        size: source.size ?? 0,
        mimeType: source.mimeType ?? null,
        filePath: source.filePath,
        sourceDocumentId: source.sourceDocumentId ?? null,
        uploadedBy: source.uploadedBy ?? null,
        uploadedAt: source.uploadedAt ?? undefined,
      },
    });
    present.add(source.filePath);
    linked++;
  }
  return linked;
}

/**
 * Lists the files a line got through the older fields (attachmentPath, shared attachmentUrl,
 * `docs:` ids) as attachment rows. A file the line already has a row for, including one the
 * user removed, is never added again.
 */
export async function syncLineLegacyAttachments(
  client: any,
  lineId: string,
): Promise<number> {
  if (!hasAttachmentTable(client) || !client?.expenseLine?.findFirst) return 0;
  const line = await client.expenseLine.findFirst({
    where: { id: lineId },
    select: {
      id: true,
      attachmentPath: true,
      attachmentName: true,
      attachmentMime: true,
      attachmentUrl: true,
    },
  });
  if (!line) return 0;

  const existing: any[] =
    (await client.expenseLineAttachment.findMany({
      where: { lineId },
      select: { filePath: true, sourceDocumentId: true },
    })) || [];
  const knownPaths = new Set(existing.map((a) => a.filePath));
  const knownDocs = new Set(
    existing.map((a) => a.sourceDocumentId).filter(Boolean),
  );
  const docIds = parseDocsAttachmentName(line.attachmentName);
  const toCreate: any[] = [];

  if (line.attachmentPath) {
    if (!knownPaths.has(line.attachmentPath)) {
      toCreate.push({
        name:
          docIds.length === 0 && line.attachmentName
            ? line.attachmentName
            : 'attachment',
        mimeType: line.attachmentMime ?? null,
        filePath: line.attachmentPath,
      });
    }
  } else if (line.attachmentUrl) {
    const match = String(line.attachmentUrl).match(SHARED_LINE_URL);
    if (match && match[1] !== line.id) {
      const source = await client.expenseLine.findFirst({
        where: { id: match[1], attachmentPath: { not: null } },
        select: {
          attachmentPath: true,
          attachmentName: true,
          attachmentMime: true,
        },
      });
      if (source?.attachmentPath && !knownPaths.has(source.attachmentPath)) {
        toCreate.push({
          name: source.attachmentName || 'attachment',
          mimeType: source.attachmentMime ?? null,
          filePath: source.attachmentPath,
        });
      }
    }
  }

  const missingDocIds = docIds.filter((id) => !knownDocs.has(id));
  if (missingDocIds.length > 0 && client.projectDocument?.findMany) {
    const docs: any[] =
      (await client.projectDocument.findMany({
        where: { id: { in: missingDocIds }, archivedAt: null },
      })) || [];
    const docById = new Map(docs.map((d) => [d.id, d]));
    for (const id of missingDocIds) {
      const doc = docById.get(id);
      if (!doc) continue;
      toCreate.push({
        name: doc.name,
        size: doc.size ?? 0,
        mimeType: doc.mimeType ?? null,
        filePath: doc.filePath,
        sourceDocumentId: doc.id,
        uploadedBy: doc.uploadedBy ?? null,
        uploadedAt: doc.uploadedAt ?? undefined,
      });
    }
  }

  for (const data of toCreate) {
    await client.expenseLineAttachment.create({
      data: { size: 0, ...data, lineId },
    });
  }
  return toCreate.length;
}

@Injectable()
export class ExpenseAttachmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureLineExists(lineId: string) {
    const line = await this.prisma.expenseLine.findFirst({
      where: { id: lineId, archivedAt: null },
      select: { id: true, expense: { select: { archivedAt: true } } },
    });
    if (!line || line.expense?.archivedAt) {
      throw new NotFoundException('Không tìm thấy dòng chi phí.');
    }
    return line;
  }

  // GET /v1/expenses/lines/{lineId}/attachments
  async getLineAttachments(lineId: string, baseUrl?: string) {
    await this.ensureLineExists(lineId);
    const rows = await loadLineAttachments(this.prisma, [lineId]);
    return rows.map((a) => formatExpenseLineAttachment(a, baseUrl));
  }

  // POST /v1/expenses/lines/{lineId}/attachments
  async uploadLineAttachments(
    lineId: string,
    files: Express.Multer.File[] | undefined,
    userId?: string,
    baseUrl?: string,
  ) {
    await this.ensureLineExists(lineId);

    if (!files || files.length === 0) {
      throw new BadRequestException(
        'Vui lòng chọn ít nhất một file để tải lên.',
      );
    }

    // Validate every file before writing anything
    for (const file of files) {
      const name = decodeUploadFilename(file.originalname);
      if (!isAllowedAttachment(file)) {
        throw new BadRequestException(
          `File "${name}" không đúng định dạng. Chỉ nhận PDF, ảnh, Excel hoặc Word.`,
        );
      }
      if ((file.size ?? 0) > ATTACHMENT_MAX_FILE_SIZE) {
        throw new BadRequestException(
          `File "${name}" vượt quá dung lượng tối đa 10MB.`,
        );
      }
      if (!file.buffer && !file.path) {
        throw new BadRequestException(`File "${name}" không có nội dung.`);
      }
    }

    const created: any[] = [];
    for (const file of files) {
      const originalName = decodeUploadFilename(file.originalname);
      // Local uploads/ dir or Supabase Storage (see common/storage/file-storage.ts)
      const storedPath = await fileStorage.save(
        'expenses',
        buildStoredFileName(originalName),
        readUploadedFile(file),
        file.mimetype,
      );

      try {
        const attachment = await this.prisma.expenseLineAttachment.create({
          data: {
            lineId,
            name: originalName,
            size: file.size ?? (file.buffer ? file.buffer.length : 0),
            mimeType: file.mimetype || null,
            filePath: storedPath,
            uploadedBy: userId ?? null,
          },
        });
        created.push(formatExpenseLineAttachment(attachment, baseUrl));
      } catch (error) {
        // Don't leave an orphaned file behind when the row could not be saved
        await fileStorage.remove(storedPath);
        throw error;
      }
    }

    return created;
  }

  // DELETE /v1/expenses/attachments/{id}
  async deleteAttachment(id: string) {
    const attachment = await this.prisma.expenseLineAttachment.findFirst({
      where: { id, archivedAt: null },
      include: {
        line: {
          select: {
            id: true,
            attachmentPath: true,
            attachmentName: true,
            attachmentUrl: true,
          },
        },
      },
    });
    if (!attachment) {
      throw new NotFoundException('Không tìm thấy hồ sơ đính kèm.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.expenseLineAttachment.update({
        where: { id },
        data: { archivedAt: new Date() },
      });

      // Keep the older fields of the line in step, so the removed file does not come back
      // through them (e.g. when the FE copies them into the next snapshot)
      const line = attachment.line;
      if (!line) return;
      const lineUpdate: any = {};
      const docIds = parseDocsAttachmentName(line.attachmentName);
      if (line.attachmentPath && line.attachmentPath === attachment.filePath) {
        lineUpdate.attachmentPath = null;
        lineUpdate.attachmentMime = null;
        lineUpdate.attachmentUrl = null;
        if (docIds.length === 0) lineUpdate.attachmentName = null;
      } else if (
        !line.attachmentPath &&
        line.attachmentUrl &&
        SHARED_LINE_URL.test(line.attachmentUrl)
      ) {
        const sourceId = String(line.attachmentUrl).match(SHARED_LINE_URL)?.[1];
        const source = sourceId
          ? await tx.expenseLine.findFirst({
              where: { id: sourceId },
              select: { attachmentPath: true },
            })
          : null;
        if (source?.attachmentPath === attachment.filePath) {
          lineUpdate.attachmentUrl = null;
          if (docIds.length === 0) lineUpdate.attachmentName = null;
        }
      }
      if (
        attachment.sourceDocumentId &&
        docIds.includes(attachment.sourceDocumentId)
      ) {
        const rest = docIds.filter(
          (docId) => docId !== attachment.sourceDocumentId,
        );
        lineUpdate.attachmentName =
          rest.length > 0 ? `${DOCS_PREFIX}${rest.join(',')}` : null;
      }
      if (Object.keys(lineUpdate).length > 0) {
        await tx.expenseLine.update({
          where: { id: line.id },
          data: lineUpdate,
        });
      }
    });

    return { success: true };
  }

  // GET /v1/expenses/attachments/{id}/file
  async getAttachmentFile(id: string) {
    const attachment = await this.prisma.expenseLineAttachment.findFirst({
      where: { id, archivedAt: null },
      include: {
        line: {
          select: {
            archivedAt: true,
            expense: { select: { archivedAt: true } },
          },
        },
      },
    });

    if (
      !attachment ||
      attachment.line?.archivedAt ||
      attachment.line?.expense?.archivedAt
    ) {
      throw new NotFoundException(
        'Không tìm thấy hồ sơ đính kèm hoặc hồ sơ đã bị xóa.',
      );
    }

    const stored = await fileStorage.read(attachment.filePath);
    if (!stored) {
      throw new NotFoundException('File vật lý không tồn tại trên hệ thống.');
    }

    return {
      filePath: stored.localPath,
      buffer: stored.buffer,
      fileName: attachment.name,
      mimeType: attachment.mimeType || 'application/octet-stream',
    };
  }
}
