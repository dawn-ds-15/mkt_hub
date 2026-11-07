import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryAttachmentsController } from './inventory-attachments.controller';
import { InventoryAttachmentsService } from './inventory-attachments.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [InventoryController, InventoryAttachmentsController],
  providers: [InventoryService, InventoryAttachmentsService],
  exports: [InventoryService],
})
export class InventoryModule {}
