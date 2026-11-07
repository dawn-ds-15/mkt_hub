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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  ATTACHMENT_MAX_FILES,
  attachmentUploadOptions,
} from '../../common/storage/attachment-upload';
import {
  inlineContentDisposition,
  sendStoredFile,
} from '../../common/storage/file-storage';
import { resolveRequestBaseUrl } from '../../common/utils/request-base-url';
import { ExpenseLineAttachmentListResponseDto } from './dto/expense.dto';
import { ExpenseAttachmentsService } from './expense-attachments.service';

/** Several files per expense line (BE_requirement_29_09_26 §1). */
@ApiTags('Expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/expenses')
export class ExpenseAttachmentsController {
  constructor(
    private readonly expenseAttachmentsService: ExpenseAttachmentsService,
  ) {}

  // GET /api/v1/expenses/lines/{lineId}/attachments
  @Get('lines/:lineId/attachments')
  @ApiOperation({
    summary:
      'Danh sách hồ sơ của dòng chi phí (gồm cả file cũ 1-file-một-dòng)',
  })
  @ApiOkResponse({ type: ExpenseLineAttachmentListResponseDto })
  async getLineAttachments(
    @Param('lineId') lineId: string,
    @Req() req: Request,
  ) {
    const attachments = await this.expenseAttachmentsService.getLineAttachments(
      lineId,
      resolveRequestBaseUrl(req),
    );
    return { data: attachments };
  }

  // POST /api/v1/expenses/lines/{lineId}/attachments
  @Post('lines/:lineId/attachments')
  @ApiOperation({
    summary:
      'Upload hồ sơ cho dòng chi phí (multipart/form-data, field "files", nhiều file, PDF/ảnh/Excel/Word, tối đa 10MB mỗi file)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
      required: ['files'],
    },
  })
  @ApiCreatedResponse({
    description: 'Các hồ sơ vừa được thêm',
    type: ExpenseLineAttachmentListResponseDto,
  })
  @UseInterceptors(
    FilesInterceptor(
      'files',
      ATTACHMENT_MAX_FILES,
      attachmentUploadOptions((message) => new BadRequestException(message)),
    ),
  )
  async uploadLineAttachments(
    @Param('lineId') lineId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const attachments =
      await this.expenseAttachmentsService.uploadLineAttachments(
        lineId,
        files,
        user?.id,
        resolveRequestBaseUrl(req),
      );
    return { data: attachments };
  }

  // DELETE /api/v1/expenses/attachments/{id}
  @Delete('attachments/:id')
  @ApiOperation({
    summary: 'Gỡ hồ sơ khỏi dòng chi phí (các snapshot cũ vẫn giữ file)',
  })
  async deleteAttachment(@Param('id') id: string) {
    const res = await this.expenseAttachmentsService.deleteAttachment(id);
    return { data: res };
  }

  // GET /api/v1/expenses/attachments/{id}/file
  @Get('attachments/:id/file')
  @ApiOperation({ summary: 'Xem hoặc tải file hồ sơ của dòng chi phí' })
  @ApiProduces(
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/octet-stream',
  )
  @ApiOkResponse({ description: 'Binary stream của file hồ sơ' })
  async getAttachmentFile(@Param('id') id: string, @Res() res: Response) {
    const { filePath, buffer, fileName, mimeType } =
      await this.expenseAttachmentsService.getAttachmentFile(id);

    res.setHeader('Content-Disposition', inlineContentDisposition(fileName));
    res.setHeader('Content-Type', mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return sendStoredFile(res, { localPath: filePath, buffer });
  }
}
