const { PrismaClient } = require('@prisma/client');

// Força engine binária (evita exigir adapter/accelerate em ambientes client/edge)
if (!process.env.PRISMA_CLIENT_ENGINE_TYPE) {
  process.env.PRISMA_CLIENT_ENGINE_TYPE = 'binary';
}

// Instância simples com logs para atender requisito de opções não vazias
const prisma = new PrismaClient({
  log: ['warn', 'error'],
});

module.exports = prisma;
