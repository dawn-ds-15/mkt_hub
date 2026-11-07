const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const opps = await prisma.opportunity.findMany({
    where: {
      companyName: { contains: 'Indochina', mode: 'insensitive' }
    }
  });
  console.log('Opportunities matching Indochina:', opps);

  const deals = await prisma.closedDeal.findMany({
    where: {
      companyName: { contains: 'Indochina', mode: 'insensitive' }
    }
  });
  console.log('Closed Deals matching Indochina:', deals);
}

main().catch(console.error).finally(() => prisma.$disconnect());
