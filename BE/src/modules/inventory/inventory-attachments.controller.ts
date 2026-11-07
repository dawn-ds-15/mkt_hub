import { inlineContentDisposition, sendStoredFile } from '../../common/storage/file-storage';
import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
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
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { resolveRequestBaseUrl } from '../../common/utils/request-base-url';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  InventoryBatchAttachmentListResponseDto,
  InventoryDeleteSuccessResponseDto,
} from './dto/inventory.dto';
import {
  decodeUploadFilename,
  INVENTORY_ATTACHMENT_MAX_FILES,
  INVENTORY_ATTACHMENT_MAX_FILE_SIZE,
  InventoryAttachmentsService,
  isAllowedInventoryAttachment,
} from './inventory-attachments.service';

export { resolveRequestBaseUrl };

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/inventory')
export class InventoryAttachmentsController {
  constructor(
    private readonly inventoryAttachmentsService: InventoryAttachmentsService,
  ) {}

  // GET /api/v1/inventory/batches/{batchId}/attachments
  @Get('batches/:batchId/attachments')
  @ApiOperation({ summary: 'Danh sách hồ sơ đính kèm của batch kho' })
  @ApiOkResponse({
    description: 'Danh sách hồ sơ đính kèm',
    type: InventoryBatchAttachmentListResponseDto,
  })
  async getBatchAttachments(
    @Param('batchId') batchId: string,
    @Req() req: Request,
  ) {
    const attachments = await this.inventoryAttachmentsService.getBatchAttachments(
      batchId,
      resolveRequestBaseUrl(req),
    );
    return { data: attachments };
  }

  // POST /api/v1/inventory/batches/{batchId}/attachments
  @Post('batches/:batchId/attachments')
  @ApiOperation({
    summary:
      'Upload hồ sơ đính kèm cho batch kho (multipart/form-data, field "files", PDF/ảnh/Excel/Word, tối đa 10MB mỗi file)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
      required: ['files'],
    },
  })
  @ApiCreatedResponse({
    description: 'Các hồ sơ vừa được thêm',
    type: InventoryBatchAttachmentListResponseDto,
  })
  @UseInterceptors(
    FilesInterceptor('files', INVENTORY_ATTACHMENT_MAX_FILES, {
      limits: { fileSize: INVENTORY_ATTACHMENT_MAX_FILE_SIZE },
      fileFilter: (_req, file, callback) => {
        if (!isAllowedInventoryAttachment(file)) {
          return callback(
            new BadRequestException(
              `File "${decodeUploadFilename(file.originalname)}" không đúng định dạng. Chỉ nhận PDF, ảnh, Excel hoặc Word.`,
            ),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async uploadBatchAttachments(
    @Param('batchId') batchId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const attachments = await this.inventoryAttachmentsService.uploadBatchAttachments(
      batchId,
      files,
      user?.id,
      resolveRequestBaseUrl(req),
    );
    return { data: attachments };
  }

  // DELETE /api/v1/inventory/attachments/{id}
  @Delete('attachments/:id')
  @ApiOperation({ summary: 'Xóa mềm hồ sơ đính kèm của batch kho' })
  @ApiOkResponse({
    description: 'Kết quả xóa mềm',
    type: InventoryDeleteSuccessResponseDto,
  })
  async deleteAttachment(@Param('id') id: string) {
    const res = await this.inventoryAttachmentsService.deleteAttachment(id);
    return { data: res };
  }

  // GET /api/v1/inventory/attachments/{id}/file
  @Get('attachments/:id/file')
  @ApiOperation({ summary: 'Xem hoặc tải file hồ sơ đính kèm của batch kho' })
  @ApiProduces(
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/octet-stream',
  )
  @ApiOkResponse({ description: 'Binary stream của file hồ sơ' })
  async getAttachmentFile(@Param('id') id: string, @Res() res: Response) {
    const { filePath, buffer, fileName, mimeType } =
      await this.inventoryAttachmentsService.getAttachmentFile(id);

    res.setHeader('Content-Disposition', inlineContentDisposition(fileName));
    res.setHeader('Content-Type', mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return sendStoredFile(res, { localPath: filePath, buffer });
  }
}
