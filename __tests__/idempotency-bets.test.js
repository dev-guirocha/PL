const { Prisma } = require('@prisma/client');
const { app, prisma, request, signToken, randomPhone } = require('./helpers/testUtils');

const futureDate = () => {
  const dt = new Date('2099-12-31T00:00:00Z');
  return dt.toISOString().slice(0, 10);
};

describe('POST /api/bets idempotency', () => {
  let user;
  let token;

  beforeAll(async () => {
    user = await prisma.user.create({
      data: {
        name: 'Idem User',
        phone: randomPhone(),
        password: 'hash',
        balance: new Prisma.Decimal('100.00'),
        bonus: new Prisma.Decimal('0.00'),
      },
    });
    token = signToken(user);
  });

  afterAll(async () => {
    if (user?.id) {
      await prisma.idempotencyKey.deleteMany({ where: { userId: user.id } });
      await prisma.bet.deleteMany({ where: { userId: user.id } });
      await prisma.transaction.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    await prisma.$disconnect();
  });

  test('same Idempotency-Key returns same betId and debits once', async () => {
    const payload = {
      loteria: 'TESTE',
      codigoHorario: '23:59',
      dataJogo: futureDate(),
      apostas: [
        {
          data: futureDate(),
          modalidade: 'DEZENA',
          colocacao: '1 PREMIO',
          palpites: ['12', '34'],
          modoValor: 'cada',
          valorAposta: 10,
        },
      ],
    };

    const key = `idem-${Date.now()}`;

    const res1 = await request(app)
      .post('/api/bets')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .set('Origin', 'http://localhost:5173')
      .send(payload);

    expect(res1.status).toBe(201);

    const res2 = await request(app)
      .post('/api/bets')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .set('Origin', 'http://localhost:5173')
      .send(payload);

    expect(res2.status).toBe(200);
    expect(res2.body.bet.id).toBe(res1.body.bet.id);

    const refreshed = await prisma.user.findUnique({ where: { id: user.id }, select: { balance: true } });
    expect(refreshed.balance.toFixed(2)).toBe('80.00');
  });

  test('same Idempotency-Key with different payload returns 409', async () => {
    const payload = {
      loteria: 'TESTE',
      codigoHorario: '23:59',
      dataJogo: futureDate(),
      apostas: [
        {
          data: futureDate(),
          modalidade: 'DEZENA',
          colocacao: '1 PREMIO',
          palpites: ['10', '20'],
          modoValor: 'cada',
          valorAposta: 5,
        },
      ],
    };

    const key = `idem-diff-${Date.now()}`;

    const res1 = await request(app)
      .post('/api/bets')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .set('Origin', 'http://localhost:5173')
      .send(payload);

    expect(res1.status).toBe(201);

    const res2 = await request(app)
      .post('/api/bets')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .set('Origin', 'http://localhost:5173')
      .send({
        ...payload,
        apostas: [
          {
            ...payload.apostas[0],
            valorAposta: 6,
          },
        ],
      });

    expect(res2.status).toBe(409);
  });
});
