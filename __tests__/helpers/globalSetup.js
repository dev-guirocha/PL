const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = async () => {
  const dbPath = path.resolve(__dirname, '../../prisma-test/test.db');
  const schemaPath = path.resolve(__dirname, '../../prisma-test/schema.prisma');

  process.env.DATABASE_URL = process.env.DATABASE_URL || `file:${dbPath}`;
  process.env.DIRECT_DATABASE_URL = process.env.DIRECT_DATABASE_URL || `file:${dbPath}`;
  process.env.SHADOW_DATABASE_URL =
    process.env.SHADOW_DATABASE_URL || `file:${path.resolve(__dirname, '../../prisma-test/test-shadow.db')}`;
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
  process.env.NODE_ENV = 'test';
  process.env.VERCEL = '1';
  process.env.CSRF_TRUSTED_CLIENTS = process.env.CSRF_TRUSTED_CLIENTS || 'mobile';

  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }

  const configPath = path.resolve(__dirname, '../../prisma-test/prisma.config.js');

  execSync(`npx prisma generate --schema ${schemaPath} --config ${configPath}`, {
    stdio: 'inherit',
    env: process.env,
  });

  const migrationsDir = path.resolve(__dirname, '../../prisma-test/migrations');
  const migrationDirs = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  migrationDirs.forEach((dir) => {
    const migrationFile = path.join(migrationsDir, dir, 'migration.sql');
    if (fs.existsSync(migrationFile)) {
      execSync(
        `npx prisma db execute --file ${migrationFile} --schema ${schemaPath} --config ${configPath}`,
        {
          stdio: 'inherit',
          env: process.env,
        },
      );
    }
  });
};
