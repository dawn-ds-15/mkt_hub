import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const IDS = {
  leadProject: '10000000-0000-4000-8000-000000000001',
  workshopProject: '10000000-0000-4000-8000-000000000002',
  campaignProject: '10000000-0000-4000-8000-000000000003',
  completedProject: '10000000-0000-4000-8000-000000000004',
};

async function upsertMember(name: string, email: string, role: string) {
  const existing = await prisma.member.findUnique({ where: { email } });
  if (existing) {
    return prisma.member.update({
      where: { email },
      data: { name, role, isActive: true },
    });
  }
  const max = await prisma.member.findFirst({ orderBy: { memberId: 'desc' } });
  return prisma.member.create({
    data: {
      memberId: (max?.memberId ?? 0) + 1,
      name,
      email,
      passwordHash: await bcrypt.hash('demo123', 10),
      role,
      isActive: true,
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`,
    },
  });
}

async function main() {
  console.log('Seeding demo data for ISO week 29/2026...');

  const admin = await upsertMember('Quy Vu', 'admin@mkthub.com', 'manager');
  const alice = await upsertMember(
    'Alice Nguyen',
    'alice@mkthub.com',
    'specialist',
  );
  const bob = await upsertMember('Bob Tran', 'bob@mkthub.com', 'specialist');
  const carol = await upsertMember(
    'Carol Le',
    'carol@mkthub.com',
    'specialist',
  );

  const projects = [
    {
      id: IDS.leadProject,
      name: '[DEMO] SEO & Inbound 2026',
      type: 'Lead Generation',
      status: 'Active',
      ownerId: alice.id,
      deadline: null,
      budgetPlanDirect: 120000000,
      budgetPlanOverhead: 40000000,
      actualCostDirect: 72000000,
      actualCostOverhead: 21000000,
      kpiRawLeadsPlan: 500,
      kpiRawLeadsActual: 420,
      kpiMqlPlan: 180,
      kpiMqlActual: 160,
      kpiSqlPlan: 80,
      kpiSqlActual: 72,
      kpiOppPlan: 30,
      kpiOppActual: 25,
      kpiClosedDealPlan: 8,
      kpiClosedDealActual: 6,
      kpiPipelineValuePlan: 900000000,
      kpiPipelineValueActual: 760000000,
    },
    {
      id: IDS.workshopProject,
      name: '[DEMO] Workshop AI for Business',
      type: 'Workshop',
      status: 'Active',
      ownerId: bob.id,
      deadline: new Date('2026-07-31T00:00:00.000Z'),
      budgetPlanDirect: 80000000,
      budgetPlanOverhead: 15000000,
      actualCostDirect: 55000000,
      actualCostOverhead: 12000000,
      kpiRawLeadsPlan: 250,
      kpiRawLeadsActual: 210,
      kpiMqlPlan: 100,
      kpiMqlActual: 88,
      kpiSqlPlan: 40,
      kpiSqlActual: 35,
      kpiOppPlan: 15,
      kpiOppActual: 12,
      kpiClosedDealPlan: 4,
      kpiClosedDealActual: 3,
      kpiPipelineValuePlan: 450000000,
      kpiPipelineValueActual: 390000000,
    },
    {
      id: IDS.campaignProject,
      name: '[DEMO] Q3 Product Campaign',
      type: 'Online Campaign',
      status: 'Planning',
      ownerId: carol.id,
      deadline: new Date('2026-09-30T00:00:00.000Z'),
      budgetPlanDirect: 200000000,
      budgetPlanOverhead: 30000000,
      actualCostDirect: 0,
      actualCostOverhead: 0,
    },
    {
      id: IDS.completedProject,
      name: '[DEMO] Webinar Q2 Recap',
      type: 'Webinar',
      status: 'Completed',
      ownerId: admin.id,
      deadline: new Date('2026-06-30T00:00:00.000Z'),
      budgetPlanDirect: 30000000,
      budgetPlanOverhead: 5000000,
      actualCostDirect: 28000000,
      actualCostOverhead: 5000000,
    },
  ];

  for (const project of projects) {
    await prisma.project.upsert({
      where: { id: project.id },
      update: project,
      create: { ...project, createdBy: admin.id },
    });
  }

  const tasks = [
    {
      id: '20000000-0000-4000-8000-000000000001',
      name: '[DEMO] Audit technical SEO',
      projectId: IDS.leadProject,
      assigneeId: alice.id,
      status: 'Processing',
      priority: 'High',
      startDate: new Date('2026-07-06T00:00:00.000Z'),
      dueDate: new Date('2026-07-10T00:00:00.000Z'),
      completedDate: null,
      execWeek: 29,
      execYear: 2026,
      stakeholders: JSON.stringify(['Dev Team']),
      reason: null,
      neededSupportBod: null,
      remark: 'Task quá hạn để test alert đỏ',
    },
    {
      id: '20000000-0000-4000-8000-000000000002',
      name: '[DEMO] Publish pillar content',
      projectId: IDS.leadProject,
      assigneeId: bob.id,
      status: 'Processing',
      priority: 'Medium',
      startDate: new Date('2026-07-13T00:00:00.000Z'),
      dueDate: new Date('2026-07-16T00:00:00.000Z'),
      completedDate: null,
      execWeek: 29,
      execYear: 2026,
      stakeholders: JSON.stringify(['Sales Team']),
      reason: null,
      neededSupportBod: null,
      remark: 'Task sắp hạn để test alert vàng',
    },
    {
      id: '20000000-0000-4000-8000-000000000003',
      name: '[DEMO] Finalize workshop agenda',
      projectId: IDS.workshopProject,
      assigneeId: bob.id,
      status: 'Done',
      priority: 'High',
      startDate: new Date('2026-07-06T00:00:00.000Z'),
      dueDate: new Date('2026-07-13T00:00:00.000Z'),
      completedDate: new Date('2026-07-12T09:00:00.000Z'),
      execWeek: 29,
      execYear: 2026,
      stakeholders: JSON.stringify(['BOD', 'Sales Team']),
      reason: null,
      neededSupportBod: null,
      remark: 'Hiển thị trong Weekly Report mục Done',
    },
    {
      id: '20000000-0000-4000-8000-000000000004',
      name: '[DEMO] Confirm keynote speaker',
      projectId: IDS.workshopProject,
      assigneeId: carol.id,
      status: 'Backlog',
      priority: 'High',
      startDate: new Date('2026-07-07T00:00:00.000Z'),
      dueDate: new Date('2026-07-18T00:00:00.000Z'),
      completedDate: null,
      execWeek: 29,
      execYear: 2026,
      stakeholders: JSON.stringify(['BOD']),
      reason: 'Đang chờ diễn giả xác nhận lịch',
      neededSupportBod: 'Cần BOD giới thiệu diễn giả dự phòng',
      remark: 'Test BR-001 và BR-002',
    },
    {
      id: '20000000-0000-4000-8000-000000000005',
      name: '[DEMO] Send attendee invitations',
      projectId: IDS.workshopProject,
      assigneeId: alice.id,
      status: 'Planning',
      priority: 'Medium',
      startDate: new Date('2026-07-20T00:00:00.000Z'),
      dueDate: new Date('2026-07-23T00:00:00.000Z'),
      completedDate: null,
      execWeek: 30,
      execYear: 2026,
      stakeholders: JSON.stringify(['Sales Team']),
      reason: null,
      neededSupportBod: null,
      remark: 'Hiển thị ở kế hoạch tuần kế tiếp',
    },
    {
      id: '20000000-0000-4000-8000-000000000006',
      name: '[DEMO] Build Q3 campaign brief',
      projectId: IDS.campaignProject,
      assigneeId: carol.id,
      status: 'Planning',
      priority: 'Low',
      startDate: new Date('2026-07-20T00:00:00.000Z'),
      dueDate: new Date('2026-07-30T00:00:00.000Z'),
      completedDate: null,
      execWeek: 30,
      execYear: 2026,
      stakeholders: JSON.stringify(['BOD', 'Sales Team']),
      reason: null,
      neededSupportBod: 'Duyệt trần ngân sách campaign Q3',
      remark: null,
    },
    {
      id: '20000000-0000-4000-8000-000000000007',
      name: '[DEMO] Export webinar leads',
      projectId: IDS.completedProject,
      assigneeId: alice.id,
      status: 'Done',
      priority: 'Low',
      startDate: new Date('2026-06-22T00:00:00.000Z'),
      dueDate: new Date('2026-06-26T00:00:00.000Z'),
      completedDate: new Date('2026-06-25T09:00:00.000Z'),
      execWeek: 26,
      execYear: 2026,
      stakeholders: JSON.stringify(['Sales Team']),
      reason: null,
      neededSupportBod: null,
      remark: null,
    },
  ];

  for (const task of tasks) {
    await prisma.task.upsert({
      where: { id: task.id },
      update: task,
      create: task,
    });
  }

  const distributions = [
    {
      projectId: IDS.leadProject,
      type: 'plan',
      rawLeads: 125,
      mql: 45,
      sql: 20,
      oppCount: 8,
      closedCount: 2,
      pipelineValue: 225000000,
      wonValue: 90000000,
    },
    {
      projectId: IDS.leadProject,
      type: 'actual',
      rawLeads: 108,
      mql: 39,
      sql: 18,
      oppCount: 7,
      closedCount: 2,
      pipelineValue: 205000000,
      wonValue: 85000000,
    },
    {
      projectId: IDS.workshopProject,
      type: 'plan',
      rawLeads: 80,
      mql: 32,
      sql: 14,
      oppCount: 5,
      closedCount: 2,
      pipelineValue: 150000000,
      wonValue: 60000000,
    },
    {
      projectId: IDS.workshopProject,
      type: 'actual',
      rawLeads: 72,
      mql: 28,
      sql: 12,
      oppCount: 4,
      closedCount: 1,
      pipelineValue: 125000000,
      wonValue: 45000000,
    },
  ];

  for (const item of distributions) {
    await prisma.kpiDistribution.upsert({
      where: {
        year_week_projectId_type: {
          year: 2026,
          week: 29,
          projectId: item.projectId,
          type: item.type,
        },
      },
      update: item,
      create: { ...item, year: 2026, week: 29 },
    });
  }

  await prisma.expenseRecord.upsert({
    where: {
      projectId_month_year: {
        projectId: IDS.leadProject,
        month: 7,
        year: 2026,
      },
    },
    update: {
      directCost: 18000000,
      overheadCost: 6000000,
      directNotes: 'SEO tools + content',
      overheadNotes: 'Nhân sự phân bổ',
    },
    create: {
      projectId: IDS.leadProject,
      month: 7,
      year: 2026,
      directCost: 18000000,
      overheadCost: 6000000,
      directNotes: 'SEO tools + content',
      overheadNotes: 'Nhân sự phân bổ',
      createdById: admin.id,
    },
  });
  await prisma.expenseRecord.upsert({
    where: {
      projectId_month_year: {
        projectId: IDS.workshopProject,
        month: 7,
        year: 2026,
      },
    },
    update: {
      directCost: 55000000,
      overheadCost: 12000000,
      directNotes: 'Venue + media',
      overheadNotes: 'Nhân sự tổ chức',
    },
    create: {
      projectId: IDS.workshopProject,
      month: 7,
      year: 2026,
      directCost: 55000000,
      overheadCost: 12000000,
      directNotes: 'Venue + media',
      overheadNotes: 'Nhân sự tổ chức',
      createdById: admin.id,
    },
  });

  const deals = [
    {
      id: '30000000-0000-4000-8000-000000000001',
      companyName: '[DEMO] Acme Vietnam',
      size: 'Enterprise',
      projectId: IDS.leadProject,
      setupFee: 120000000,
      monthlyFee: 45000000,
      closedDate: new Date('2026-07-14T00:00:00.000Z'),
    },
    {
      id: '30000000-0000-4000-8000-000000000002',
      companyName: '[DEMO] Nova Retail',
      size: 'Medium',
      projectId: IDS.workshopProject,
      setupFee: 60000000,
      monthlyFee: 25000000,
      closedDate: new Date('2026-07-16T00:00:00.000Z'),
    },
  ];
  for (const deal of deals) {
    await prisma.closedDeal.upsert({
      where: { id: deal.id },
      update: deal,
      create: { ...deal, year: 2026, week: 29, createdById: admin.id },
    });
  }

  const configs = [
    {
      id: '40000000-0000-4000-8000-000000000001',
      key: 'churn_rate',
      value: 0.05,
    },
    {
      id: '40000000-0000-4000-8000-000000000002',
      key: 'gross_margin',
      value: 0.8,
    },
  ];
  for (const config of configs) {
    await prisma.systemConfig.upsert({
      where: { id: config.id },
      update: {
        value: config.value,
        effectiveFrom: new Date('2026-07-13T00:00:00.000Z'),
      },
      create: {
        ...config,
        periodType: 'week',
        year: 2026,
        periodValue: 29,
        effectiveFrom: new Date('2026-07-13T00:00:00.000Z'),
        notes: '[DEMO] Dashboard week 29',
        createdById: admin.id,
      },
    });
  }

  console.log('Demo seed complete.');
  console.log('Manager: admin@mkthub.com / admin123');
  console.log('Specialists: alice|bob|carol@mkthub.com / demo123');
  console.log('Use Dashboard filter: week 29, year 2026');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
