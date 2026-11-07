import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectDocumentsController } from './project-documents.controller';
import { ProjectDocumentsService } from './project-documents.service';
import { TaskImportService } from './task-import.service';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { WeeklyReportsController } from './weekly-reports.controller';
import { WeeklyReportsService } from './weekly-reports.service';
import { MembersController } from './members.controller';

import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [
    ProjectsController,
    ProjectDocumentsController,
    TasksController,
    WeeklyReportsController,
    MembersController,
  ],
  providers: [
    ProjectsService,
    ProjectDocumentsService,
    TasksService,
    TaskImportService,
    WeeklyReportsService,
  ],
  exports: [
    ProjectsService,
    ProjectDocumentsService,
    TasksService,
    WeeklyReportsService,
  ],
})
export class ProjectsTasksModule {}

