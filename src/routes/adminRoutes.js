// src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Importa e RENOMEIA para evitar conflito se necessário, ou usa direto
const { verifyToken, isAdmin } = require('../middlewares/authMiddleware');

// --- BLINDAGEM 1: Verificar Middleware (CRÍTICO) ---
console.log('--- DEBUG MIDDLEWARE ---');
console.log('verifyToken é:', typeof verifyToken);
console.log('isAdmin é:', typeof isAdmin);
console.log('------------------------');
if (typeof verifyToken !== 'function' || typeof isAdmin !== 'function') {
  throw new Error(
    `🚨 [ERRO FATAL DE MIDDLEWARE] verifyToken ou isAdmin não são funções!\n` +
    `Verifique o arquivo 'src/middlewares/authMiddleware.js' e se o caminho do require interno está correto (singular vs plural).`
  );
}

// --- BLINDAGEM 2: Verificar Controller (O que já fizemos) ---
function mustBeFn(name) {
  const fn = adminController[name];
  if (typeof fn !== 'function') {
    throw new Error(
      `🚨 [ERRO FATAL DE ROTA] A função 'adminController.${name}' não existe! \n` +
      `Verifique se você salvou/subiu o arquivo adminController.js correto.`
    );
  }
  return fn;
}

// Aplica Middleware (Agora seguro porque verificamos acima)
router.use(verifyToken, isAdmin);

// --- ROTAS DO PAINEL ---

// Dashboard
router.get('/stats', mustBeFn('getDashboardStats'));

// Usuários
router.get('/users', mustBeFn('listUsers'));
router.post('/users/:id/block', mustBeFn('toggleUserBlock'));

// Apostas
router.get('/bets', mustBeFn('listBets'));
router.post('/bets/:id/recheck', mustBeFn('recheckSingleBet')); // V21

// Saques
router.get('/withdrawals', mustBeFn('listWithdrawals'));

// Supervisores
router.get('/supervisors', mustBeFn('listSupervisors'));

// Resultados
router.post('/results', mustBeFn('createResult'));
router.get('/results', mustBeFn('listResults'));
router.put('/results/:id', mustBeFn('updateResult'));
router.delete('/results/:id', mustBeFn('deleteResult'));

// Liquidação (Settle)
router.post('/results/:id/settle', mustBeFn('settleBetsForResult'));

// Pule (Impressão)
router.post('/pule/:id', mustBeFn('generatePule'));

module.exports = router;
