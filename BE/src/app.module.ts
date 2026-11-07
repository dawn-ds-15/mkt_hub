import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuditModule } from './modules/audit/audit.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { UserContextInterceptor } from './common/interceptors/user-context.interceptor';
import { ProjectsTasksModule } from './modules/projects-tasks/projects-tasks.module';
import { LeadsKpisModule } from './modules/leads-kpis/leads-kpis.module';
import { ExpenseModule } from './modules/expense/expense.module';
import { DataManagementModule } from './modules/data-management/data-management.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    PermissionsModule,
    DashboardModule,
    ProjectsTasksModule,
    LeadsKpisModule,
    ExpenseModule,
    DataManagementModule,
    NotificationsModule,
    InventoryModule,
    ProfilesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: UserContextInterceptor,
    },
  ],
})
export class AppModule {}
