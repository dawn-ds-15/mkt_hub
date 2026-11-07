import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { CreateTaskDto, TaskFilterDto, UpdateTaskDto } from './dto/task.dto';
import { TaskImportService } from './task-import.service';
import { TasksService } from './tasks.service';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/tasks')
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly importService: TaskImportService,
  ) {}

  @Get()
  findAll(@Query() filters: TaskFilterDto) {
    return this.tasksService.findAll(filters);
  }

  @Get('kanban/board')
  kanban(@Query() filters: TaskFilterDto) {
    return this.tasksService.kanban(filters);
  }

  @Get('import/template')
  @ApiProduces(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
  )
  @ApiResponse({
    status: 200,
    description: 'File template import task (XLSX hoặc CSV)',
  })
  async template(
    @Query('format') format: string | undefined,
    @Res() response: Response,
  ) {
    if (format === 'csv') {
      response
        .setHeader('Content-Type', 'text/csv; charset=utf-8')
        .setHeader(
          'Content-Disposition',
          'attachment; filename="MAU_BANG_KE_HOACH_TASK_CHIEN_DICH.csv"',
        )
        .send(`\uFEFF${this.importService.template()}`);
      return;
    }

    const buffer = await this.importService.campaignTemplateWorkbook();
    response
      .setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      .setHeader(
        'Content-Disposition',
        'attachment; filename="MAU_BANG_KE_HOACH_TASK_CHIEN_DICH.xlsx"',
      )
      .send(buffer);
  }

  @Post('import')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File CSV hoặc XLSX cần import',
        },
        projectId: {
          type: 'string',
          description: 'UUID hoặc tên của project (tùy chọn)',
        },
        project_id: {
          type: 'string',
          description: 'UUID hoặc tên của project (tùy chọn)',
        },
        year: {
          type: 'number',
          description: 'Năm thực hiện (tùy chọn)',
        },
        confirm: {
          type: 'boolean',
          default: false,
          description: 'true = lưu vào DB, false = preview không lưu',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  import(
    @UploadedFile() file: Express.Multer.File,
    @Body('projectId') projectId: string | undefined,
    @Body('project_id') projectIdAlt: string | undefined,
    @Body('year') year: string | number | undefined,
    @Body('confirm') confirm: string | boolean | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const defaultProjectId = projectId || projectIdAlt;
    const defaultYear = year ? Number(year) : undefined;
    return this.importService.parse(
      file,
      defaultProjectId,
      String(confirm) === 'true',
      user.id,
      defaultYear,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  @Post()
  create(
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tasksService.create(dto, user?.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tasksService.update(id, dto, user?.id);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tasksService.remove(id, user.id);
  }
}
