import { inlineContentDisposition, sendStoredFile } from '../../common/storage/file-storage';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  ProjectDocumentSingleResponseDto,
  ProjectDocumentsListResponseDto,
  UpdateProjectDocumentDto,
  UploadProjectDocumentsDto,
} from './dto/project-document.dto';
import { ProjectDocumentsService } from './project-documents.service';

@ApiTags('Project Documents')
@Controller('v1/projects')
export class ProjectDocumentsController {
  constructor(
    private readonly projectDocumentsService: ProjectDocumentsService,
  ) {}

  private getBaseUrl(req: Request): string {
    const appUrl =
      process.env.APP_URL ||
      process.env.BACKEND_URL ||
      process.env.RENDER_EXTERNAL_URL;
    if (appUrl) {
      return appUrl.replace(/\/+$/, '');
    }
    const forwardedProto = req.headers['x-forwarded-proto'];
    const protocol = Array.isArray(forwardedProto)
      ? forwardedProto[0]
      : forwardedProto || req.protocol || 'http';
    const host = req.get('host') || 'localhost:3000';
    return `${protocol}://${host}`;
  }

  // 1. GET /api/v1/projects/:id/documents
  @Get(':id/documents')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Lấy danh sách hồ sơ & hợp đồng theo dự án' })
  @ApiOkResponse({
    description: 'Danh sách hồ sơ theo dự án',
    type: ProjectDocumentsListResponseDto,
  })
  async getProjectDocuments(
    @Param('id') projectId: string,
    @Req() req: Request,
  ) {
    const baseUrl = this.getBaseUrl(req);
    const documents = await this.projectDocumentsService.getProjectDocuments(
      projectId,
      baseUrl,
    );
    return { data: documents };
  }

  // 2. POST /api/v1/projects/:id/documents
  @Post(':id/documents')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({
    summary: 'Upload nhiều file hồ sơ / hợp đồng cho dự án (multipart/form-data)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['hoso', 'hopdong'],
          default: 'hoso',
        },
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
      required: ['files'],
    },
  })
  @ApiOkResponse({
    description: 'Danh sách tài liệu vừa được upload thành công',
    type: ProjectDocumentsListResponseDto,
  })
  @UseInterceptors(FilesInterceptor('files'))
  async uploadProjectDocuments(
    @Param('id') projectId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: UploadProjectDocumentsDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const baseUrl = this.getBaseUrl(req);
    const documents = await this.projectDocumentsService.uploadDocuments(
      projectId,
      files,
      dto.category,
      user.id,
      baseUrl,
    );
    return { data: documents };
  }

  // 3. PATCH /api/v1/projects/documents/:id
  @Patch('documents/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Cập nhật loại tài liệu (category: hoso | hopdong)' })
  @ApiOkResponse({
    description: 'Tài liệu sau khi cập nhật',
    type: ProjectDocumentSingleResponseDto,
  })
  async updateProjectDocument(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const baseUrl = this.getBaseUrl(req);
    const document = await this.projectDocumentsService.updateDocument(
      id,
      dto,
      user.id,
      baseUrl,
    );
    return { data: document };
  }

  // 4. DELETE /api/v1/projects/documents/:id
  @Delete('documents/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Xóa mềm tài liệu dự án' })
  @ApiOkResponse({
    description: 'Kết quả xóa mềm tài liệu',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Đã xóa tài liệu thành công.' },
      },
    },
  })
  async deleteProjectDocument(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectDocumentsService.deleteDocument(id, user.id);
  }

  // 5. GET /api/v1/projects/documents/:id/file
  @Get('documents/:id/file')
  @ApiOperation({
    summary: 'Xem hoặc tải file tài liệu dự án (mở trực tiếp trên trình duyệt hoặc tải về)',
  })
  @ApiProduces(
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/octet-stream',
  )
  @ApiOkResponse({
    description: 'Binary stream của file tài liệu',
  })
  async getDocumentFile(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { filePath, buffer, fileName, mimeType } =
      await this.projectDocumentsService.getDocumentFile(id);

    res.setHeader('Content-Disposition', inlineContentDisposition(fileName));
    if (mimeType) {
      res.setHeader('Content-Type', mimeType);
    }
    return sendStoredFile(res, { localPath: filePath, buffer });
  }
}

