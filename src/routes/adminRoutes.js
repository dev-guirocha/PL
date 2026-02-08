// src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const couponController = require('../controllers/couponController');

// Importa e RENOMEIA para evitar conflito se necessário, ou usa direto
const { verifyToken, isAdmin } = require('../middlewares/authMiddleware');

// --- BLINDAGEM 1: Verificar Middleware (CRÍTICO) ---
if (process.env.ADMIN_DEBUG === 'true') {
  console.log('--- DEBUG MIDDLEWARE ---');
  console.log('verifyToken é:', typeof verifyToken);
  console.log('isAdmin é:', typeof isAdmin);
  console.log('------------------------');
}
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

function mustBeCouponFn(name) {
  const fn = couponController[name];
  if (typeof fn !== 'function') {
    throw new Error(
      `🚨 [ERRO FATAL DE ROTA] A função 'couponController.${name}' não existe! \n` +
      `Verifique se você salvou/subiu o arquivo couponController.js correto.`
    );
  }
  return fn;
}

// Aplica Middleware (Agora seguro porque verificamos acima)
router.use(verifyToken, isAdmin);

// --- ROTAS DO PAINEL ---

// Dashboard
router.get('/stats', mustBeFn('getDashboardStats'));
router.get('/notifications/count', mustBeFn('getPendingNotificationsCount'));
router.get('/bank-balance', mustBeFn('getBankBalance'));
router.post('/bank-balance', mustBeFn('setBankBalance'));
router.get('/notifications/count', mustBeFn('getPendingNotificationsCount'));

// Usuários
router.get('/users', mustBeFn('listUsers'));
router.get('/users/:id/transactions', mustBeFn('getUserTransactions'));
router.patch('/users/:id/roles', mustBeFn('updateUserRoles'));
router.post('/users/:id/block', mustBeFn('toggleUserBlock'));
router.delete('/users/:id', mustBeFn('softDeleteUser'));

// Apostas
router.get('/bets', mustBeFn('listBets'));
router.get('/bets/ticket/:ticketId', mustBeFn('getBetPuleData'));
router.post('/bets/:id/recheck', mustBeFn('recheckSingleBet')); // V21
router.get('/bets/:betId/manual-compare/candidates', mustBeFn('listManualCompareCandidates'));
router.post('/bets/:betId/manual-compare', mustBeFn('manualCompareBet'));
router.post('/bets/:betId/manual-settle', mustBeFn('manualSettleBet'));

// Saques
router.get('/withdrawals', mustBeFn('listWithdrawals'));
router.patch('/withdrawals/:id/status', mustBeFn('updateWithdrawalStatus'));

// Supervisores
router.get('/supervisors', mustBeFn('listSupervisors'));
router.post('/supervisors', mustBeFn('createSupervisor'));
router.patch('/supervisors/:id', mustBeFn('updateSupervisor'));
router.delete('/supervisors/:id', mustBeFn('deleteSupervisor'));

// Resultados
router.post('/results', mustBeFn('createResult'));
router.get('/results', mustBeFn('listResults'));
router.put('/results/:id', mustBeFn('updateResult'));
router.delete('/results/:id', mustBeFn('deleteResult'));

// Liquidação (Settle)
router.post('/results/:id/settle', mustBeFn('settleBetsForResult'));

// Pule (Impressão)
router.post('/results/:id/pule', mustBeFn('generatePule'));

// Cupons
router.get('/coupons', mustBeCouponFn('listCoupons'));
router.post('/coupons', mustBeCouponFn('createCoupon'));
router.put('/coupons/:id/toggle', mustBeCouponFn('toggleActive'));
router.delete('/coupons/:id', mustBeCouponFn('deleteCoupon'));
router.get('/coupons/stats', mustBeCouponFn('getCouponStats'));

module.exports = router;
