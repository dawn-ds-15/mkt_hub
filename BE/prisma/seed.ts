import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('Migrating data from core, finance, marketing, sys_admin schemas to public schema...');

  // Helper to map integer ID to UUID
  const toUuid = (prefix: number, id: number | string) => {
    const num = Number(id);
    if (isNaN(num)) return id.toString(); // already UUID
    return `${prefix.toString().padStart(8, '0')}-0000-4000-8000-${num.toString().padStart(12, '0')}`;
  };

  // 1. Clear existing public tables in order of dependencies
  console.log('Clearing existing data in public schema...');
  await prisma.auditLog.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.dropdownConfig.deleteMany({});
  await prisma.kpiActual.deleteMany({});
  await prisma.kpiPlan.deleteMany({});
  await prisma.closedDeal.deleteMany({});
  await prisma.opportunity.deleteMany({});
  await prisma.expenseRecord.deleteMany({});
  await prisma.systemConfig.deleteMany({});
  await prisma.member.deleteMany({});

  // 2. Migrate members
  const rawMembers: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM core.members`);
  for (const m of rawMembers) {
    const id = toUuid(0, m.id);
    await prisma.member.create({
      data: {
        id,
        memberId: Number(m.id),
        name: m.name,
        email: m.email,
        passwordHash: m.password_hash || '$2b$10$sBMD1MV1.A2W7pzHOeo/A.2qAg91lnkOSBLLAbDUazodu/ojRZF/u', // default demo123
        role: m.role,
        avatarUrl: m.avatar_url,
        isActive: m.is_active === '1' || m.is_active === true || m.is_active === 1,
        createdAt: new Date(m.created_at),
        updatedAt: new Date(m.updated_at || m.created_at),
      },
    });
  }
  console.log(`Migrated ${rawMembers.length} members.`);

  // 3. Migrate dropdowns
  const rawDropdowns: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM core.dropdowns`);
  const dropdownGroup = new Map<string, string[]>();
  for (const d of rawDropdowns) {
    if (!dropdownGroup.has(d.category)) {
      dropdownGroup.set(d.category, []);
    }
    dropdownGroup.get(d.category)!.push(d.value);
  }
  for (const [key, values] of dropdownGroup.entries()) {
    await prisma.dropdownConfig.create({
      data: {
        key,
        label: key === 'project_status' ? 'Trạng thái Project' : key === 'task_status' ? 'Trạng thái Task' : key === 'task_priority' ? 'Độ ưu tiên Task' : key === 'project_type' ? 'Loại Project' : key === 'company_size' ? 'Phân khúc Khách hàng' : key,
        values: JSON.stringify(values),
      },
    });
  }
  console.log(`Migrated ${dropdownGroup.size} dropdown configs.`);

  // 4. Migrate projects
  const rawProjects: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM core.projects`);
  for (const p of rawProjects) {
    const id = toUuid(1, p.id);
    const ownerId = toUuid(0, p.owner_id);

    const typeRow = rawDropdowns.find((d) => Number(d.id) === Number(p.project_type_id));
    const statusRow = rawDropdowns.find((d) => Number(d.id) === Number(p.status_id));

    await prisma.project.create({
      data: {
        id,
        name: p.project_name,
        type: typeRow ? typeRow.value : 'Internal',
        status: statusRow ? statusRow.value : 'Planning',
        ownerId,
        deadline: p.planned_end_date ? new Date(p.planned_end_date) : null,
        budgetPlanDirect: p.budget_plan,
        actualCostDirect: p.actual_cost,
        createdAt: new Date(p.created_at),
        updatedAt: new Date(p.updated_at || p.created_at),
      },
    });
  }
  console.log(`Migrated ${rawProjects.length} projects.`);

  // 5. Migrate tasks
  const rawTasks: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM core.tasks`);
  for (const t of rawTasks) {
    const id = toUuid(2, t.id);
    const projectId = toUuid(1, t.project_id);
    const assigneeId = toUuid(0, t.assignee_id);

    const statusRow = rawDropdowns.find((d) => Number(d.id) === Number(t.status_id));
    const priorityRow = rawDropdowns.find((d) => Number(d.id) === Number(t.priority_id));

    const stRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT * FROM core.task_stakeholders WHERE task_id = $1`,
      t.id,
    );
    const stakeholders = [];
    for (const st of stRows) {
      const dropRow = rawDropdowns.find((d) => Number(d.id) === Number(st.stakeholder_id));
      if (dropRow) stakeholders.push(dropRow.value);
    }

    await prisma.task.create({
      data: {
        id,
        name: t.task_name,
        description: t.description,
        projectId,
        assigneeId,
        stakeholders: stakeholders.length ? JSON.stringify(stakeholders) : null,
        status: statusRow ? statusRow.value : 'To Do',
        priority: priorityRow ? priorityRow.value : 'Medium',
        startDate: t.start_date ? new Date(t.start_date) : null,
        dueDate: new Date(t.due_date),
        completedDate: t.completed_date ? new Date(t.completed_date) : null,
        execWeek: t.exec_week,
        execYear: new Date(t.due_date).getFullYear(),
        reason: t.reason,
        neededSupportBod: t.needed_support_bod,
        link: t.link,
        remark: t.remark,
        createdAt: new Date(t.created_at),
        updatedAt: new Date(t.updated_at || t.created_at),
      },
    });
  }
  console.log(`Migrated ${rawTasks.length} tasks.`);

  // 6. Migrate KPI Plans
  const rawKpiPlans: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM marketing.kpi_plans`);
  const adminMember = rawMembers[0] ? toUuid(0, rawMembers[0].id) : toUuid(0, 1);
  for (const kp of rawKpiPlans) {
    const id = toUuid(3, kp.id);
    await prisma.kpiPlan.create({
      data: {
        id,
        year: Number(kp.year),
        totalRawLeads: Number(kp.raw_leads_plan),
        targetMql: Number(kp.mql_plan),
        targetSql: Number(kp.sql_plan),
        targetOpp: Number(kp.opp_plan),
        targetClosedDeal: Number(kp.closed_deal_plan),
        targetPipelineVal: Number(kp.pipeline_value_plan),
        targetWonVal: Number(kp.won_value_plan),
        createdById: adminMember,
        createdAt: new Date(kp.created_at),
        updatedAt: new Date(kp.updated_at || kp.created_at),
      },
    });
  }
  console.log(`Migrated ${rawKpiPlans.length} KPI plans.`);

  // 7. Migrate KPI Actuals
  const rawKpiActuals: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM marketing.kpi_actuals`);
  for (const ka of rawKpiActuals) {
    const planRow = rawKpiPlans.find((p) => Number(p.id) === Number(ka.plan_id)) || rawKpiPlans[0];
    const year = planRow ? Number(planRow.year) : 2026;
    const id = toUuid(4, ka.id);
    await prisma.kpiActual.create({
      data: {
        id,
        year,
        week: Number(ka.week),
        rawLeads: Number(ka.raw_leads),
        mql: Number(ka.mql),
        sql: Number(ka.sql),
        oppCount: Number(ka.opp),
        closedCount: Number(ka.closed_deal),
        planRawLeads: planRow ? Math.round(Number(planRow.raw_leads_plan) / 52) : 0,
        planMql: planRow ? Math.round(Number(planRow.mql_plan) / 52) : 0,
        planSql: planRow ? Math.round(Number(planRow.sql_plan) / 52) : 0,
        planOpp: planRow ? Math.round(Number(planRow.opp_plan) / 52) : 0,
        planClosedDeal: planRow ? Math.round(Number(planRow.closed_deal_plan) / 52) : 0,
        createdById: adminMember,
        createdAt: new Date(ka.created_at),
        updatedAt: new Date(ka.updated_at || ka.created_at),
      },
    });
  }
  console.log(`Migrated ${rawKpiActuals.length} KPI actuals.`);

  // 8. Migrate Opportunities
  const rawOpps: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM marketing.opportunities`);
  for (const o of rawOpps) {
    const id = toUuid(5, o.id);
    const projectId = o.project_id ? toUuid(1, o.project_id) : null;
    const ownerId = toUuid(0, o.owner_id);
    const sizeRow = rawDropdowns.find((d) => Number(d.id) === Number(o.company_size_id));
    const statusRow = rawDropdowns.find((d) => Number(d.id) === Number(o.status_id));

    await prisma.opportunity.create({
      data: {
        id,
        companyName: o.company_name,
        size: sizeRow ? sizeRow.value : 'Medium',
        projectId,
        setupFee: Number(o.pipeline_value) * 0.2, // mock distribution
        monthlyFee: Number(o.pipeline_value) * 0.8 / 12,
        expectedCloseDate: o.expected_close_date ? new Date(o.expected_close_date) : null,
        status: statusRow ? statusRow.value.toLowerCase() : 'active',
        year: o.expected_close_date ? new Date(o.expected_close_date).getFullYear() : 2026,
        week: o.expected_close_date ? 29 : 29, // default week
        createdById: ownerId,
        createdAt: new Date(o.created_at),
        updatedAt: new Date(o.updated_at || o.created_at),
      },
    });
  }
  console.log(`Migrated ${rawOpps.length} opportunities.`);

  // 9. Migrate Closed Deals
  const rawClosedDeals: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM marketing.closed_deals`);
  for (const cd of rawClosedDeals) {
    const id = toUuid(6, cd.id);
    const projectId = cd.project_id ? toUuid(1, cd.project_id) : null;
    const opportunityId = cd.opportunity_id ? toUuid(5, cd.opportunity_id) : null;
    const sizeRow = rawDropdowns.find((d) => Number(d.id) === Number(cd.company_size_id));
    
    // Find creator from opportunity or default to admin
    let ownerId = adminMember;
    if (opportunityId) {
      const opp = rawOpps.find(o => toUuid(5, o.id) === opportunityId);
      if (opp) ownerId = toUuid(0, opp.owner_id);
    }

    await prisma.closedDeal.create({
      data: {
        id,
        companyName: cd.company_name,
        size: sizeRow ? sizeRow.value : 'Medium',
        projectId,
        setupFee: Number(cd.setup_fee),
        monthlyFee: Number(cd.monthly_fee),
        closedDate: new Date(cd.closed_date),
        year: new Date(cd.closed_date).getFullYear(),
        week: 29, // default week
        opportunityId,
        createdById: ownerId,
        createdAt: new Date(cd.created_at),
        updatedAt: new Date(cd.updated_at || cd.created_at),
      },
    });
  }
  console.log(`Migrated ${rawClosedDeals.length} closed deals.`);

  // 10. Migrate Expense Records
  const rawExpenses: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM finance.project_expenses`);
  for (const ex of rawExpenses) {
    const id = toUuid(7, ex.id);
    const projectId = toUuid(1, ex.project_id);
    const createdBy = ex.created_by ? toUuid(0, ex.created_by) : adminMember;

    await prisma.expenseRecord.create({
      data: {
        id,
        projectId,
        month: Number(ex.expense_month),
        year: Number(ex.expense_year),
        directCost: Number(ex.direct_cost),
        directNotes: ex.direct_note,
        overheadCost: Number(ex.overhead_cost),
        overheadNotes: ex.overhead_note,
        createdById: createdBy,
        createdAt: new Date(ex.created_at),
        updatedAt: new Date(ex.updated_at || ex.created_at),
      },
    });
  }
  console.log(`Migrated ${rawExpenses.length} expense records.`);

  // 11. Migrate System Configs (from expense_settings)
  const rawConfigs: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM finance.expense_settings`);
  for (const c of rawConfigs) {
    const createdBy = c.created_by ? toUuid(0, c.created_by) : adminMember;
    
    // Migrate churn_rate
    await prisma.systemConfig.create({
      data: {
        key: 'churn_rate',
        periodType: c.period_type,
        year: Number(c.created_at ? new Date(c.created_at).getFullYear() : 2026),
        periodValue: c.period_value ? Number(c.period_value) : null,
        value: Number(c.churn_rate),
        effectiveFrom: new Date(c.created_at),
        notes: c.note,
        createdById: createdBy,
      }
    });

    // Migrate gross_margin
    await prisma.systemConfig.create({
      data: {
        key: 'gross_margin',
        periodType: c.period_type,
        year: Number(c.created_at ? new Date(c.created_at).getFullYear() : 2026),
        periodValue: c.period_value ? Number(c.period_value) : null,
        value: Number(c.gross_margin),
        effectiveFrom: new Date(c.created_at),
        notes: c.note,
        createdById: createdBy,
      }
    });
  }
  console.log(`Migrated ${rawConfigs.length * 2} system configs.`);

  console.log('Data migration complete! Ready to render dashboard!');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
