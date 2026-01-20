const { Prisma } = require('@prisma/client');
const { app, prisma, request, signToken, randomPhone } = require('./helpers/testUtils');

const FIXED_DATE = '2099-01-15';
const ORIGIN = 'http://localhost:5173';

describe('Admin manual compare + PT RIO x MALUQ', () => {
  let admin;
  let adminToken;
  let user;
  let resultPtRio;
  let betPtRio;
  let betMaluq;
  let manualResult;
  let manualBet;

  beforeAll(async () => {
    admin = await prisma.user.create({
      data: {
        name: 'Admin User',
        phone: randomPhone(),
        password: 'hash',
        isAdmin: true,
        balance: new Prisma.Decimal('0.00'),
        bonus: new Prisma.Decimal('0.00'),
      },
    });
    adminToken = signToken(admin);

    user = await prisma.user.create({
      data: {
        name: 'Player User',
        phone: randomPhone(),
        password: 'hash',
        balance: new Prisma.Decimal('0.00'),
        bonus: new Prisma.Decimal('0.00'),
      },
    });

    resultPtRio = await prisma.result.create({
      data: {
        loteria: 'RIO/FEDERAL',
        codigoHorario: 'LT PT RIO 09HS',
        dataJogo: FIXED_DATE,
        numeros: JSON.stringify(['0012']),
      },
    });

    const apostaBase = {
      modalidade: 'DEZENA',
      colocacao: '1 PREMIO',
      palpites: ['12'],
      total: 10,
    };

    betPtRio = await prisma.bet.create({
      data: {
        userId: user.id,
        loteria: 'RIO/FEDERAL',
        codigoHorario: 'LT PT RIO 09HS',
        dataJogo: FIXED_DATE,
        modalidade: 'DEZENA',
        colocacao: '1 PREMIO',
        total: new Prisma.Decimal('10.00'),
        prize: new Prisma.Decimal('0.00'),
        status: 'open',
        palpites: JSON.stringify([apostaBase]),
      },
    });

    betMaluq = await prisma.bet.create({
      data: {
        userId: user.id,
        loteria: 'RIO/FEDERAL',
        codigoHorario: 'LT MALUQ RIO 09HS',
        dataJogo: FIXED_DATE,
        modalidade: 'DEZENA',
        colocacao: '1 PREMIO',
        total: new Prisma.Decimal('10.00'),
        prize: new Prisma.Decimal('0.00'),
        status: 'open',
        palpites: JSON.stringify([apostaBase]),
      },
    });

    manualResult = await prisma.result.create({
      data: {
        loteria: 'RIO/FEDERAL',
        codigoHorario: 'LT PT RIO 10HS',
        dataJogo: FIXED_DATE,
        numeros: JSON.stringify(['0012']),
      },
    });

    manualBet = await prisma.bet.create({
      data: {
        userId: user.id,
        loteria: 'RIO/FEDERAL',
        codigoHorario: 'LT PT RIO 10HS',
        dataJogo: FIXED_DATE,
        modalidade: 'DEZENA',
        colocacao: '1 PREMIO',
        total: new Prisma.Decimal('10.00'),
        prize: new Prisma.Decimal('0.00'),
        status: 'open',
        palpites: JSON.stringify([apostaBase]),
      },
    });
  });

  afterAll(async () => {
    await prisma.manualSettlement.deleteMany({});
    if (manualBet?.id) await prisma.bet.delete({ where: { id: manualBet.id } });
    if (betPtRio?.id) await prisma.bet.delete({ where: { id: betPtRio.id } });
    if (betMaluq?.id) await prisma.bet.delete({ where: { id: betMaluq.id } });
    if (manualResult?.id) await prisma.result.delete({ where: { id: manualResult.id } });
    if (resultPtRio?.id) await prisma.result.delete({ where: { id: resultPtRio.id } });
    if (user?.id) {
      await prisma.transaction.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    if (admin?.id) await prisma.user.delete({ where: { id: admin.id } });
    await prisma.$disconnect();
  });

  test('settle does not cross MALUQ with PT RIO', async () => {
    const response = await request(app)
      .post(`/api/admin/results/${resultPtRio.id}/settle`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Origin', ORIGIN);

    expect(response.status).toBe(200);

    const refreshedPtRio = await prisma.bet.findUnique({ where: { id: betPtRio.id } });
    const refreshedMaluq = await prisma.bet.findUnique({ where: { id: betMaluq.id } });

    expect(refreshedPtRio.status).not.toBe('open');
    expect(refreshedMaluq.status).toBe('open');
  });

  test('manual compare + settle creates audit and blocks repetition', async () => {
    const preview = await request(app)
      .post(`/api/admin/bets/${manualBet.id}/manual-compare`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Origin', ORIGIN)
      .send({ resultId: manualResult.id });

    expect(preview.status).toBe(200);
    expect(preview.body.wouldWin).toBe(true);
    expect(Number(preview.body.prize)).toBeGreaterThan(0);

    const settle = await request(app)
      .post(`/api/admin/bets/${manualBet.id}/manual-settle`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Origin', ORIGIN)
      .send({ resultId: manualResult.id, action: 'PAY', reason: 'Teste manual' });

    expect(settle.status).toBe(200);
    expect(settle.body.ok).toBe(true);

    const updated = await prisma.bet.findUnique({ where: { id: manualBet.id } });
    const audit = await prisma.manualSettlement.findFirst({ where: { betId: manualBet.id, action: 'PAY' } });

    expect(updated.status).toBe('paid');
    expect(updated.prize.toFixed(2)).toBe(settle.body.prize);
    expect(audit).not.toBeNull();

    const repeat = await request(app)
      .post(`/api/admin/bets/${manualBet.id}/manual-settle`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Origin', ORIGIN)
      .send({ resultId: manualResult.id, action: 'PAY', reason: 'Teste manual' });

    expect(repeat.status).toBe(409);
  });
});
