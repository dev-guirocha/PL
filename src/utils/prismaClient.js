// Força engine binária antes de carregar o client, evitando exigir adapter/accelerate
if (!process.env.PRISMA_CLIENT_ENGINE_TYPE) {
  process.env.PRISMA_CLIENT_ENGINE_TYPE = 'binary';
}

const { PrismaClient } = require('@prisma/client');

// Singleton simples do Prisma Client (sem adapter/accelerate)
const prisma = global.prisma || new PrismaClient({ log: ['warn', 'error'] });
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

module.exports = prisma;
