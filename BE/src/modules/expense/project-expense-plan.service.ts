import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { SaveProjectExpensePlanDto } from './dto/project-expense-plan.dto';
import {
  EXPENSE_ERROR_CODES,
  getExpensePermissions,
} from './expense-permissions.helper';

@Injectable()
export class ProjectExpensePlanService {
  constructor(private readonly prisma: PrismaService) {}

  async getProjectExpensePlan(projectId: string, user?: AuthenticatedUser) {
    if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
      throw new BadRequestException('projectId là bắt buộc.');
    }
    const cleanProjectId = projectId.trim();
    const project = await this.prisma.project.findUnique({
      where: { id: cleanProjectId },
      select: { id: true, name: true, status: true, cancelledAt: true },
    });
    if (!project) {
      throw new NotFoundException(`Không tìm thấy dự án ID: ${cleanProjectId}`);
    }

    // Plan and confirmed lines are independent reads: run them concurrently
    // (same start order; if both fail, the plan error is surfaced as before).
    const [planResult, linesResult] = await Promise.allSettled([
      this.prisma.projectExpensePlan.findUnique({
        where: { projectId: cleanProjectId },
        include: {
          items: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          },
        },
      }),
      // Calculate totalActual from confirmed ExpenseLines of this project
      this.prisma.expenseLine.findMany({
        where: {
          expense: { projectId: cleanProjectId },
          status: 'confirmed',
          archivedAt: null,
        },
        select: {
          projectExpenseItemId: true,
          quantity: true,
          actualQuantity: true,
          actualUnitPrice: true,
          unitPriceAfterVatSnapshot: true,
          recognizedDate: true,
        },
      }),
    ]);
    if (planResult.status === 'rejected') throw planResult.reason;
    if (linesResult.status === 'rejected') throw linesResult.reason;
    const plan = planResult.value;
    const confirmedLines = linesResult.value;

    const items = plan?.items || [];
    const totalPlan = Number(plan?.totalPlan || 0);

    // If project was cancelled, only count lines where recognizedDate <= cancelledAt
    let totalActual = 0;
    const actualMap = new Map<string, number>();
    for (const l of confirmedLines) {
      if (project.status === 'Cancelled' && project.cancelledAt && l.recognizedDate) {
        if (new Date(l.recognizedDate) > project.cancelledAt) {
          continue;
        }
      }
      const qty = l.actualQuantity ?? l.quantity ?? 0;
      const price = Number(l.actualUnitPrice || l.unitPriceAfterVatSnapshot || 0);
      const lineTotal = qty * price;
      totalActual += lineTotal;
      if (l.projectExpenseItemId) {
        actualMap.set(
          l.projectExpenseItemId,
          (actualMap.get(l.projectExpenseItemId) || 0) + lineTotal,
        );
      }
    }

    const variance = totalPlan - totalActual;

    return {
      data: {
        projectId: project.id,
        year: plan?.year || new Date().getFullYear(),
        totalPlan,
        totalActual,
        variance,
        projectStatus: project.status,
        cancelledAt: project.cancelledAt,
        items: items.map((i) => {
          const planAmount = Number(i.planAmount || 0);
          const actualAmount = actualMap.get(i.id) || 0;
          return {
            id: i.id,
            source: i.source,
            templateId: i.templateId,
            name: i.name,
            planAmount,
            actualAmount,
            variance: planAmount - actualAmount,
            note: i.note,
            sortOrder: i.sortOrder,
          };
        }),
      },
      permissions: getExpensePermissions(user),
    };
  }

  async saveProjectExpensePlan(
    projectId: string,
    dto: SaveProjectExpensePlanDto,
    user?: AuthenticatedUser,
  ) {
    if (!projectId || typeof projectId !== 'string' || !projectId.trim()) {
      throw new BadRequestException('projectId là bắt buộc.');
    }
    const cleanProjectId = projectId.trim();
    const project = await this.prisma.project.findUnique({
      where: { id: cleanProjectId },
      select: { id: true, status: true },
    });
    if (!project) {
      throw new NotFoundException(`Không tìm thấy dự án ID: ${cleanProjectId}`);
    }

    // Rule: Project Cancelled cannot be edited
    if (project.status === 'Cancelled') {
      throw new UnprocessableEntityException({
        message: 'Không thể chỉnh sửa kế hoạch chi phí khi dự án đã bị hủy (Cancelled).',
        errorCode: EXPENSE_ERROR_CODES.ERR_PROJECT_CANCELLED,
      });
    }

    const totalPlanAmount = dto.items.reduce(
      (sum, item) => sum + Number(item.planAmount || 0),
      0,
    );

    // Upsert project plan
    const plan = await this.prisma.projectExpensePlan.upsert({
      where: { projectId: cleanProjectId },
      create: {
        projectId: cleanProjectId,
        year: Number(dto.year),
        note: dto.note?.trim() || null,
        totalPlan: new Decimal(totalPlanAmount),
      },
      update: {
        year: Number(dto.year),
        note: dto.note?.trim() || null,
        totalPlan: new Decimal(totalPlanAmount),
      },
    });

    // Replace items
    await this.prisma.projectExpensePlanItem.deleteMany({
      where: { planId: plan.id },
    });

    if (dto.items && dto.items.length > 0) {
      await this.prisma.projectExpensePlanItem.createMany({
        data: dto.items.map((itm, idx) => ({
          planId: plan.id,
          source: itm.source || 'custom',
          templateId: itm.templateId || null,
          name: itm.name.trim(),
          planAmount: new Decimal(itm.planAmount || 0),
          note: itm.note?.trim() || null,
          sortOrder: itm.sortOrder !== undefined ? itm.sortOrder : idx,
        })),
      });
    }

    return this.getProjectExpensePlan(projectId, user);
  }
}
