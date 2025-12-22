// debug-loterias.js
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Buscando apostas sem nome de loteria...');

  const bets = await prisma.bet.findMany({
    where: {
      OR: [{ loteria: null }, { loteria: '' }],
    },
    select: {
      id: true,
      createdAt: true,
      codigoHorario: true,
      total: true,
      user: { select: { name: true, phone: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (bets.length === 0) {
    console.log('✅ Nenhuma aposta sem nome encontrada.');
  } else {
    console.log(`⚠️ Encontradas ${bets.length} apostas sem nome!`);
    console.table(
      bets.map((b) => ({
        ID: b.id,
        Data: b.createdAt.toLocaleString('pt-BR'),
        'Hora/Cod (O SEGREDO ESTÁ AQUI)': b.codigoHorario,
        Valor: b.total,
        Usuario: b.user?.name,
        Telefone: b.user?.phone,
      })),
    );
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => prisma.$disconnect());
