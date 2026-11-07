import { fileStorage, readUploadedFile } from '../../common/storage/file-storage';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ATTACHMENT_MAX_FILES,
  ATTACHMENT_MAX_FILE_SIZE,
  buildStoredFileName,
  decodeUploadFilename,
  isAllowedAttachment,
} from '../../common/storage/attachment-upload';

export { decodeUploadFilename };

/** Max size of one batch attachment (BE_requirement_26_09_26 §5: ~10MB per file). */
export const INVENTORY_ATTACHMENT_MAX_FILE_SIZE = ATTACHMENT_MAX_FILE_SIZE;
/** Max number of files accepted in one upload request. */
export const INVENTORY_ATTACHMENT_MAX_FILES = ATTACHMENT_MAX_FILES;

export const isAllowedInventoryAttachment = isAllowedAttachment;

@Injectable()
export class InventoryAttachmentsService {
  static readonly RELATIVE_UPLOAD_DIR = 'uploads/inventory-batches';

  private readonly uploadDir: string;

  constructor(private readonly prisma: PrismaService) {
    this.uploadDir = path.join(process.cwd(), 'uploads', 'inventory-batches');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Public shape: { id, batchId, name, size, mimeType, url, uploadedBy, uploadedAt }.
   * `url` is absolute when the request base URL is known, otherwise relative to the API host.
   */
  formatAttachment(attachment: any, baseUrl?: string) {
    if (!attachment) return attachment;
    const base = (baseUrl || '').replace(/\/+$/, '');
    return {
      id: attachment.id,
      batchId: attachment.batchId,
      name: attachment.name,
      size: Number(attachment.size ?? 0),
      mimeType: attachment.mimeType ?? null,
      url: `${base}/api/v1/inventory/attachments/${attachment.id}/file`,
      uploadedBy: attachment.uploadedBy ?? null,
      uploadedAt: attachment.uploadedAt,
    };
  }

  private async ensureBatchExists(batchId: string) {
    const batch = await this.prisma.inventoryBatch.findFirst({
      where: { id: batchId, archivedAt: null },
      select: { id: true },
    });
    if (!batch) {
      throw new NotFoundException('Không tìm thấy batch.');
    }
    return batch;
  }

  // GET /v1/inventory/batches/{batchId}/attachments
  async getBatchAttachments(batchId: string, baseUrl?: string) {
    const [batchResult, attachmentsResult] = await Promise.allSettled([
      this.ensureBatchExists(batchId),
      this.prisma.inventoryBatchAttachment.findMany({
        where: { batchId, archivedAt: null },
        orderBy: { uploadedAt: 'desc' },
      }),
    ]);
    // Evaluate in order so a missing batch always yields 404 first
    if (batchResult.status === 'rejected') throw batchResult.reason;
    if (attachmentsResult.status === 'rejected') throw attachmentsResult.reason;

    return attachmentsResult.value.map((a) => this.formatAttachment(a, baseUrl));
  }

  // POST /v1/inventory/batches/{batchId}/attachments
  async uploadBatchAttachments(
    batchId: string,
    files: Express.Multer.File[] | undefined,
    userId?: string,
    baseUrl?: string,
  ) {
    await this.ensureBatchExists(batchId);

    if (!files || files.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất một file để tải lên.');
    }

    // Validate every file before writing anything
    for (const file of files) {
      const name = decodeUploadFilename(file.originalname);
      if (!isAllowedInventoryAttachment(file)) {
        throw new BadRequestException(
          `File "${name}" không đúng định dạng. Chỉ nhận PDF, ảnh, Excel hoặc Word.`,
        );
      }
      if ((file.size ?? 0) > INVENTORY_ATTACHMENT_MAX_FILE_SIZE) {
        throw new BadRequestException(`File "${name}" vượt quá dung lượng tối đa 10MB.`);
      }
      if (!file.buffer && !file.path) {
        throw new BadRequestException(`File "${name}" không có nội dung.`);
      }
    }

    const created: any[] = [];
    for (const file of files) {
      const originalName = decodeUploadFilename(file.originalname);
      const uniqueFilename = buildStoredFileName(originalName);

      // Local uploads/ dir or Supabase Storage (see common/storage/file-storage.ts)
      const storedPath = await fileStorage.save(
        'inventory-batches',
        uniqueFilename,
        readUploadedFile(file),
        file.mimetype,
      );

      try {
        const attachment = await this.prisma.inventoryBatchAttachment.create({
          data: {
            batchId,
            name: originalName,
            size: file.size ?? (file.buffer ? file.buffer.length : 0),
            mimeType: file.mimetype || null,
            filePath: storedPath,
            uploadedBy: userId ?? null,
          },
        });
        created.push(this.formatAttachment(attachment, baseUrl));
      } catch (error) {
        // Don't leave an orphaned file behind when the row could not be saved
        await fileStorage.remove(storedPath);
        throw error;
      }
    }

    return created;
  }

  // DELETE /v1/inventory/attachments/{id}
  async deleteAttachment(id: string) {
    const attachment = await this.prisma.inventoryBatchAttachment.findFirst({
      where: { id, archivedAt: null },
      select: { id: true },
    });
    if (!attachment) {
      throw new NotFoundException('Không tìm thấy hồ sơ đính kèm.');
    }

    await this.prisma.inventoryBatchAttachment.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    return { success: true };
  }

  // GET /v1/inventory/attachments/{id}/file
  async getAttachmentFile(id: string) {
    const attachment = await this.prisma.inventoryBatchAttachment.findFirst({
      where: { id, archivedAt: null },
      include: { batch: { select: { archivedAt: true } } },
    });

    if (!attachment || attachment.batch?.archivedAt) {
      throw new NotFoundException('Không tìm thấy hồ sơ đính kèm hoặc hồ sơ đã bị xóa.');
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
