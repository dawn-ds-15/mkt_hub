const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Fix companyName on Opportunity
  await prisma.opportunity.update({
    where: { id: '00000005-0000-4000-8000-000000000101' },
    data: { companyName: 'Indochina Travel' }
  });
  console.log('Fixed Opportunity companyName to Indochina Travel');

  // 2. Unarchive Closed Deal
  await prisma.closedDeal.update({
    where: { id: '00000006-0000-4000-8000-000000000061' },
    data: { archivedAt: null, archivedBy: null }
  });
  console.log('Unarchived Closed Deal Indochina Travel');
}

main().catch(console.error).finally(() => prisma.$disconnect());
