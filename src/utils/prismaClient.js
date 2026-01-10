const { PrismaClient } = require('@prisma/client');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL não definido. Configure o .env antes de iniciar o servidor.');
}

if (process.env.NODE_ENV === 'staging' && !connectionString.startsWith('file:')) {
  try {
    const host = new URL(connectionString).host;
    if (host) {
      console.log(`[DB] host=${host}`);
    }
  } catch {
    console.log('[DB] host=unknown');
  }
}

const isSqlite = connectionString.startsWith('file:');
const globalForPrisma = global.prisma || {};

if (isSqlite) {
  const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

  const adapter = globalForPrisma.adapter || new PrismaBetterSqlite3({ url: connectionString });

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
