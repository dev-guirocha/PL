const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

// Singleton de Pool para evitar múltiplas conexões em ambientes serverless
const pool = global.pgPool || new Pool({ connectionString: process.env.DATABASE_URL });
if (process.env.NODE_ENV !== 'production') {
  global.pgPool = pool;
}

// Singleton do Prisma Client (com adapter PG)
const prisma = global.prisma || new PrismaClient({ adapter: new PrismaPg(pool) });
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

module.exports = prisma;
