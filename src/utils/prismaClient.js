const { PrismaClient } = require('@prisma/client');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL não definido. Configure o .env antes de iniciar o servidor.');
}

const isStagingEnv = process.env.NODE_ENV === 'staging'
  || process.env.RAILWAY_ENVIRONMENT === 'staging'
  || process.env.RAILWAY_ENVIRONMENT_NAME === 'staging';

if (isStagingEnv && !connectionString.startsWith('file:')) {
  try {
    const host = new URL(connectionString).host;
    if (host) {
      console.log(`[Prisma][staging] DB host: ${host}`);
    }
  } catch {
    console.log('[Prisma][staging] DB host: unknown');
  }
}

const isSqlite = connectionString.startsWith('file:');
const globalForPrisma = global.prisma || {};

if (isSqlite) {
  const adapterLib = require('@prisma/adapter-better-sqlite3');
  const PrismaBetterSQLite3 = adapterLib.PrismaBetterSQLite3 || adapterLib.PrismaBetterSqlite3;
  if (!PrismaBetterSQLite3) {
    throw new Error('Prisma BetterSQLite3 adapter não encontrado.');
  }

  const adapter = globalForPrisma.adapter || new PrismaBetterSQLite3({ url: connectionString });

  const prisma = globalForPrisma.client || new PrismaClient({
    adapter,
    log: ['warn', 'error'],
  });
  if (process.env.NODE_ENV !== 'production') {
    global.prisma = { client: prisma, adapter };
  }
  module.exports = prisma;
} else {
  const { Pool } = require('pg');
  const { PrismaPg } = require('@prisma/adapter-pg');

  // Reutiliza pool/adapter no modo dev para evitar recriar conexões em hot-reload
  const pool = globalForPrisma.pool || new Pool({ connectionString });
  const adapter = globalForPrisma.adapter || new PrismaPg(pool);

  const prisma = globalForPrisma.client || new PrismaClient({
    adapter,
    log: ['warn', 'error'],
  });
  if (process.env.NODE_ENV !== 'production') {
    global.prisma = { client: prisma, pool, adapter };
  }

  module.exports = prisma;
}
