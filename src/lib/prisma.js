const { PrismaClient } = require('@prisma/client');

// Instância simples com logs para atender requisito de opções não vazias
const prisma = new PrismaClient({
  log: ['warn', 'error'],
});

module.exports = prisma;
