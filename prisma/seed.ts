import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create Default Manager
  const defaultEmail = 'admin@mkthub.com';
  const defaultPassword = 'admin123';
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  const admin = await prisma.member.upsert({
    where: { email: defaultEmail },
    update: {},
        create: {
      memberId: 1,
      name: 'Quy Vu',
      email: defaultEmail,
      passwordHash: hashedPassword,
      role: 'manager',
      isActive: true,
      avatarUrl: 'https://ui-avatars.com/api/?name=Quy+Vu&background=random&color=fff',
    },
  });

  console.log(`Created default manager: ${admin.email}`);

  // Create Default DropdownConfigs
  const dropdowns = [
    {
      key: 'project_type',
      label: 'Loại Project',
      values: JSON.stringify([
        'Lead Generation',
        'Online Campaign',
        'Workshop',
        'Event',
        'Exhibition',
        'Webinar',
        'Awards',
        'Production',
      ]),
    },
    {
      key: 'project_status',
      label: 'Trạng thái Project',
      values: JSON.stringify(['Planning', 'Active', 'On Hold', 'Completed', 'Cancelled']),
    },
    {
      key: 'task_status',
      label: 'Trạng thái Task',
      values: JSON.stringify(['Planning', 'Processing', 'Done', 'Pending', 'Backlog', 'Cancel']),
    },
    {
      key: 'task_priority',
      label: 'Độ ưu tiên Task',
      values: JSON.stringify(['High', 'Medium', 'Low']),
    },
    {
      key: 'company_size',
      label: 'Phân khúc Khách hàng',
      values: JSON.stringify(['Enterprise', 'Medium']),
    },
    {
      key: 'stakeholder',
      label: 'Stakeholders',
      values: JSON.stringify(['BOD', 'Sales Team', 'Dev Team', 'CS Team']),
    },
  ];

  for (const d of dropdowns) {
    await prisma.dropdownConfig.upsert({
      where: { key: d.key },
      update: {
        label: d.label,
        values: d.values,
      },
      create: d,
    });
  }

  console.log('Seeded default dropdown configs.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
