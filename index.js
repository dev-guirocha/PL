// index.js
require('dotenv').config(); // Para ler o .env
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./src/routes/authRoutes');
const walletRoutes = require('./src/routes/walletRoutes');
const pixRoutes = require('./src/routes/pixRoutes');
const profileRoutes = require('./src/routes/profileRoutes');
const betRoutes = require('./src/routes/betRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const createCsrfProtection = require('./src/middleware/csrf');

const app = express();

// Configura CORS permitindo apenas domínios autorizados
const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
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
const allowedOrigins = envOrigins.length ? envOrigins : defaultOrigins;

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
app.use(express.json()); // Permite ler JSON no corpo da requisição
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
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

// Exporta o app para runtimes serverless (ex.: Vercel) ou testes
module.exports = app;
