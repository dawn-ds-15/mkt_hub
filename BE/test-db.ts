import { PrismaService } from './src/prisma/prisma.service';
import { userContext } from './src/common/context/user-context';

async function test() {
  const prisma = new PrismaService();
  await prisma.onModuleInit();
  
  const admin = await prisma.member.findFirst();
  if (!admin) {
    console.log('No admin found, please run seeding first.');
    await prisma.$disconnect();
    return;
  }

  console.log('Running test as user:', admin.email);

  await userContext.run({ userId: admin.id }, async () => {
    const key = `test_config_${Date.now()}`;
    console.log('Creating DropdownConfig:', key);
    
    const config = await prisma.dropdownConfig.create({
      data: {
        key,
        label: 'Test Config',
        values: JSON.stringify(['A', 'B']),
      },
    });

    console.log('Created dropdown config ID:', config.id);

    // Wait a brief moment to ensure write finishes
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entityId: config.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log('Found audit logs:', auditLogs);
  });

  await prisma.$disconnect();
}

test();
