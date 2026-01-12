const request = require('supertest');

const randomPhone = () => {
  const seed = `${Date.now()}${process.pid}${Math.floor(Math.random() * 1000)}`;
  return `119${seed.slice(-8).padStart(8, '0')}`;
};

describe('auth cookie domain (production config)', () => {
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL,
    SMOKE: process.env.SMOKE,
  };
  let app;
  let prisma;

  beforeAll(() => {
    jest.resetModules();
    process.env.NODE_ENV = 'production';
    process.env.VERCEL = '1';
    delete process.env.SMOKE;
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

    prisma = require('../src/utils/prismaClient');
    app = require('../index');
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
    process.env.NODE_ENV = originalEnv.NODE_ENV;
    process.env.VERCEL = originalEnv.VERCEL;
    process.env.SMOKE = originalEnv.SMOKE;
  });

  test('register sets cookie with domain and secure flags', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', 'https://www.pandaloterias.com')
      .send({ name: 'Cookie Domain', phone: randomPhone(), password: 'Teste!123' });

    expect(res.status).toBe(201);
    const cookies = res.headers['set-cookie'] || [];
    const cookieHeader = cookies.join(' | ');
    expect(cookieHeader).toContain('Domain=.pandaloterias.com');
    expect(cookieHeader).toContain('Path=/');
    expect(cookieHeader).toMatch(/SameSite=None/);
    expect(cookieHeader).toMatch(/Secure/);
  });
});
