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
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
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
  template(@Res() response: Response) {
    response
      .setHeader('Content-Type', 'text/csv; charset=utf-8')
      .setHeader(
        'Content-Disposition',
        'attachment; filename="task-import-template.csv"',
      )
      .send(`\uFEFF${this.importService.template()}`);
  }

  @Post('import')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  import(
    @UploadedFile() file: Express.Multer.File,
    @Body('projectId') projectId: string | undefined,
    @Body('confirm') confirm: string | boolean | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.importService.parse(
      file,
      projectId,
      String(confirm) === 'true',
      user.id,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateTaskDto) {
    return this.tasksService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskDto) {
    return this.tasksService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.remove(id);
  }
}
