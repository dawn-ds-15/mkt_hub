import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { TaskImportService } from './task-import.service';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { WeeklyReportsController } from './weekly-reports.controller';
import { WeeklyReportsService } from './weekly-reports.service';

@Module({
  controllers: [ProjectsController, TasksController, WeeklyReportsController],
  providers: [
    ProjectsService,
    TasksService,
    TaskImportService,
    WeeklyReportsService,
  ],
  exports: [ProjectsService, TasksService, WeeklyReportsService],
})
export class ProjectsTasksModule {}
