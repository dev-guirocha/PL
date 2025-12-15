// Evita engine "client"/"edge" exigindo adapter: força binário antes de criar o client
process.env.PRISMA_CLIENT_ENGINE_TYPE = 'binary';

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['warn', 'error'],
});

module.exports = prisma;
