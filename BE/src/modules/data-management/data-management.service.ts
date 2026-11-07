import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateMemberDto, UpdateMemberDto, SaveSlackConfigDto, ResetSandboxDto, BulkImportConfirmDto } from './dto/data-management.dto';
import * as bcrypt from 'bcrypt';
import * as ExcelJS from 'exceljs';
import PDFDocument = require('pdfkit');
import JSZip = require('jszip');
import * as fs from 'fs';
import * as path from 'path';
import { Decimal } from '@prisma/client/runtime/library';
import {
  parseFlexibleDate,
  pickInitiationDateRaw,
} from '../leads-kpis/closed-deal-initiation.util';

@Injectable()
export class DataManagementService implements OnModuleInit {
  private backupDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {
    this.backupDir = path.join(process.cwd(), 'database', 'backups');
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  onModuleInit() {
    // Start background checks for Slack notifications
    setInterval(() => this.checkAndSendSlackNotifications(), 60000); // Check every minute
  }

  // --- MEMBER MANAGEMENT ---
  async getMembers() {
    const list = await this.prisma.member.findMany({
      where: {
        email: { not: { endsWith: '@secret.dev' } },
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        memberId: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        createdAt: true,
      },
    });
    return list.map((m) => ({
      ...m,
      is_active: m.isActive,
    }));
  }

  async createMember(dto: CreateMemberDto, currentUserId: string) {
    const existing = await this.prisma.member.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new BadRequestException('Email đã tồn tại.');
    }

    if (!dto.password) {
      throw new BadRequestException('Password là bắt buộc khi tạo mới member.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    // Auto-generate initials for avatar
    const initials = dto.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    // Get max memberId and increment
    const maxMember = await this.prisma.member.findFirst({
      orderBy: { memberId: 'desc' },
    });
    const nextMemberId = (maxMember?.memberId || 0) + 1;

    const isActiveVal = dto.isActive !== undefined ? dto.isActive : dto.is_active;
    const member = await this.prisma.member.create({
      data: {
        name: dto.name,
        email: dto.email,
        role: dto.role,
        isActive: isActiveVal !== undefined ? isActiveVal : true,
        passwordHash,
        avatarUrl: initials,
        memberId: nextMemberId,
      },
    });

    const { passwordHash: _, ...result } = member;

    await this.auditService.log({
      userId: currentUserId,
      action: 'create',
      entityType: 'Member',
      entityId: member.id,
      newValue: result,
    });

    return {
      ...result,
      is_active: result.isActive,
    };
  }

  async updateMember(id: string, dto: UpdateMemberDto, currentUserId: string) {
    const member = await this.prisma.member.findUnique({ where: { id } });
    if (!member) {
      throw new NotFoundException('Không tìm thấy thành viên.');
    }

    const isActiveVal = dto.isActive !== undefined ? dto.isActive : dto.is_active;

    // Prevents editing own role or deactivating oneself
    if (id === currentUserId) {
      if (dto.role && dto.role !== member.role) {
        throw new BadRequestException('Không thể hạ hoặc đổi role của chính mình.');
      }
      if (isActiveVal === false) {
        throw new BadRequestException('Không thể tự khóa tài khoản của chính mình.');
      }
    }

    if (dto.email && dto.email !== member.email) {
      const existing = await this.prisma.member.findUnique({ where: { email: dto.email } });
      if (existing) {
        throw new BadRequestException('Email đã tồn tại.');
      }
    }

    const data: any = {
      name: dto.name || member.name,
      email: dto.email || member.email,
      role: dto.role || member.role,
      isActive: isActiveVal !== undefined ? isActiveVal : member.isActive,
    };

    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    const updated = await this.prisma.member.update({
      where: { id },
      data,
    });

    const { passwordHash: _, ...result } = updated;

    await this.auditService.log({
      userId: currentUserId,
      action: 'update',
      entityType: 'Member',
      entityId: id,
      oldValue: member,
      newValue: result,
    });

    return {
      ...result,
      is_active: result.isActive,
    };
  }

  async removeMember(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new BadRequestException('Không thể xóa chính mình.');
    }

    const member = await this.prisma.member.findUnique({ where: { id } });
    if (!member) {
      throw new NotFoundException('Không tìm thấy thành viên.');
    }

    // Instead of deleting, deactivate to keep audit logs and task assignee consistency
    const updated = await this.prisma.member.update({
      where: { id },
      data: { isActive: false },
    });

    await this.auditService.log({
      userId: currentUserId,
      action: 'delete',
      entityType: 'Member',
      entityId: id,
      oldValue: member,
      newValue: updated,
    });

    return { success: true, message: 'Đã vô hiệu hóa thành viên thành công.' };
  }

  // --- DROPDOWN CONFIG ---
  async getDropdowns() {
    const defaultLabels: Record<string, string> = {
      contract_status: 'Trạng thái Hợp đồng',
      currency: 'Tiền tệ',
      lead_source: 'Nguồn Leads',
      opportunity_status: 'Trạng thái Cơ hội',
      company_size: 'Phân khúc Khách hàng',
      project_status: 'Trạng thái Dự án',
      project_type: 'Loại Dự án',
      task_status: 'Trạng thái Task',
      task_priority: 'Độ ưu tiên Task',
      stakeholder: 'Bên liên quan',
      budget_category: 'Danh mục chi phí',
    };

    const [list, allOptions] = await Promise.all([
      this.prisma.dropdownConfig.findMany({
        orderBy: { key: 'asc' },
      }),
      this.prisma.dropdownOption.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);

    const optionsByKey = new Map<string, any[]>();
    for (const opt of allOptions) {
      if (!optionsByKey.has(opt.dropdownKey)) {
        optionsByKey.set(opt.dropdownKey, []);
      }
      optionsByKey.get(opt.dropdownKey)!.push(opt);
    }

    return Promise.all(
      list.map(async (item) => {
        let parsedValues: string[] = [];
        try {
          const parsed = JSON.parse(item.values);
          if (Array.isArray(parsed)) {
            parsedValues = parsed.map((v) =>
              typeof v === 'object' ? JSON.stringify(v) : String(v),
            );
          } else if (typeof parsed === 'string') {
            if (parsed.startsWith('[') && parsed.endsWith(']')) {
              try {
                const subParsed = JSON.parse(parsed);
                if (Array.isArray(subParsed)) {
                  parsedValues = subParsed.map((v) =>
                    typeof v === 'object' ? JSON.stringify(v) : String(v),
                  );
                } else {
                  parsedValues = [String(subParsed)];
                }
              } catch {
                parsedValues = [parsed];
              }
            } else {
              parsedValues = parsed
                .split(',')
                .map((v) => v.trim())
                .filter(Boolean);
            }
          } else if (parsed && typeof parsed === 'object') {
            parsedValues = Object.values(parsed).map((v) =>
              typeof v === 'object' ? JSON.stringify(v) : String(v),
            );
          } else if (parsed !== null && parsed !== undefined) {
            parsedValues = [String(parsed)];
          }
        } catch (err) {
          if (item.values) {
            if (item.values.startsWith('[') && item.values.endsWith(']')) {
              const cleaned = item.values.slice(1, -1).replace(/"/g, '');
              parsedValues = cleaned
                .split(',')
                .map((v) => v.trim())
                .filter(Boolean);
            } else {
              parsedValues = item.values
                .split(',')
                .map((v) => v.trim())
                .filter(Boolean);
            }
          }
        }

        let options = optionsByKey.get(item.key) || [];

        // Auto-seed DropdownOption from parsedValues if none exist yet
        if (options.length === 0 && parsedValues.length > 0 && this.prisma?.dropdownOption?.create) {
          for (let idx = 0; idx < parsedValues.length; idx++) {
            const val = parsedValues[idx];
            const norm = val.trim().toLowerCase();
            try {
              const createdOpt = await this.prisma.dropdownOption.create({
                data: {
                  dropdownKey: item.key,
                  label: val.trim(),
                  normalizedLabel: norm,
                  isActive: true,
                  sortOrder: idx,
                },
              });
              if (createdOpt) {
                options.push(createdOpt);
              }
            } catch {
              // Ignore duplicate collision during seed
            }
          }
        }

        const label =
          defaultLabels[item.key] ||
          (item.label && !item.label.includes('_') ? item.label : null) ||
          item.key
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());

        const activeOptions = options.filter((o) => o && o.isActive !== false);
        const resolvedValues =
          activeOptions.length > 0
            ? activeOptions.map((o) => o.label)
            : parsedValues;

        return {
          ...item,
          label,
          values: resolvedValues,
          options,
        };
      }),
    );
  }

  async createDropdownOption(
    key: string,
    dto: { label: string; isActive?: boolean; sortOrder?: number },
    currentUserId: string,
  ) {
    const label = dto.label?.trim();
    if (!label) {
      throw new BadRequestException('Tên giá trị không được để trống.');
    }
    const normalizedLabel = label.toLowerCase();

    const existing = await this.prisma.dropdownOption.findUnique({
      where: {
        dropdownKey_normalizedLabel: {
          dropdownKey: key,
          normalizedLabel,
        },
      },
    });

    if (existing) {
      if (!existing.isActive) {
        const reactivated = await this.prisma.dropdownOption.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            label,
            sortOrder: dto.sortOrder !== undefined ? dto.sortOrder : existing.sortOrder,
          },
        });
        await this.syncDropdownConfigValues(key);
        return reactivated;
      }
      throw new ConflictException(
        `Giá trị "${label}" đã tồn tại trong danh mục này.`,
      );
    }

    const created = await this.prisma.dropdownOption.create({
      data: {
        dropdownKey: key,
        label,
        normalizedLabel,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        sortOrder: dto.sortOrder !== undefined ? dto.sortOrder : 0,
      },
    });

    await this.syncDropdownConfigValues(key);

    await this.auditService.log({
      userId: currentUserId,
      action: 'create',
      entityType: 'DropdownOption',
      entityId: created.id,
      newValue: created,
    });

    return created;
  }

  async updateDropdownOption(
    key: string,
    optionId: string,
    dto: { label?: string; isActive?: boolean; sortOrder?: number },
    currentUserId: string,
  ) {
    const option = await this.prisma.dropdownOption.findFirst({
      where: { id: optionId, dropdownKey: key },
    });
    if (!option) {
      throw new NotFoundException('Không tìm thấy tùy chọn dropdown.');
    }

    const data: any = {};
    if (dto.label !== undefined) {
      const label = dto.label.trim();
      if (!label) {
        throw new BadRequestException('Tên giá trị không được để trống.');
      }
      const normalizedLabel = label.toLowerCase();
      if (normalizedLabel !== option.normalizedLabel) {
        const duplicate = await this.prisma.dropdownOption.findUnique({
          where: {
            dropdownKey_normalizedLabel: {
              dropdownKey: key,
              normalizedLabel,
            },
          },
        });
        if (duplicate && duplicate.id !== optionId) {
          throw new ConflictException(
            `Giá trị "${label}" đã tồn tại trong danh mục này.`,
          );
        }
      }
      data.label = label;
      data.normalizedLabel = normalizedLabel;
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

    const updated = await this.prisma.dropdownOption.update({
      where: { id: optionId },
      data,
    });

    await this.syncDropdownConfigValues(key);

    await this.auditService.log({
      userId: currentUserId,
      action: 'update',
      entityType: 'DropdownOption',
      entityId: optionId,
      oldValue: option,
      newValue: updated,
    });

    return updated;
  }

  async deleteDropdownOption(
    key: string,
    optionId: string,
    currentUserId: string,
  ) {
    const option = await this.prisma.dropdownOption.findFirst({
      where: { id: optionId, dropdownKey: key },
    });
    if (!option) {
      throw new NotFoundException('Không tìm thấy tùy chọn dropdown.');
    }

    const impact = await this.getDropdownOptionImpact(key, optionId);

    // Soft delete to maintain consistency
    const updated = await this.prisma.dropdownOption.update({
      where: { id: optionId },
      data: { isActive: false },
    });

    await this.syncDropdownConfigValues(key);

    await this.auditService.log({
      userId: currentUserId,
      action: 'delete',
      entityType: 'DropdownOption',
      entityId: optionId,
      oldValue: option,
      newValue: updated,
    });

    return {
      success: true,
      message: 'Đã xóa tùy chọn dropdown thành công.',
      impact,
      option: updated,
    };
  }

  async getDropdownOptionImpact(key: string, optionId: string) {
    const option = await this.prisma.dropdownOption.findFirst({
      where: { id: optionId, dropdownKey: key },
    });
    if (!option) {
      throw new NotFoundException('Không tìm thấy tùy chọn dropdown.');
    }

    const label = option.label;
    let tasksCount = 0;
    let projectsCount = 0;
    let oppsCount = 0;
    let dealsCount = 0;

    if (key === 'task_status') {
      tasksCount = await this.prisma.task.count({
        where: { status: label, archivedAt: null },
      });
    } else if (key === 'task_priority') {
      tasksCount = await this.prisma.task.count({
        where: { priority: label, archivedAt: null },
      });
    } else if (key === 'project_status') {
      projectsCount = await this.prisma.project.count({
        where: { status: label, archivedAt: null },
      });
    } else if (key === 'project_type') {
      projectsCount = await this.prisma.project.count({
        where: { type: label, archivedAt: null },
      });
    } else if (key === 'company_size') {
      [oppsCount, dealsCount] = await Promise.all([
        this.prisma.opportunity.count({
          where: { size: label, archivedAt: null },
        }),
        this.prisma.closedDeal.count({
          where: { size: label, archivedAt: null },
        }),
      ]);
    } else if (key === 'stakeholder') {
      tasksCount = await this.prisma.task.count({
        where: {
          stakeholders: { contains: label },
          archivedAt: null,
        },
      });
    }

    const totalReferences = tasksCount + projectsCount + oppsCount + dealsCount;

    return {
      optionId,
      key,
      label,
      totalReferences,
      breakdown: {
        tasks: tasksCount,
        projects: projectsCount,
        opportunities: oppsCount,
        closedDeals: dealsCount,
      },
    };
  }

  private async syncDropdownConfigValues(key: string) {
    const activeOptions = await this.prisma.dropdownOption.findMany({
      where: { dropdownKey: key, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    const values = activeOptions.map((o) => o.label);
    await this.prisma.dropdownConfig.upsert({
      where: { key },
      create: {
        key,
        label: key,
        values: JSON.stringify(values),
      },
      update: {
        values: JSON.stringify(values),
      },
    });
  }

  async updateDropdown(key: string, values: string[], currentUserId: string) {
    const config = await this.prisma.dropdownConfig.findUnique({ where: { key } });
    if (!config) {
      throw new NotFoundException('Không tìm thấy cấu hình dropdown.');
    }

    const oldValues: string[] = JSON.parse(config.values);
    const deletedValues = oldValues.filter((v) => !values.includes(v));

    // If deleting values, check if they are currently used in database records
    if (deletedValues.length > 0) {
      let affectedCount = 0;
      if (key === 'project_type') {
        affectedCount = await this.prisma.project.count({ where: { type: { in: deletedValues } } });
      } else if (key === 'project_status') {
        affectedCount = await this.prisma.project.count({ where: { status: { in: deletedValues } } });
      } else if (key === 'task_status') {
        affectedCount = await this.prisma.task.count({ where: { status: { in: deletedValues } } });
      } else if (key === 'task_priority') {
        affectedCount = await this.prisma.task.count({ where: { priority: { in: deletedValues } } });
      } else if (key === 'company_size') {
        const [oppCount, dealCount] = await Promise.all([
          this.prisma.opportunity.count({ where: { size: { in: deletedValues } } }),
          this.prisma.closedDeal.count({ where: { size: { in: deletedValues } } }),
        ]);
        affectedCount = oppCount + dealCount;
      }

      if (affectedCount > 0) {
        throw new BadRequestException(
          `Giá trị bị xóa đang được sử dụng bởi ${affectedCount} bản ghi. Không thể xóa trực tiếp.`,
        );
      }
    }

    const updated = await this.prisma.dropdownConfig.update({
      where: { key },
      data: { values: JSON.stringify(values) },
    });

    // Update DropdownOption entities as well
    for (let idx = 0; idx < values.length; idx++) {
      const val = values[idx].trim();
      const norm = val.toLowerCase();
      await this.prisma.dropdownOption.upsert({
        where: {
          dropdownKey_normalizedLabel: {
            dropdownKey: key,
            normalizedLabel: norm,
          },
        },
        create: {
          dropdownKey: key,
          label: val,
          normalizedLabel: norm,
          isActive: true,
          sortOrder: idx,
        },
        update: {
          label: val,
          isActive: true,
          sortOrder: idx,
        },
      });
    }

    // Deactivate options not in the new values list
    const activeOptions = await this.prisma.dropdownOption.findMany({
      where: { dropdownKey: key, isActive: true },
    });
    const normalizedValues = values.map((v) => v.trim().toLowerCase());
    for (const opt of activeOptions) {
      if (!normalizedValues.includes(opt.normalizedLabel)) {
        await this.prisma.dropdownOption.update({
          where: { id: opt.id },
          data: { isActive: false },
        });
      }
    }

    await this.auditService.log({
      userId: currentUserId,
      action: 'update',
      entityType: 'DropdownConfig',
      entityId: config.id,
      oldValue: config,
      newValue: updated,
      fieldChanged: 'values',
    });

    return {
      ...updated,
      values,
    };
  }

  // --- SLACK SETTINGS & WEBHOOK ---
  async getSlackConfig(userRole?: string) {
    let config = await this.prisma.slackConfig.findFirst();
    if (!config) {
      config = await this.prisma.slackConfig.create({
        data: {
          webhookUrl: 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX',
          channel: '#mkt-alerts',
          notificationsEnabled: false,
          sendTime: '08:00',
          sendDays: 'T2,T3,T4,T5,T6',
          alertDaysBefore: 5,
        },
      });
    }

    if (userRole === 'specialist' && config.webhookUrl) {
      const url = config.webhookUrl;
      if (url.length > 25) {
        return {
          ...config,
          webhookUrl: url.substring(0, 30) + '...' + url.substring(url.length - 8),
        };
      } else {
        return {
          ...config,
          webhookUrl: '********',
        };
      }
    }

    return config;
  }

  async saveSlackConfig(dto: SaveSlackConfigDto, currentUserId: string) {
    const existing = await this.prisma.slackConfig.findFirst();
    let config;
    if (existing) {
      config = await this.prisma.slackConfig.update({
        where: { id: existing.id },
        data: {
          webhookUrl: dto.webhookUrl,
          channel: dto.channel,
          notificationsEnabled: dto.notificationsEnabled,
          sendTime: dto.sendTime,
          sendDays: dto.sendDays,
          alertDaysBefore: dto.alertDaysBefore,
        },
      });

      await this.auditService.log({
        userId: currentUserId,
        action: 'update',
        entityType: 'SlackConfig',
        entityId: config.id,
        oldValue: existing,
        newValue: config,
      });
    } else {
      config = await this.prisma.slackConfig.create({
        data: {
          webhookUrl: dto.webhookUrl,
          channel: dto.channel,
          notificationsEnabled: dto.notificationsEnabled,
          sendTime: dto.sendTime,
          sendDays: dto.sendDays,
          alertDaysBefore: dto.alertDaysBefore,
        },
      });

      await this.auditService.log({
        userId: currentUserId,
        action: 'create',
        entityType: 'SlackConfig',
        entityId: config.id,
        newValue: config,
      });
    }
    return config;
  }

  async testSlackWebhook(currentUserId: string) {
    const config = await this.getSlackConfig();
    const payload = {
      text: '✅ MKT Hub kết nối thành công!',
      channel: config.channel,
    };

    try {
      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Slack API returned status ${response.status}`);
      }

      await this.prisma.notificationLog.create({
        data: {
          sentAt: new Date(),
          status: 'SUCCESS',
          errorMessage: null,
          overdueCount: 0,
          upcomingCount: 0,
        },
      });

      return { success: true };
    } catch (err: any) {
      await this.prisma.notificationLog.create({
        data: {
          sentAt: new Date(),
          status: 'FAILED',
          errorMessage: err.message,
          overdueCount: 0,
          upcomingCount: 0,
        },
      });
      throw new BadRequestException(`Lỗi gửi Slack Webhook: ${err.message}`);
    }
  }

  async getSlackLogs() {
    return this.prisma.notificationLog.findMany({
      take: 30,
      orderBy: { sentAt: 'desc' },
    });
  }

  // Cron Check and Send slack notifications
  private async checkAndSendSlackNotifications() {
    try {
      const config = await this.prisma.slackConfig.findFirst();
      if (!config || !config.notificationsEnabled) return;

      const now = new Date();
      const currentHHMM = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      // Check if time matches
      if (currentHHMM !== config.sendTime) return;

      // Translate Vietnamese days
      // Sun = CN, Mon = T2, Tue = T3, Wed = T4, Thu = T5, Fri = T6, Sat = T7
      const dayMap: Record<number, string> = {
        0: 'CN',
        1: 'T2',
        2: 'T3',
        3: 'T4',
        4: 'T5',
        5: 'T6',
        6: 'T7',
      };
      const todayCode = dayMap[now.getDay()];
      const activeDays = config.sendDays.split(',');
      if (!activeDays.includes(todayCode)) return;

      // Check if we already sent notification today
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const alreadySent = await this.prisma.notificationLog.findFirst({
        where: {
          sentAt: { gte: startOfDay },
          status: 'SUCCESS',
          overdueCount: { gt: 0 }, // avoid count matching testing webhook
        },
      });
      if (alreadySent) return;

      const endOfUpcoming = new Date(startOfDay.getTime() + config.alertDaysBefore * 24 * 60 * 60 * 1000);
      const [overdueTasks, upcomingTasks] = await Promise.all([
        // Fetch overdue tasks: status not Completed/Done/Cancel, and due date < today
        this.prisma.task.findMany({
          where: {
            status: { notIn: ['Done', 'Completed', 'Cancel', 'Cancelled'] },
            dueDate: { lt: startOfDay },
          },
          include: { assignee: true, project: true },
        }),
        // Fetch upcoming tasks: status not Completed/Done/Cancel, and due date within alertDaysBefore
        this.prisma.task.findMany({
          where: {
            status: { notIn: ['Done', 'Completed', 'Cancel', 'Cancelled'] },
            dueDate: {
              gte: startOfDay,
              lte: endOfUpcoming,
            },
          },
          include: { assignee: true, project: true },
        }),
      ]);

      if (overdueTasks.length === 0 && upcomingTasks.length === 0) return;

      // Format Message
      const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
      let text = `🔔 MKT Hub — Cập nhật Task [${dayMap[now.getDay() === 0 ? 0 : now.getDay() - 1 + 1]} ${dateStr}]\n\n`;

      if (overdueTasks.length > 0) {
        text += `🔴 QUÁ HẠN (${overdueTasks.length} task)\n`;
        for (const task of overdueTasks) {
          const diffDays = Math.ceil((startOfDay.getTime() - new Date(task.dueDate).getTime()) / (24 * 60 * 60 * 1000));
          text += `• ${task.name} — ${task.assignee.name} (${task.project.name}) — Quá hạn ${diffDays} ngày\n`;
        }
        text += `\n`;
      }

      if (upcomingTasks.length > 0) {
        text += `🟡 SẮP ĐẾN HẠN (${upcomingTasks.length} task)\n`;
        for (const task of upcomingTasks) {
          const diffDays = Math.ceil((new Date(task.dueDate).getTime() - startOfDay.getTime()) / (24 * 60 * 60 * 1000));
          const dueDayStr = `${task.dueDate.getDate().toString().padStart(2, '0')}/${(task.dueDate.getMonth() + 1).toString().padStart(2, '0')}`;
          text += `• ${task.name} — ${task.assignee.name} — Còn ${diffDays} ngày (${dueDayStr})\n`;
        }
        text += `\n`;
      }

      text += `👉 Xem chi tiết: [MKT Hub]`;

      // Post to webhook
      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, channel: config.channel }),
      });

      if (this.prisma?.notificationLog?.create) {
        await this.prisma.notificationLog.create({
          data: {
            sentAt: new Date(),
            status: 'SUCCESS',
            overdueCount: overdueTasks.length,
            upcomingCount: upcomingTasks.length,
          },
        });
      }
    } catch (err: any) {
      if (this.prisma?.notificationLog?.create) {
        await this.prisma.notificationLog.create({
          data: {
            sentAt: new Date(),
            status: 'FAILED',
            errorMessage: err.message,
          },
        });
      }
    }
  }

  // --- IMPORT DATA ---
  async parseImportFile(buffer: Buffer, type: 'task' | 'kpi' | 'deal', isCsv: boolean) {
    try {
      const safeBuffer = Buffer.from(buffer);
      const isZip = safeBuffer.length >= 4 && safeBuffer[0] === 0x50 && safeBuffer[1] === 0x4b;
      const shouldUseCsv = isCsv || !isZip;

      const workbook = new ExcelJS.Workbook();
      if (shouldUseCsv) {
        const Readable = require('stream').Readable;
        const stream = new Readable();
        stream.push(safeBuffer);
        stream.push(null);
        await workbook.csv.read(stream);
      } else {
        try {
          await workbook.xlsx.load(safeBuffer as any);
        } catch (loadErr) {
          const Readable = require('stream').Readable;
          const stream = new Readable();
          stream.push(safeBuffer);
          stream.push(null);
          await workbook.csv.read(stream);
        }
      }

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        throw new BadRequestException('File không chứa worksheet nào.');
      }

      const rows: any[] = [];
      const errors: string[] = [];
      // Non-blocking notes (e.g. optional "Ngày bắt đầu" unparseable -> stored empty).
      const warnings: string[] = [];

      // Header validation
      const headerRow = worksheet.getRow(1);
      const headers: string[] = [];
      headerRow.eachCell((cell) => {
        headers.push(String(cell.value || '').trim());
      });

      const expectedHeaders: Record<string, string[]> = {
        task: ['task_name', 'project_id', 'assignee', 'status', 'priority', 'start_date', 'due_date', 'exec_week', 'remark'],
        kpi: ['year', 'week', 'raw_leads', 'mql', 'sql', 'opp_count', 'closed_deal_count'],
        deal: ['year', 'week', 'company_name', 'size', 'project', 'setup_fee', 'monthly_fee', 'closed_date'],
      };

      const expected = expectedHeaders[type];
      if (!expected) {
        throw new BadRequestException(`Loại import "${type}" không hợp lệ. Cho phép: task, kpi, deal`);
      }

      const missing = expected.filter((h) => !headers.includes(h));
      if (missing.length > 0 && !(type === 'task' && missing.includes('project_id'))) {
        // Allow project_id missing for tasks, if selected in interface
        throw new BadRequestException(`Thiếu các cột bắt buộc: ${missing.join(', ')}`);
      }

      // Row iteration
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // skip header

        const rowData: any = {};
        headers.forEach((h, index) => {
          const cell = row.getCell(index + 1);
          let cellVal: any = cell.value;
          if (cellVal && typeof cellVal === 'object') {
            if ('result' in cellVal) cellVal = (cellVal as any).result;
            else if ('text' in cellVal) cellVal = (cellVal as any).text;
            else if (cellVal instanceof Date) cellVal = cellVal.toISOString().split('T')[0];
            else if ('richText' in cellVal) cellVal = (cellVal as any).richText?.map((rt: any) => rt.text).join('') || '';
            else cellVal = String(cellVal);
          }
          if (cellVal === undefined || cellVal === null) {
            cellVal = cell.text || '';
          }
          rowData[h] = cellVal;
        });

        // Basic validations
        const rowErrors: string[] = [];
        if (type === 'task') {
          if (!rowData.task_name) rowErrors.push('Thiếu task_name');
          if (!rowData.assignee) rowErrors.push('Thiếu assignee');
          if (!rowData.due_date) rowErrors.push('Thiếu due_date');
        } else if (type === 'kpi') {
          if (!rowData.year) rowErrors.push('Thiếu year');
          if (!rowData.week) rowErrors.push('Thiếu week');
        } else if (type === 'deal') {
          if (!rowData.company_name) rowErrors.push('Thiếu company_name');
          if (!rowData.size) rowErrors.push('Thiếu size');
          if (!rowData.setup_fee) rowErrors.push('Thiếu setup_fee');
          if (!rowData.monthly_fee) rowErrors.push('Thiếu monthly_fee');
          if (!rowData.closed_date) rowErrors.push('Thiếu closed_date');
        }

        if (type === 'deal') {
          const initiation = pickInitiationDateRaw(rowData);
          if (
            initiation.found &&
            String(initiation.value ?? '').trim() !== '' &&
            !parseFlexibleDate(initiation.value)
          ) {
            warnings.push(
              `Dòng ${rowNumber}: Ngày bắt đầu "${initiation.value}" không hợp lệ, sẽ để trống`,
            );
          }
        }

        if (rowErrors.length > 0) {
          errors.push(`Dòng ${rowNumber}: ${rowErrors.join(', ')}`);
        } else {
          rows.push({
            rowNumber,
            data: rowData,
          });
        }
      });

      return {
        totalRows: Math.max(0, worksheet.rowCount - 1),
        validRows: rows.length,
        errorRows: errors.length,
        errors,
        warnings,
        preview: rows.slice(0, 5).map((r) => r.data),
        allRows: rows,
      };
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`Lỗi đọc file import: ${err?.message || err}`);
    }
  }

  async importConfirm(dto: BulkImportConfirmDto, currentUserId: string) {
    try {
      const importLog = await this.prisma.importLog.create({
        data: {
          importType: dto.importType,
          fileName: 'bulk_import_' + dto.importType,
          totalRows: dto.rows.length,
          validRows: dto.rows.length,
          errorRows: 0,
          createdById: currentUserId,
        },
      });

      let successCount = 0;
      const warnings: string[] = [];

      if (dto.importType === 'task') {
        const projId = dto.projectId;
        if (!projId) throw new BadRequestException('Thiếu projectId đích.');

        for (const row of dto.rows) {
          const assignee = await this.prisma.member.findFirst({
            where: {
              OR: [
                { email: row.assignee },
                { name: row.assignee },
              ],
            },
          });

          if (!assignee) continue;

          const dueDate = new Date(row.due_date);
          const startDate = row.start_date ? new Date(row.start_date) : null;
          const execWeek = row.exec_week ? parseInt(row.exec_week, 10) : 1;

          await this.prisma.task.create({
            data: {
              name: row.task_name,
              projectId: projId,
              assigneeId: assignee.id,
              status: row.status || 'Planning',
              priority: row.priority || 'Medium',
              startDate,
              dueDate,
              execWeek,
              execYear: dueDate.getFullYear(),
              remark: row.remark || null,
            },
          });
          successCount++;
        }
      } else if (dto.importType === 'kpi') {
        for (const row of dto.rows) {
          const year = parseInt(String(row.year || 2026).trim(), 10);
          const week = parseInt(String(row.week || 1).trim(), 10);
          await this.prisma.kpiActual.upsert({
            where: {
              year_week: {
                year: isNaN(year) ? 2026 : year,
                week: isNaN(week) ? 1 : week,
              },
            },
            update: {
              rawLeads: parseInt(String(row.raw_leads || 0).replace(/[^0-9]/g, ''), 10) || 0,
              mql: parseInt(String(row.mql || 0).replace(/[^0-9]/g, ''), 10) || 0,
              sql: parseInt(String(row.sql || 0).replace(/[^0-9]/g, ''), 10) || 0,
              oppCount: parseInt(String(row.opp_count || 0).replace(/[^0-9]/g, ''), 10) || 0,
              closedCount: parseInt(String(row.closed_deal_count || 0).replace(/[^0-9]/g, ''), 10) || 0,
            },
            create: {
              year: isNaN(year) ? 2026 : year,
              week: isNaN(week) ? 1 : week,
              rawLeads: parseInt(String(row.raw_leads || 0).replace(/[^0-9]/g, ''), 10) || 0,
              mql: parseInt(String(row.mql || 0).replace(/[^0-9]/g, ''), 10) || 0,
              sql: parseInt(String(row.sql || 0).replace(/[^0-9]/g, ''), 10) || 0,
              oppCount: parseInt(String(row.opp_count || 0).replace(/[^0-9]/g, ''), 10) || 0,
              closedCount: parseInt(String(row.closed_deal_count || 0).replace(/[^0-9]/g, ''), 10) || 0,
              planRawLeads: 0,
              planMql: 0,
              planSql: 0,
              planOpp: 0,
              planClosedDeal: 0,
              createdById: currentUserId,
            },
          });
          successCount++;
        }
      } else if (dto.importType === 'deal') {
        for (const [rowIndex, row] of dto.rows.entries()) {
          let matchedProj: any = null;
          if (row.project) {
            matchedProj = await this.prisma.project.findFirst({
              where: { name: String(row.project).trim() },
            });
          }

          const setupFeeVal = String(row.setup_fee || 0).replace(/[^0-9.]/g, '') || '0';
          const monthlyFeeVal = String(row.monthly_fee || 0).replace(/[^0-9.]/g, '') || '0';
          const closedDateVal = row.closed_date ? new Date(row.closed_date) : new Date();
          // §3 (26/09/2026): optional "Ngày bắt đầu" column; invalid/empty -> null.
          const initiation = pickInitiationDateRaw(row);
          const initiationDateVal = initiation.found
            ? parseFlexibleDate(initiation.value)
            : null;
          if (
            initiation.found &&
            !initiationDateVal &&
            String(initiation.value ?? '').trim() !== ''
          ) {
            warnings.push(
              `Dòng ${rowIndex + 1}: Ngày bắt đầu "${initiation.value}" không hợp lệ, để trống`,
            );
          }

          await this.prisma.closedDeal.create({
            data: {
              companyName: String(row.company_name || 'N/A'),
              size: String(row.size || 'M'),
              projectId: matchedProj ? matchedProj.id : null,
              setupFee: new Decimal(setupFeeVal),
              monthlyFee: new Decimal(monthlyFeeVal),
              closedDate: isNaN(closedDateVal.getTime()) ? new Date() : closedDateVal,
              initiationDate: initiationDateVal,
              year: parseInt(String(row.year || closedDateVal.getFullYear()), 10) || 2026,
              week: parseInt(String(row.week || 1), 10) || 1,
              createdById: currentUserId,
            },
          });
          successCount++;
        }
      }

      return {
        success: true,
        importLogId: importLog.id,
        imported: successCount,
        ...(warnings.length > 0 ? { warnings } : {}),
      };
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`Lỗi lưu dữ liệu import: ${err?.message || err}`);
    }
  }

  // --- EXPORT PDF & EXCEL ---
  private removeAccents(str: string): string {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }

  async exportPdfWeeklyReport(year: number, week: number, projectId?: string, memberId?: string) {
    const doc = new PDFDocument({ margin: 50 });

    const where: any = { execYear: year, execWeek: week };
    if (projectId) where.projectId = projectId;
    if (memberId) where.assigneeId = memberId;

    const tasks = await this.prisma.task.findMany({
      where,
      include: { assignee: true, project: true },
    });

    const doneTasks = tasks.filter((t) => ['Done', 'Completed'].includes(t.status));
    const planTasks = tasks.filter((t) => ['Planning', 'Processing', 'Pending'].includes(t.status));
    const backlogTasks = tasks.filter((t) => ['Backlog'].includes(t.status));
    const bodSupportTasks = tasks.filter((t) => t.neededSupportBod && t.neededSupportBod.trim().length > 0);

    // Title / Header
    doc.fontSize(20).text(this.removeAccents(`MKT Hub - Bao cao Tuan ${week} nam ${year}`), { align: 'center' });
    doc.moveDown();

    doc.fontSize(14).text('1. CAC TAC VU DA HOAN THANH (DONE)');
    doc.moveDown(0.5);
    if (doneTasks.length === 0) {
      doc.fontSize(10).text('Khong co tac vu nao hoan thanh trong tuan nay.');
    } else {
      doneTasks.forEach((t) => {
        doc.fontSize(10).text(this.removeAccents(`- [${t.project.name}] ${t.name} (Giao cho: ${t.assignee.name})`));
      });
    }
    doc.moveDown();

    doc.fontSize(14).text('2. CAC TAC VU DANG TRIEN KHAI (PLAN)');
    doc.moveDown(0.5);
    if (planTasks.length === 0) {
      doc.fontSize(10).text('Khong co tac vu nao dang len ke hoach.');
    } else {
      planTasks.forEach((t) => {
        doc.fontSize(10).text(this.removeAccents(`- [${t.project.name}] ${t.name} (Trang thai: ${t.status}, Giao cho: ${t.assignee.name})`));
      });
    }
    doc.moveDown();

    doc.fontSize(14).text('3. TAC VU TON DONG (BACKLOG)');
    doc.moveDown(0.5);
    if (backlogTasks.length === 0) {
      doc.fontSize(10).text('Khong co tac vu ton dong.');
    } else {
      backlogTasks.forEach((t) => {
        doc.fontSize(10).text(this.removeAccents(`- [${t.project.name}] ${t.name} (Giao cho: ${t.assignee.name})`));
      });
    }
    doc.moveDown();

    doc.fontSize(14).text('4. HO TRO TU BAN GIAM DOC (BOD SUPPORT)');
    doc.moveDown(0.5);
    if (bodSupportTasks.length === 0) {
      doc.fontSize(10).text('Khong yeu cau ho tro nao tu BOD.');
    } else {
      bodSupportTasks.forEach((t) => {
        doc.fontSize(10).text(this.removeAccents(`- [${t.project.name}] ${t.name}: ${t.neededSupportBod}`));
      });
    }

    doc.end();
    return doc;
  }

  async exportExcelDashboard(year: number, period: string) {
    const workbook = new ExcelJS.Workbook();
    const sheet1 = workbook.addWorksheet('Summary');
    const sheet2 = workbook.addWorksheet('Task List');
    const sheet3 = workbook.addWorksheet('Leads Detail');

    // Sheet 1 - Summary
    sheet1.columns = [
      { header: 'Kỳ báo cáo', key: 'period', width: 20 },
      { header: 'Chỉ số', key: 'metric', width: 25 },
      { header: 'Giá trị', key: 'value', width: 25 },
    ];
    sheet1.addRow({ period, metric: 'Tổng chi phí', value: 'Tính toán từ database' });

    // Sheet 2 - Task List
    sheet2.columns = [
      { header: 'Tên Task', key: 'name', width: 30 },
      { header: 'Dự án', key: 'project', width: 20 },
      { header: 'Người giao', key: 'assignee', width: 20 },
      { header: 'Trạng thái', key: 'status', width: 15 },
      { header: 'Độ ưu tiên', key: 'priority', width: 15 },
      { header: 'Hạn chót', key: 'due', width: 20 },
    ];
    const tasks = await this.prisma.task.findMany({
      include: { project: true, assignee: true },
    });
    tasks.forEach((t) => {
      sheet2.addRow({
        name: t.name,
        project: t.project.name,
        assignee: t.assignee.name,
        status: t.status,
        priority: t.priority,
        due: t.dueDate.toISOString().split('T')[0],
      });
    });

    // Sheet 3 - Leads Detail
    sheet3.columns = [
      { header: 'Công ty', key: 'company', width: 30 },
      { header: 'Quy mô', key: 'size', width: 15 },
      { header: 'Dự án', key: 'project', width: 20 },
      { header: 'Setup Fee', key: 'setup', width: 15 },
      { header: 'Monthly Fee', key: 'monthly', width: 15 },
      { header: 'Ngày chốt', key: 'date', width: 20 },
    ];
    const deals = await this.prisma.closedDeal.findMany({
      where: { archivedAt: null },
      include: { project: true },
    });
    deals.forEach((d) => {
      sheet3.addRow({
        company: d.companyName,
        size: d.size,
        project: d.project ? d.project.name : 'Unknown',
        setup: Number(d.setupFee),
        monthly: Number(d.monthlyFee),
        date: d.closedDate.toISOString().split('T')[0],
      });
    });

    return workbook;
  }

  async exportFullData() {
    const workbook = new ExcelJS.Workbook();

    // Sheet: Projects
    const sProjects = workbook.addWorksheet('Projects');
    sProjects.columns = [
      { header: 'ID', key: 'id', width: 15 },
      { header: 'Tên Project', key: 'name', width: 30 },
      { header: 'Loại', key: 'type', width: 15 },
      { header: 'Trạng thái', key: 'status', width: 15 },
      { header: 'Budget Direct', key: 'bDirect', width: 15 },
      { header: 'Budget Overhead', key: 'bOverhead', width: 15 },
    ];
    const projects = await this.prisma.project.findMany();
    projects.forEach((p) => {
      sProjects.addRow({
        id: p.id,
        name: p.name,
        type: p.type,
        status: p.status,
        bDirect: Number(p.budgetPlanDirect || 0),
        bOverhead: Number(p.budgetPlanOverhead || 0),
      });
    });

    // Sheet: Tasks
    const sTasks = workbook.addWorksheet('Tasks');
    sTasks.columns = [
      { header: 'ID', key: 'id', width: 15 },
      { header: 'Tên Task', key: 'name', width: 30 },
      { header: 'Project ID', key: 'projectId', width: 20 },
      { header: 'Assignee ID', key: 'assigneeId', width: 20 },
      { header: 'Trạng thái', key: 'status', width: 15 },
      { header: 'Độ ưu tiên', key: 'priority', width: 15 },
    ];
    const tasks = await this.prisma.task.findMany();
    tasks.forEach((t) => {
      sTasks.addRow({
        id: t.id,
        name: t.name,
        projectId: t.projectId,
        assigneeId: t.assigneeId,
        status: t.status,
        priority: t.priority,
      });
    });

    // Sheet: Closed_Deals
    const sDeals = workbook.addWorksheet('Closed_Deals');
    const deals = await this.prisma.closedDeal.findMany();
    sDeals.columns = [
      { header: 'Tên Công Ty', key: 'companyName', width: 30 },
      { header: 'Quy Mô', key: 'size', width: 15 },
      { header: 'Setup Fee', key: 'setup', width: 15 },
      { header: 'Monthly Fee', key: 'monthly', width: 15 },
    ];
    deals.forEach((d) => {
      sDeals.addRow({
        companyName: d.companyName,
        size: d.size,
        setup: Number(d.setupFee),
        monthly: Number(d.monthlyFee),
      });
    });

    return workbook;
  }

  // --- BACKUP & RESTORE ---
  async getBackups() {
    const backups = await this.prisma.backupLog.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { name: true } } },
    });
    return backups.map((b) => ({
      ...b,
      fileSize: Number(b.fileSize),
    }));
  }

  async deleteBackup(id: string, currentUserId: string) {
    const backup = await this.prisma.backupLog.findUnique({ where: { id } });
    if (!backup) {
      throw new NotFoundException('Không tìm thấy bản sao lưu (backup) này.');
    }

    if (backup.filePath && fs.existsSync(backup.filePath)) {
      try {
        fs.unlinkSync(backup.filePath);
      } catch (err) {
        // Proceed even if physical file deletion fails
      }
    }

    await this.prisma.backupLog.delete({ where: { id } });

    await this.auditService.log({
      userId: currentUserId,
      action: 'delete',
      entityType: 'BackupLog',
      entityId: id,
      oldValue: backup,
    });

    return { success: true, message: 'Đã xóa bản sao lưu thành công.' };
  }

  async createBackup(currentUserId: string) {
    const backupId = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14);
    const fileName = `mkthub_backup_${backupId}.zip`;
    const filePath = path.join(this.backupDir, fileName);

    const modelsData = {
      members: await this.prisma.member.findMany(),
      dropdownConfigs: await this.prisma.dropdownConfig.findMany(),
      projects: await this.prisma.project.findMany(),
      tasks: await this.prisma.task.findMany(),
      kpiPlans: await this.prisma.kpiPlan.findMany(),
      kpiActuals: await this.prisma.kpiActual.findMany(),
      kpiDistributions: await this.prisma.kpiDistribution.findMany(),
      opportunities: await this.prisma.opportunity.findMany(),
      closedDeals: await this.prisma.closedDeal.findMany(),
      expenseRecords: await this.prisma.expenseRecord.findMany(),
      systemConfigs: await this.prisma.systemConfig.findMany(),
      weeklyReportLogs: await this.prisma.weeklyReportLog.findMany(),
      slackConfigs: await this.prisma.slackConfig.findMany(),
      notificationLogs: await this.prisma.notificationLog.findMany(),
      importLogs: await this.prisma.importLog.findMany(),
      auditLogs: await this.prisma.auditLog.findMany(),
    };

    const zip = new JSZip();
    zip.file('backup_data.json', JSON.stringify(modelsData, null, 2));

    const content = await zip.generateAsync({ type: 'nodebuffer' });
    fs.writeFileSync(filePath, content);

    const log = await this.prisma.backupLog.create({
      data: {
        fileName,
        filePath,
        fileSize: BigInt(content.length),
        createdById: currentUserId,
      },
    });

    return {
      id: log.id,
      fileName: log.fileName,
      fileSize: Number(log.fileSize),
      createdAt: log.createdAt,
    };
  }

  async restoreBackup(buffer: Buffer, currentUserId: string) {
    const zip = new JSZip();
    const contents = await zip.loadAsync(buffer);
    const jsonFile = contents.file('backup_data.json');
    if (!jsonFile) {
      throw new BadRequestException('File backup không chứa backup_data.json hợp lệ.');
    }

    const rawJson = await jsonFile.async('text');
    const data = JSON.parse(rawJson);

    // Clear everything first (in order)
    await this.prisma.auditLog.deleteMany({});
    await this.prisma.task.deleteMany({});
    await this.prisma.expenseRecord.deleteMany({});
    await this.prisma.closedDeal.deleteMany({});
    await this.prisma.opportunity.deleteMany({});
    await this.prisma.project.deleteMany({});
    await this.prisma.dropdownConfig.deleteMany({});
    await this.prisma.kpiActual.deleteMany({});
    await this.prisma.kpiPlan.deleteMany({});
    await this.prisma.systemConfig.deleteMany({});
    await this.prisma.member.deleteMany({});

    // Import from JSON
    // Mapping model fields if necessary
    for (const m of data.members) {
      await this.prisma.member.create({ data: m });
    }
    for (const d of data.dropdownConfigs) {
      await this.prisma.dropdownConfig.create({ data: d });
    }
    for (const p of data.projects) {
      await this.prisma.project.create({ data: p });
    }
    for (const t of data.tasks) {
      await this.prisma.task.create({ data: t });
    }
    for (const kp of data.kpiPlans) {
      await this.prisma.kpiPlan.create({ data: kp });
    }
    for (const ka of data.kpiActuals) {
      await this.prisma.kpiActual.create({ data: ka });
    }
    for (const kd of data.kpiDistributions) {
      await this.prisma.kpiDistribution.create({ data: kd });
    }
    for (const o of data.opportunities) {
      await this.prisma.opportunity.create({ data: o });
    }
    for (const cd of data.closedDeals) {
      await this.prisma.closedDeal.create({ data: cd });
    }
    for (const er of data.expenseRecords) {
      await this.prisma.expenseRecord.create({ data: er });
    }
    for (const sc of data.systemConfigs) {
      await this.prisma.systemConfig.create({ data: sc });
    }

    await this.auditService.log({
      userId: currentUserId,
      action: 'create',
      entityType: 'BackupRestore',
      entityId: currentUserId,
      newValue: { success: true },
    });

    return { success: true, message: 'Restore database thành công.' };
  }

  async resetSandbox(dto: ResetSandboxDto, currentUserId: string) {
    if (dto.confirmText !== 'RESET') {
      throw new BadRequestException('Vui lòng gõ RESET để xác nhận.');
    }

    // Deletes everything except Member and DropdownConfig
    await this.prisma.auditLog.deleteMany({});
    await this.prisma.task.deleteMany({});
    await this.prisma.expenseRecord.deleteMany({});
    await this.prisma.closedDeal.deleteMany({});
    await this.prisma.opportunity.deleteMany({});
    await this.prisma.kpiDistribution.deleteMany({});
    await this.prisma.weeklyReportLog.deleteMany({});
    await this.prisma.project.deleteMany({});
    await this.prisma.kpiPlan.deleteMany({});
    await this.prisma.kpiActual.deleteMany({});
    await this.prisma.systemConfig.deleteMany({});
    await this.prisma.notificationLog.deleteMany({});
    await this.prisma.importLog.deleteMany({});
    await this.prisma.backupLog.deleteMany({});

    await this.auditService.log({
      userId: currentUserId,
      action: 'create',
      entityType: 'ResetSandbox',
      entityId: currentUserId,
      newValue: { success: true },
    });

    return { success: true, message: 'Đã reset sandbox về ban đầu.' };
  }

  // --- AUDIT LOGS VIEWER ---
  async getAuditLogs(
    userId?: string,
    action?: string,
    entityType?: string,
    startDate?: string,
    endDate?: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const where: any = {};
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { user: { select: { name: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // --- TEMPLATE GENERATION ---
  async generateTemplate(type: 'task' | 'kpi' | 'deal') {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Template');

    if (type === 'task') {
      sheet.columns = [
        { header: 'task_name', key: 'task_name', width: 25 },
        { header: 'project_id', key: 'project_id', width: 20 },
        { header: 'assignee', key: 'assignee', width: 20 },
        { header: 'status', key: 'status', width: 15 },
        { header: 'priority', key: 'priority', width: 15 },
        { header: 'start_date', key: 'start_date', width: 15 },
        { header: 'due_date', key: 'due_date', width: 15 },
        { header: 'exec_week', key: 'exec_week', width: 12 },
        { header: 'remark', key: 'remark', width: 20 },
      ];
      sheet.addRow({
        task_name: 'Ví dụ task',
        project_id: '1',
        assignee: 'Nguyen Van A',
        status: 'Planning',
        priority: 'High',
        start_date: '2026-06-15',
        due_date: '2026-06-30',
        exec_week: 26,
        remark: 'Ghi chú',
      });
    } else if (type === 'kpi') {
      sheet.columns = [
        { header: 'year', key: 'year', width: 10 },
        { header: 'week', key: 'week', width: 10 },
        { header: 'raw_leads', key: 'raw_leads', width: 15 },
        { header: 'mql', key: 'mql', width: 10 },
        { header: 'sql', key: 'sql', width: 10 },
        { header: 'opp_count', key: 'opp_count', width: 12 },
        { header: 'closed_deal_count', key: 'closed_deal_count', width: 18 },
      ];
      sheet.addRow({
        year: 2026,
        week: 20,
        raw_leads: 280,
        mql: 112,
        sql: 49,
        opp_count: 10,
        closed_deal_count: 4,
      });
    } else if (type === 'deal') {
      sheet.columns = [
        { header: 'year', key: 'year', width: 10 },
        { header: 'week', key: 'week', width: 10 },
        { header: 'company_name', key: 'company_name', width: 25 },
        { header: 'size', key: 'size', width: 15 },
        { header: 'project', key: 'project', width: 20 },
        { header: 'setup_fee', key: 'setup_fee', width: 15 },
        { header: 'monthly_fee', key: 'monthly_fee', width: 15 },
        { header: 'closed_date', key: 'closed_date', width: 15 },
        { header: 'Ngày bắt đầu', key: 'initiation_date', width: 15 },
      ];
      sheet.addRow({
        year: 2025,
        week: 10,
        company_name: 'Công ty ABC',
        size: 'Enterprise',
        project: 'Lead Generation',
        setup_fee: 50000000,
        monthly_fee: 5000000,
        closed_date: '2025-03-10',
        initiation_date: '2025-01-15',
      });
    }

    return workbook;
  }
}

