import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { userContext } from '../common/context/user-context';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private _extendedClient: any;

  constructor() {
    super();
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    this._extendedClient = this.$extends({
      query: {
        $allModels: {
          async create({ model, args, query }) {
            // Auto-increment memberId for Member
            if (model === 'Member') {
              const data = args.data as any;
              if (!data.memberId || data.memberId === 0) {
                const maxMember = await (self as any).member.findFirst({
                  orderBy: { memberId: 'desc' },
                });
                data.memberId = maxMember ? maxMember.memberId + 1 : 1;
              }
            }
            const result = await query(args);
            await self.logAudit(
              model,
              'create',
              (result as any)?.id,
              null,
              result,
            );
            return result;
          },
          async update({ model, args, query }) {
            let oldRecord = null;
            try {
              const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
              oldRecord = await (self as any)[modelKey].findUnique({
                where: args.where,
              });
            } catch {
              // Ignore if we can't fetch old record
            }
            const result = await query(args);
            await self.logAudit(
              model,
              'update',
              (result as any)?.id,
              oldRecord,
              result,
            );
            return result;
          },
          async delete({ model, args, query }) {
            let oldRecord = null;
            try {
              const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
              oldRecord = await (self as any)[modelKey].findUnique({
                where: args.where,
              });
            } catch {
              // Ignore
            }
            const result = await query(args);
            await self.logAudit(
              model,
              'delete',
              oldRecord?.id || args.where?.id,
              oldRecord,
              null,
            );
            return result;
          },
          async upsert({ model, args, query }) {
            if (model === 'Member') {
              const createData = args.create as any;
              if (
                createData &&
                (!createData.memberId || createData.memberId === 0)
              ) {
                const maxMember = await (self as any).member.findFirst({
                  orderBy: { memberId: 'desc' },
                });
                createData.memberId = maxMember ? maxMember.memberId + 1 : 1;
              }
            }
            let oldRecord = null;
            try {
              const modelKey = model.charAt(0).toLowerCase() + model.slice(1);
              oldRecord = await (self as any)[modelKey].findUnique({
                where: args.where,
              });
            } catch {
              // Ignore
            }
            const result = await query(args);
            const action = oldRecord ? 'update' : 'create';
            await self.logAudit(
              model,
              action,
              (result as any)?.id,
              oldRecord,
              result,
            );
            return result;
          },
        },
      },
    });

    // Proxy calls to the extended client
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (target._extendedClient && prop in target._extendedClient) {
          return Reflect.get(target._extendedClient, prop, receiver);
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  private async logAudit(
    model: string,
    action: 'create' | 'update' | 'delete',
    entityId: any,
    oldValue: any,
    newValue: any,
  ) {
    if (model === 'AuditLog') {
      return; // Do not log operations on the AuditLog table itself
    }
    const store = userContext.getStore();
    const userId = store?.userId || 'system';

    // Find if the user exists in DB to prevent foreign key errors (especially during initial seed/signup)
    const userExists = await this.member.findUnique({ where: { id: userId } });
    if (!userExists) {
      return;
    }

    try {
      await this.auditLog.create({
        data: {
          userId,
          action,
          entityType: model.toLowerCase(),
          entityId: entityId ? String(entityId) : 'unknown',
          oldValue: oldValue ? JSON.stringify(oldValue) : null,
          newValue: newValue ? JSON.stringify(newValue) : null,
        },
      });
    } catch (err) {
      console.error('Failed to write audit log:', err);
    }
  }
}
