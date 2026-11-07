import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { DataManagementController } from './data-management.controller';
import { DataManagementService } from './data-management.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [DataManagementController],
  providers: [DataManagementService],
  exports: [DataManagementService],
})
export class DataManagementModule {}
