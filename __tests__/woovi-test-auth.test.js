const { Prisma } = require('@prisma/client');
const { app, prisma, request, signToken, randomPhone } = require('./helpers/testUtils');

describe('GET /api/pix/woovi-test access control', () => {
  let user;
  let token;

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        name: 'Woovi User',
        phone: randomPhone(),
        password: 'hash',
        balance: new Prisma.Decimal('0.00'),
        bonus: new Prisma.Decimal('0.00'),
        isAdmin: false,
      },
    });
    token = signToken(user);
  });

  afterAll(async () => {
    if (user?.id) {
      await prisma.user.delete({ where: { id: user.id } });
    }
    await prisma.$disconnect();
  });

  test('rejects non-admin access', async () => {
    const res = await request(app)
      .get('/api/pix/woovi-test')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:5173');

    expect(res.status).toBe(403);
  });
});
