// index.js
require('dotenv').config(); // Para ler o .env
const express = require('express');
const cors = require('cors');
const authRoutes = require('./src/routes/authRoutes');
const walletRoutes = require('./src/routes/walletRoutes');
const pixRoutes = require('./src/routes/pixRoutes');
const profileRoutes = require('./src/routes/profileRoutes');
const betRoutes = require('./src/routes/betRoutes');

const app = express();

// Configura CORS permitindo apenas domínios autorizados
const defaultOrigins = ['http://localhost:5173', 'http://localhost:3000'];
const envOrigins = (process.env.FRONTEND_URL || process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const allowedOrigins = envOrigins.length ? envOrigins : defaultOrigins;

app.use(
  cors({
    origin: (origin, callback) => {
      // Permite ferramentas sem origin (Postman, curl) e origens explicitamente permitidas
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
  }),
); // Deixa o Front-end falar com o Back-end
app.use(express.json()); // Permite ler JSON no corpo da requisição

// Usa as rotas que criamos
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/pix', pixRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/bets', betRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
