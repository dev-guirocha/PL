const jwt = require('jsonwebtoken');
const request = require('supertest');

const prisma = require('../../src/utils/prismaClient');
const app = require('../../index');

const signToken = (user) => jwt.sign(
  { userId: user.id, isAdmin: user.isAdmin },
  process.env.JWT_SECRET,
);

const randomPhone = () => {
  const suffix = String(Date.now() % 1e8).padStart(8, '0');
  return `119${suffix}`;
};

module.exports = {
  app,
  prisma,
  request,
  signToken,
  randomPhone,
};
