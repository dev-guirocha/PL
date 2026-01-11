const path = require('path');

const workerId = process.env.JEST_WORKER_ID || '0';
const dbPath = path.resolve(__dirname, `../../prisma-test/test-${workerId}.db`);

process.env.DATABASE_URL = process.env.DATABASE_URL || `file:${dbPath}`;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.VERCEL = '1';
process.env.NODE_ENV = 'test';
process.env.CSRF_TRUSTED_CLIENTS = process.env.CSRF_TRUSTED_CLIENTS || 'mobile';

const jwt = require('jsonwebtoken');
const request = require('supertest');

const prisma = require('../../src/utils/prismaClient');
const app = require('../../index');

const signToken = (user) => jwt.sign({ userId: user.id, isAdmin: user.isAdmin }, process.env.JWT_SECRET);

let phoneCounter = 0;
const randomPhone = () => {
  phoneCounter += 1;
  const seed = `${Date.now()}${process.pid}${phoneCounter}${Math.floor(Math.random() * 1000)}`;
  const suffix = seed.slice(-8).padStart(8, '0');
  return `119${suffix}`;
};

module.exports = {
  app,
  prisma,
  request,
  signToken,
  randomPhone,
};
