require('dotenv/config');
const crypto = require('crypto');

const prisma = require('./src/utils/prismaClient');

async function main() {
  const rows = await prisma.pixCharge.findMany({
    where: { correlationId: null },
    select: { id: true },
  });

  for (const r of rows) {
    await prisma.pixCharge.update({
      where: { id: r.id },
      data: { correlationId: `pix-legacy-${crypto.randomUUID()}` },
    });
  }

  console.log(`OK: preenchidos ${rows.length} correlationId`);
}

main()
  .catch(err => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    if (global.prisma?.pool) {
      await global.prisma.pool.end();
    }
  });
