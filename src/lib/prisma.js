const { PrismaClient } = require('@prisma/client');

// Em alguns ambientes (edge/client engine) o Prisma exige engineType diferente.
// Garantimos o uso do engine binário padrão para aceitar a config de datasource do schema.
if (!process.env.PRISMA_CLIENT_ENGINE_TYPE) {
  process.env.PRISMA_CLIENT_ENGINE_TYPE = 'binary';
}

const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

module.exports = prisma;
