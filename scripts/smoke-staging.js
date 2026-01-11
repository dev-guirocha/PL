#!/usr/bin/env node
const crypto = require('crypto');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const origin = 'http://localhost:5173';
const results = [];

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const run = async (name, fn) => {
  const startedAt = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - startedAt });
  } catch (error) {
    results.push({ name, ok: false, ms: Date.now() - startedAt, error });
  }
};

const ensureSqliteSchema = ({ databaseUrl, resetDatabase }) => {
  const fallbackPath = path.resolve(__dirname, '../prisma-test/smoke.db');
  const resolvedUrl = databaseUrl || `file:${fallbackPath}`;
  const dbPath = resolvedUrl.replace(/^file:/, '');
  const shadowPath = path.resolve(path.dirname(dbPath), 'smoke-shadow.db');

  if (resetDatabase) {
    const cleanupFiles = [
      dbPath,
      `${dbPath}-journal`,
      `${dbPath}-shm`,
      `${dbPath}-wal`,
      shadowPath,
    ];

    cleanupFiles.forEach((file) => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });
  }

  process.env.DATABASE_URL = resolvedUrl;
  if (!process.env.DIRECT_DATABASE_URL) {
    process.env.DIRECT_DATABASE_URL = resolvedUrl;
  }
  if (!process.env.SHADOW_DATABASE_URL) {
    process.env.SHADOW_DATABASE_URL = `file:${shadowPath}`;
  }

  const schemaPath = path.resolve(__dirname, '../prisma-test/schema.prisma');
  const configPath = path.resolve(__dirname, '../prisma-test/prisma.config.js');

  execSync(`npx prisma generate --schema ${schemaPath} --config ${configPath}`, {
    stdio: 'inherit',
    env: process.env,
  });

  const migrationsDir = path.resolve(__dirname, '../prisma-test/migrations');
  const migrationDirs = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (resetDatabase) {
    migrationDirs.forEach((dir) => {
      const migrationFile = path.join(migrationsDir, dir, 'migration.sql');
      if (fs.existsSync(migrationFile)) {
        execSync(
          `npx prisma db execute --file ${migrationFile} --schema ${schemaPath} --config ${configPath}`,
          {
          stdio: 'inherit',
          env: process.env,
          },
        );
      }
    });
  }
};

const signPayload = (payload, secret) =>
  crypto.createHmac('sha256', secret).update(payload).digest('hex');

const getCookies = (res) => res.headers['set-cookie'] || [];

const hasTokenCookie = (cookies) =>
  cookies.some((cookie) => cookie.startsWith('token=') && cookie.includes('HttpOnly'));

const ensurePostgresClient = () => {
  const schemaPath = path.resolve(__dirname, '../schema.prisma');
  const configPath = path.resolve(__dirname, '../prisma.config.js');

  execSync(`npx prisma generate --schema ${schemaPath} --config ${configPath}`, {
    stdio: 'inherit',
    env: process.env,
  });
};

(async () => {
  process.env.VERCEL = '1';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'smoke-secret';
  process.env.RESET_DEBUG = process.env.RESET_DEBUG || 'false';
  process.env.SEND_RESET_CODE_IN_RESPONSE = process.env.SEND_RESET_CODE_IN_RESPONSE || 'false';
  process.env.CSRF_TRUSTED_CLIENTS = process.env.CSRF_TRUSTED_CLIENTS || 'mobile';
  process.env.ALLOW_WOOVI_TEST = process.env.ALLOW_WOOVI_TEST || 'false';
  process.env.WOOVI_WEBHOOK_SECRET = process.env.WOOVI_WEBHOOK_SECRET || 'smoke-webhook-secret';
  process.env.COOKIE_SECURE = process.env.COOKIE_SECURE || 'false';

  const dbUrl = process.env.DATABASE_URL;
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = dbUrl && !dbUrl.startsWith('file:') ? 'staging' : 'test';
  }
  if (!dbUrl) {
    ensureSqliteSchema({ resetDatabase: true });
  } else if (dbUrl.startsWith('file:')) {
    ensureSqliteSchema({ databaseUrl: dbUrl, resetDatabase: false });
  } else {
    ensurePostgresClient();
  }

  let app;
  let prisma;
  let request;
  let signToken;
  let randomPhone;

  const created = {
    userIds: new Set(),
    resultIds: new Set(),
    correlationIds: new Set(),
  };

  const cleanup = async () => {
    if (!prisma) return;
    const userIds = Array.from(created.userIds);
    const resultIds = Array.from(created.resultIds);
    const correlationIds = Array.from(created.correlationIds);

    if (correlationIds.length) {
      await prisma.webhookEvent.deleteMany({
        where: { correlationId: { in: correlationIds } },
      });
    }

    if (userIds.length) {
      await prisma.idempotencyKey.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.transaction.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.pixCharge.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.bet.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }

    if (resultIds.length) {
      await prisma.result.deleteMany({ where: { id: { in: resultIds } } });
    }
  };

  try {
    ({
      app,
      prisma,
      request,
      signToken,
      randomPhone,
    } = require('../__tests__/helpers/smokeUtils'));

    await run('health', async () => {
      const res = await request(app).get('/api/health');
      assert(res.status === 200, `status ${res.status}`);
      assert(res.body?.ok === true, 'payload ok=true');
    });

    await run('auth register/login + cookie', async () => {
      const phone = randomPhone();
      const password = 'Teste!123';
      const registerAgent = request.agent(app);
      const registerRes = await registerAgent
        .post('/api/auth/register')
        .set('Origin', origin)
        .set('X-Client', 'web')
        .send({ name: 'Smoke User', phone, password });

      assert(registerRes.status === 201, `register status ${registerRes.status}`);
      assert(hasTokenCookie(getCookies(registerRes)), 'register set-cookie token');
      if (registerRes.body?.user?.id) created.userIds.add(registerRes.body.user.id);

      const registerMe = await registerAgent.get('/api/wallet/me');
      assert(registerMe.status === 200, `register /wallet/me status ${registerMe.status}`);

      const loginAgent = request.agent(app);
      const loginRes = await loginAgent
        .post('/api/auth/login')
        .set('Origin', origin)
        .set('X-Client', 'web')
        .send({ phone, password });

      assert(loginRes.status === 200, `login status ${loginRes.status}`);
      assert(hasTokenCookie(getCookies(loginRes)), 'login set-cookie token');
      const loginMe = await loginAgent.get('/api/wallet/me');
      assert(loginMe.status === 200, `login /wallet/me status ${loginMe.status}`);
    });

    await run('auth bearer fallback', async () => {
      const phone = randomPhone();
      const password = 'Teste!123';
      const registerRes = await request(app)
        .post('/api/auth/register')
        .set('Origin', origin)
        .set('X-Client', 'web')
        .send({ name: 'Bearer Smoke', phone, password });

      assert(registerRes.status === 201, `register status ${registerRes.status}`);
      if (registerRes.body?.user?.id) created.userIds.add(registerRes.body.user.id);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .set('Origin', origin)
        .set('X-Client', 'web')
        .send({ phone, password });

      assert(loginRes.status === 200, `login status ${loginRes.status}`);
      if (process.env.ALLOW_BEARER_FALLBACK === 'true') {
        assert(loginRes.body?.token, 'login should return token when fallback enabled');
        const meRes = await request(app)
          .get('/api/wallet/me')
          .set('Authorization', `Bearer ${loginRes.body.token}`);
        assert(meRes.status === 200, `bearer /wallet/me status ${meRes.status}`);
      } else {
        assert(!loginRes.body?.token, 'token should be omitted when fallback disabled');
      }
    });

    await run('auth forgot no enum + no code', async () => {
      const userPhone = randomPhone();
      const user = await prisma.user.create({
        data: {
          name: 'Reset Smoke',
          phone: userPhone,
          password: 'hash',
          balance: '0',
          bonus: '0',
        },
      });
      created.userIds.add(user.id);

      const unknownRes = await request(app)
        .post('/api/auth/forgot')
        .set('Origin', origin)
        .send({ phone: randomPhone() });

      assert(unknownRes.status === 200, `unknown status ${unknownRes.status}`);
      assert(!unknownRes.body?.code, 'unknown phone should not return code');
      assert(
        unknownRes.body?.message === 'Se o telefone estiver cadastrado, enviaremos o código.',
        'unknown phone message',
      );

      const knownRes = await request(app)
        .post('/api/auth/forgot')
        .set('Origin', origin)
        .send({ phone: userPhone });

      assert(knownRes.status === 200, `known status ${knownRes.status}`);
      assert(!knownRes.body?.code, 'known phone should not return code');
      assert(
        knownRes.body?.message === 'Se o telefone estiver cadastrado, enviaremos o código.',
        'known phone message',
      );
    });

    await run('idempotency /api/bets', async () => {
      const user = await prisma.user.create({
        data: {
          name: 'Idem Smoke',
          phone: randomPhone(),
          password: 'hash',
          balance: '100.00',
          bonus: '0.00',
        },
      });
      created.userIds.add(user.id);
      const token = signToken(user);

      const payload = {
        loteria: 'TESTE',
        codigoHorario: '23:59',
        dataJogo: '2099-12-31',
        apostas: [
          {
            data: '2099-12-31',
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
        .set('Origin', origin)
        .send(payload);

      assert(res1.status === 201, `first status ${res1.status}`);

      const res2 = await request(app)
        .post('/api/bets')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', key)
        .set('Origin', origin)
        .send(payload);

      assert(res2.status === 200, `second status ${res2.status}`);
      assert(res2.body?.bet?.id === res1.body?.bet?.id, 'same bet id');

      const refreshed = await prisma.user.findUnique({
        where: { id: user.id },
        select: { balance: true },
      });
      assert(refreshed.balance.toFixed(2) === '80.00', 'debit once');

      const diffKey = `idem-diff-${Date.now()}`;
      const res3 = await request(app)
        .post('/api/bets')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', diffKey)
        .set('Origin', origin)
        .send(payload);

      assert(res3.status === 201, `diff first status ${res3.status}`);

      const res4 = await request(app)
        .post('/api/bets')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', diffKey)
        .set('Origin', origin)
        .send({
          ...payload,
          apostas: [
            {
              ...payload.apostas[0],
              valorAposta: 6,
            },
          ],
        });

      assert(res4.status === 409, `diff payload status ${res4.status}`);
    });

    await run('webhook dedupe', async () => {
      const user = await prisma.user.create({
        data: {
          name: 'Webhook Smoke',
          phone: randomPhone(),
          password: 'hash',
          balance: '0.00',
          bonus: '0.00',
        },
      });
      created.userIds.add(user.id);

      const correlationId = `smoke-${Date.now()}`;
      created.correlationIds.add(correlationId);

      const pixCharge = await prisma.pixCharge.create({
        data: {
          userId: user.id,
          amount: '10.00',
          status: 'PENDING',
          credited: false,
          correlationId,
        },
      });

      const payload = {
        charge: {
          status: 'PAID',
          correlationID: pixCharge.correlationId,
          value: 1000,
          paymentMethods: { pix: { txId: `TX-SMOKE-${Date.now()}` } },
        },
      };

      const raw = JSON.stringify(payload);
      const signature = signPayload(raw, process.env.WOOVI_WEBHOOK_SECRET);
      const eventId = `event-${pixCharge.correlationId}`;

      const res1 = await request(app)
        .post('/api/webhook/openpix')
        .set('x-openpix-signature', signature)
        .set('x-openpix-event-id', eventId)
        .set('Content-Type', 'application/json')
        .send(raw);

      assert(res1.status === 200, `first webhook status ${res1.status}`);

      const res2 = await request(app)
        .post('/api/webhook/openpix')
        .set('x-openpix-signature', signature)
        .set('x-openpix-event-id', eventId)
        .set('Content-Type', 'application/json')
        .send(raw);

      assert(res2.status === 200, `second webhook status ${res2.status}`);

      const refreshed = await prisma.user.findUnique({
        where: { id: user.id },
        select: { balance: true },
      });
      assert(refreshed.balance.toFixed(2) === '10.00', 'credited once');
    });

    await run('woovi-test blocked', async () => {
      const user = await prisma.user.create({
        data: {
          name: 'Woovi Smoke',
          phone: randomPhone(),
          password: 'hash',
          balance: '0.00',
          bonus: '0.00',
          isAdmin: false,
        },
      });
      created.userIds.add(user.id);
      const token = signToken(user);

      const res = await request(app)
        .get('/api/pix/woovi-test')
        .set('Authorization', `Bearer ${token}`);

      assert([403, 404].includes(res.status), `status ${res.status}`);
    });

    await run('settle + recheck concurrency', async () => {
      const admin = await prisma.user.create({
        data: {
          name: 'Admin Smoke',
          phone: randomPhone(),
          password: 'hash',
          isAdmin: true,
          balance: '0.00',
          bonus: '0.00',
        },
      });
      created.userIds.add(admin.id);
      const adminToken = signToken(admin);

      const user = await prisma.user.create({
        data: {
          name: 'Player Smoke',
          phone: randomPhone(),
          password: 'hash',
          balance: '0.00',
          bonus: '0.00',
        },
      });
      created.userIds.add(user.id);

      const result = await prisma.result.create({
        data: {
          loteria: 'TESTE',
          codigoHorario: '10:00',
          dataJogo: '2099-02-15',
          numeros: JSON.stringify(['0012']),
        },
      });
      created.resultIds.add(result.id);

      const bet = await prisma.bet.create({
        data: {
          userId: user.id,
          loteria: 'TESTE',
          codigoHorario: '10:00',
          dataJogo: '2099-02-15',
          modalidade: 'DEZENA',
          colocacao: '1 PREMIO',
          total: '10.00',
          prize: '0.00',
          status: 'open',
          palpites: JSON.stringify([
            {
              modalidade: 'DEZENA',
              colocacao: '1 PREMIO',
              palpites: ['12'],
              total: 10,
            },
          ]),
          resultId: null,
        },
      });

      const settleUrl = `/api/admin/results/${result.id}/settle`;
      const recheckUrl = `/api/admin/bets/${bet.id}/recheck`;

      const [settleRes, recheckRes] = await Promise.all([
        request(app)
          .post(settleUrl)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('Origin', origin),
        request(app)
          .post(recheckUrl)
          .set('Authorization', `Bearer ${adminToken}`)
          .set('Origin', origin),
      ]);

      assert(
        [settleRes.status, recheckRes.status].includes(200),
        `statuses ${settleRes.status}/${recheckRes.status}`,
      );

      const refreshedUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { balance: true },
      });
      const refreshedBet = await prisma.bet.findUnique({
        where: { id: bet.id },
        select: { prize: true, prizeCreditedAt: true },
      });

      assert(refreshedBet.prizeCreditedAt, 'prizeCreditedAt set');
      assert(
        refreshedUser.balance.toFixed(2) === refreshedBet.prize.toFixed(2),
        'credited once',
      );
    });
  } catch (error) {
    results.push({ name: 'smoke runner', ok: false, ms: 0, error });
  } finally {
    try {
      await cleanup();
    } catch (error) {
      results.push({ name: 'cleanup', ok: false, ms: 0, error });
    }
    try {
      await prisma?.$disconnect();
    } catch (error) {
      results.push({ name: 'disconnect', ok: false, ms: 0, error });
    }
  }

  const passed = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  console.log('\nSmoke summary');
  passed.forEach((entry) => {
    console.log(`OK   ${entry.name} (${entry.ms}ms)`);
  });
  failed.forEach((entry) => {
    console.log(`FAIL ${entry.name} (${entry.ms}ms)`);
    console.log(`  ${entry.error?.message || entry.error}`);
  });

  if (failed.length) {
    process.exit(1);
  }
})();
