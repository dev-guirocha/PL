const { Prisma } = require('@prisma/client');
const { app, prisma, request, randomPhone } = require('./helpers/testUtils');

describe('POST /api/auth/forgot (production behavior)', () => {
  let user;
  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    RESET_DEBUG: process.env.RESET_DEBUG,
    SEND_RESET_CODE_IN_RESPONSE: process.env.SEND_RESET_CODE_IN_RESPONSE,
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'production';
    process.env.RESET_DEBUG = 'false';
    process.env.SEND_RESET_CODE_IN_RESPONSE = 'false';

    user = await prisma.user.create({
      data: {
        name: 'Reset User',
        phone: randomPhone(),
        password: 'hash',
        balance: new Prisma.Decimal('0.00'),
        bonus: new Prisma.Decimal('0.00'),
      },
    });
  });

  afterAll(async () => {
    if (user?.id) {
      await prisma.user.delete({ where: { id: user.id } });
    }
    await prisma.$disconnect();
    process.env.NODE_ENV = originalEnv.NODE_ENV;
    process.env.RESET_DEBUG = originalEnv.RESET_DEBUG;
    process.env.SEND_RESET_CODE_IN_RESPONSE = originalEnv.SEND_RESET_CODE_IN_RESPONSE;
  });

  test('does not enumerate unknown phone', async () => {
    const res = await request(app)
      .post('/api/auth/forgot')
      .set('Origin', 'http://localhost:5173')
      .send({ phone: randomPhone() });

    expect(res.status).toBe(200);
    expect(res.body.code).toBeUndefined();
    expect(res.body.message).toBe('Se o telefone estiver cadastrado, enviaremos o código.');
  });

  test('does not expose reset code in production', async () => {
    const res = await request(app)
      .post('/api/auth/forgot')
      .set('Origin', 'http://localhost:5173')
      .send({ phone: user.phone });

    expect(res.status).toBe(200);
    expect(res.body.code).toBeUndefined();
    expect(res.body.message).toBe('Se o telefone estiver cadastrado, enviaremos o código.');
  });
});
