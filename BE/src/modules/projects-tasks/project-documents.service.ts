import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { fileStorage, readUploadedFile } from '../../common/storage/file-storage';
import { UpdateProjectDocumentDto } from './dto/project-document.dto';

@Injectable()
export class ProjectDocumentsService {
  private readonly uploadDir: string;

  constructor(private readonly prisma: PrismaService) {
    this.uploadDir = path.join(process.cwd(), 'uploads', 'documents');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  formatDocument(doc: any, baseUrl?: string) {
    if (!doc) return doc;
    const base = (
      baseUrl ||
      process.env.APP_URL ||
      process.env.BACKEND_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      'http://localhost:3000'
    ).replace(/\/+$/, '');
    const absoluteUrl = `${base}/api/v1/projects/documents/${doc.id}/file`;
    return {
      ...doc,
      url: absoluteUrl,
    };
  }

  async getProjectDocuments(projectId: string, baseUrl?: string) {
    // Both reads are independent; run them together but evaluate in the
    // original order so a missing project still yields NotFound first.
    const [projectResult, documentsResult] = await Promise.allSettled([
      this.prisma.project.findFirst({
        where: { id: projectId, archivedAt: null },
      }),
      this.prisma.projectDocument.findMany({
        where: {
          projectId,
          archivedAt: null,
        },
        orderBy: { uploadedAt: 'desc' },
      }),
    ]);

    if (projectResult.status === 'rejected') throw projectResult.reason;
    const project = projectResult.value;

    if (!project) {
      throw new NotFoundException('Không tìm thấy dự án.');
    }

    if (documentsResult.status === 'rejected') throw documentsResult.reason;
    const documents = documentsResult.value;

    return documents.map((doc) => this.formatDocument(doc, baseUrl));
  }

  async uploadDocuments(
    projectId: string,
    files: Express.Multer.File[],
    category: 'hoso' | 'hopdong' = 'hoso',
    userId?: string,
    baseUrl?: string,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, archivedAt: null },
    });

    if (!project) {
      throw new NotFoundException('Không tìm thấy dự án.');
    }

    if (!files || files.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất một file để tải lên.');
    }

    const validCategory = category === 'hopdong' ? 'hopdong' : 'hoso';
    const createdDocuments = [];

    for (const file of files) {
      // Decode properly in case of non-ASCII characters in filename
      let originalName = file.originalname;
      try {
        originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      } catch {
        originalName = file.originalname;
      }

      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const sanitizedBaseName = path
        .basename(originalName, path.extname(originalName))
        .replace(/[^a-zA-Z0-9_\-\.]/g, '_');
      const ext = path.extname(originalName);
      const uniqueFilename = `${timestamp}_${randomSuffix}_${sanitizedBaseName}${ext}`;

      // Local uploads/ dir or Supabase Storage (see common/storage/file-storage.ts)
      const relativePath = await fileStorage.save(
        'documents',
        uniqueFilename,
        readUploadedFile(file),
        file.mimetype,
      );
      const publicUrl = fileStorage.isRemotePath(relativePath)
        ? null
        : `/uploads/documents/${uniqueFilename}`;

      const document = await this.prisma.projectDocument.create({
        data: {
          projectId,
          name: originalName,
          size: file.size,
          mimeType: file.mimetype || null,
          category: validCategory,
          filePath: relativePath,
          url: publicUrl,
          uploadedBy: userId ?? null,
        },
      });

      createdDocuments.push(this.formatDocument(document, baseUrl));
    }

    return createdDocuments;
  }

  async updateDocument(
    id: string,
    dto: UpdateProjectDocumentDto,
    userId?: string,
    baseUrl?: string,
  ) {
    const document = await this.prisma.projectDocument.findFirst({
      where: { id, archivedAt: null },
    });

    if (!document) {
      throw new NotFoundException('Không tìm thấy tài liệu.');
    }

    const updated = await this.prisma.projectDocument.update({
      where: { id },
      data: {
        category: dto.category,
      },
    });

    return this.formatDocument(updated, baseUrl);
  }

  async deleteDocument(id: string, userId?: string) {
    const document = await this.prisma.projectDocument.findFirst({
      where: { id, archivedAt: null },
    });

    if (!document) {
      throw new NotFoundException('Không tìm thấy tài liệu.');
    }

    await this.prisma.projectDocument.update({
      where: { id },
      data: {
        archivedAt: new Date(),
        archivedBy: userId ?? null,
      },
    });

    return { success: true, message: 'Đã xóa tài liệu thành công.' };
  }

  async getDocumentFile(id: string) {
    const document = await this.prisma.projectDocument.findFirst({
      where: { id, archivedAt: null },
    });

    if (!document) {
      throw new NotFoundException('Không tìm thấy tài liệu hoặc tài liệu đã bị xóa.');
    }

    const stored = await fileStorage.read(document.filePath);
    if (!stored) {
      throw new NotFoundException('File vật lý không tồn tại trên hệ thống.');
    }

    return {
      filePath: stored.localPath,
      buffer: stored.buffer,
      fileName: document.name,
      mimeType: document.mimeType || 'application/octet-stream',
    };
  }
}
