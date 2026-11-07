import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from '../../prisma/prisma.module';
import { ModulePermissionInterceptor } from './module-permission.interceptor';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [PermissionsController],
  providers: [
    PermissionsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ModulePermissionInterceptor,
    },
  ],
  exports: [PermissionsService],
})
export class PermissionsModule {}
