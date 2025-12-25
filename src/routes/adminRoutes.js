// src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, isAdmin } = require('../middlewares/authMiddleware');

// [DEBUG] Validador de Handlers (IMPEDE O CRASH GENÉRICO)
function mustBeFn(name) {
  const fn = adminController[name];
  if (typeof fn !== 'function') {
    // Isso vai aparecer no seu log do Railway dizendo EXATAMENTE o que falta
    throw new Error(
      `🚨 [ERRO FATAL DE ROTA] A função 'adminController.${name}' não existe! \n` +
      `Verifique se você salvou/subiu o arquivo adminController.js correto.`
    );
  }
  return fn;
}

// Middleware de Proteção
router.use(verifyToken, isAdmin);

// --- ROTAS DO PAINEL ---

// Dashboard
router.get('/dashboard/stats', mustBeFn('getDashboardStats'));

// Usuários
router.get('/users', mustBeFn('listUsers'));
router.post('/users/:id/block', mustBeFn('toggleUserBlock'));

// Apostas
router.get('/bets', mustBeFn('listBets'));
router.post('/bets/:id/recheck', mustBeFn('recheckSingleBet')); // <--- A NOVA ROTA V20

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
