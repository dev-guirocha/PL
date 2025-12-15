const { PrismaClient } = require('@prisma/client');

// Singleton para evitar múltiplas conexões em ambiente serverless/hot-reload
const prisma = new PrismaClient();

module.exports = prisma;
