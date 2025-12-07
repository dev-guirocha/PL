// index.js
require('dotenv').config(); // Para ler o .env
const express = require('express');
const cors = require('cors');
const authRoutes = require('./src/routes/authRoutes');
const walletRoutes = require('./src/routes/walletRoutes');
const pixRoutes = require('./src/routes/pixRoutes');
const profileRoutes = require('./src/routes/profileRoutes');

const app = express();

// Configurações obrigatórias
app.use(cors()); // Deixa o Front-end falar com o Back-end
app.use(express.json()); // Permite ler JSON no corpo da requisição

// Usa as rotas que criamos
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/pix', pixRoutes);
app.use('/api/profile', profileRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
