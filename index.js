// index.js
require('dotenv').config(); // Para ler o .env
const express = require('express');
const cors = require('cors');
const authRoutes = require('./src/routes/authRoutes');

const app = express();

// Configurações obrigatórias
app.use(cors()); // Deixa o Front-end falar com o Back-end
app.use(express.json()); // Permite ler JSON no corpo da requisição

// Usa as rotas que criamos
app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});