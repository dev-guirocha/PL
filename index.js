// index.js
require('dotenv').config(); // Para ler o .env
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const authRoutes = require('./src/routes/authRoutes');
const walletRoutes = require('./src/routes/walletRoutes');
const pixRoutes = require('./src/routes/pixRoutes');
const profileRoutes = require('./src/routes/profileRoutes');
const betRoutes = require('./src/routes/betRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const webhookController = require('./src/controllers/webhookController');
const createCsrfProtection = require('./src/middleware/csrf');

const app = express();

// Necessário atrás de proxies (Railway/Vercel) para rate-limit e cookies funcionarem corretamente
// Use número de hops ou rede loopback para não acionar alerta do express-rate-limit
app.set('trust proxy', 1);

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

// Healthcheck simples para validar deploy/back-end
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;

// Só sobe o servidor localmente (Railway/localhost). Em serverless (Vercel), apenas exportamos o app.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
  });
}

// Exporta o app para runtimes serverless (ex.: Vercel) ou testes
module.exports = app;
