// index.js
require('dotenv').config(); // Para ler o .env
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const prisma = require('./src/utils/prismaClient');
const authRoutes = require('./src/routes/authRoutes');
const walletRoutes = require('./src/routes/walletRoutes');
const pixRoutes = require('./src/routes/pixRoutes');
const profileRoutes = require('./src/routes/profileRoutes');
const betRoutes = require('./src/routes/betRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const webhookController = require('./src/controllers/webhookController');
const createCsrfProtection = require('./src/middleware/csrf');
const { startCleanupJobs } = require('./src/services/cleanupService');

const app = express();

// Necessário atrás de proxies (Railway/Vercel) para rate-limit e cookies funcionarem corretamente
// Use número de hops ou rede loopback para não acionar alerta do express-rate-limit
app.set('trust proxy', 1);

const SLOW_REQUEST_MS = Number(process.env.SLOW_REQUEST_MS || 1000);
const LOG_ALL_REQUESTS = process.env.LOG_ALL_REQUESTS === 'true';

const withTimeout = (promise, ms) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED_REJECTION]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT_EXCEPTION]', err);
});

// Configura CORS permitindo apenas domínios autorizados
const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5174',
  'https://www.pandaloterias.com',
  'https://pandaloterias.com',
];
const envOrigins = (process.env.FRONTEND_URL || process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const wildcardOrigins = [
  /\.vercel\.app$/,
  /\.up\.railway\.app$/,
];
const allowAnyOrigin = process.env.ALLOW_ANY_ORIGIN === 'true';
// Une origens padrão com as fornecidas por ambiente para não bloquear localhost durante QA
const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

app.use(helmet());
app.use(compression());

// Loga requisições lentas (ou todas, se habilitado via env)
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    if (req.path === '/api/health') return;
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    if (LOG_ALL_REQUESTS || durationMs >= SLOW_REQUEST_MS) {
      console.log(
        `[REQ] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms`,
      );
    }
  });
  next();
});

app.use(
  cors({
    origin: (origin, callback) => {
      if (allowAnyOrigin) return callback(null, true);
      // Permite ferramentas sem origin (Postman, curl) e origens explicitamente permitidas
      const isListed = origin && allowedOrigins.includes(origin);
      const matchesWildcard = origin && wildcardOrigins.some((re) => re.test(origin));
      if (!origin || isListed || matchesWildcard) {
        return callback(null, true);
      }
      // Retorna false para evitar erro 500 em preflight; o browser irá bloquear se não houver header de CORS
      return callback(null, false);
    },
    credentials: true,
    optionsSuccessStatus: 204,
  }),
); // Deixa o Front-end falar com o Back-end
// Preserva rawBody para validação de assinatura do webhook
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
}));

// Webhook deve ficar antes do CSRF para não ser bloqueado
app.post('/api/webhook/openpix', webhookController.handleOpenPixWebhook);

// Demais rotas protegidas por CSRF
app.use(createCsrfProtection(allowedOrigins, wildcardOrigins));

// Limitadores de requisição para mitigar brute force e spam
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas de login. Tente novamente mais tarde.' },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
});

app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);

// Usa as rotas que criamos
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/pix', pixRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/bets', betRoutes);
app.use('/api/admin', adminRoutes);

// Healthcheck com ping no banco
app.get('/api/health', async (req, res) => {
  const payload = {
    ok: false,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    db: { ok: false, latencyMs: null, error: null },
  };

  const timeoutMs = Number(process.env.HEALTH_DB_TIMEOUT_MS || 2000);
  const start = Date.now();
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, timeoutMs);
    payload.db.ok = true;
    payload.db.latencyMs = Date.now() - start;
    payload.ok = true;
    return res.status(200).json(payload);
  } catch (err) {
    payload.db.ok = false;
    payload.db.latencyMs = Date.now() - start;
    payload.db.error = err?.message || 'db_error';
    return res.status(503).json(payload);
  }
});

// Handler final de erro para logar falhas não tratadas
app.use((err, req, res, next) => {
  console.error('[UNHANDLED_ERROR]', {
    method: req.method,
    path: req.originalUrl,
    message: err?.message,
  });
  res.status(500).json({ error: 'Erro interno.' });
});

const PORT = process.env.PORT || 3000;

if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  startCleanupJobs();
}

// Só sobe o servidor localmente (Railway/localhost). Em serverless (Vercel), apenas exportamos o app.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
  });
}

// Exporta o app para runtimes serverless (ex.: Vercel) ou testes
module.exports = app;
