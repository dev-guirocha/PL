require('dotenv/config');
const { defineConfig, env } = require('prisma/config');

module.exports = defineConfig({
  schema: './schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
    directUrl: process.env.DIRECT_URL || process.env.DIRECT_DATABASE_URL,
    shadowDatabaseUrl: env('SHADOW_DATABASE_URL'),
  },
});
