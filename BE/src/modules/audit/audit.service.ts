import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log({
    userId,
    action,
    entityType,
    entityId,
    fieldChanged,
    oldValue,
    newValue,
  }: {
    userId: string;
    action: 'create' | 'update' | 'delete';
    entityType: string;
    entityId: string;
    fieldChanged?: string;
    oldValue?: any;
    newValue?: any;
  }) {
    return this.prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        fieldChanged: fieldChanged || null,
        oldValue:
          oldValue !== undefined && oldValue !== null
            ? JSON.stringify(oldValue)
            : null,
        newValue:
          newValue !== undefined && newValue !== null
            ? JSON.stringify(newValue)
            : null,
      },
    });
  }
}
