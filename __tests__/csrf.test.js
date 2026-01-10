const { Prisma } = require('@prisma/client');
const { app, prisma, request, signToken, randomPhone } = require('./helpers/testUtils');

describe('CSRF hardening', () => {
  let user;
  let token;

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        name: 'CSRF User',
        phone: randomPhone(),
        password: 'hash',
        balance: new Prisma.Decimal('100.00'),
        bonus: new Prisma.Decimal('0.00'),
      },
    });
    token = signToken(user);
  });

  afterAll(async () => {
    if (user?.id) await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  });

  test('blocks missing origin/referer without trusted client', async () => {
    const res = await request(app)
      .post('/api/wallet/withdraw')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 10, cpf: '12345678901' });

    expect(res.status).toBe(403);
  });

  test('allows missing origin with bearer + X-Client=mobile', async () => {
    const res = await request(app)
      .post('/api/wallet/withdraw')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Client', 'mobile')
      .send({ amount: 10, cpf: '12345678901' });

    expect(res.status).not.toBe(403);
  });
});
