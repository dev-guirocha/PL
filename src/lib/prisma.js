const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL não definido. Configure o .env antes de iniciar o servidor.');
}

const globalForPrisma = global.prisma || {};
const pool = globalForPrisma.pool || new Pool({ connectionString });
const adapter = globalForPrisma.adapter || new PrismaPg(pool);

const prisma = globalForPrisma.client || new PrismaClient({ adapter, log: ['warn', 'error'] });
if (process.env.NODE_ENV !== 'production') {
  global.prisma = { client: prisma, pool, adapter };
}

module.exports = prisma;
