const { PrismaClient } = require('@prisma/client');

// Singleton com configuração explícita para evitar erros de inicialização
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: ['error', 'warn'],
});

module.exports = prisma;
