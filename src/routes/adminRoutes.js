const express = require('express');
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

const router = express.Router();

router.use(authMiddleware, adminOnly);

router.get('/stats', adminController.stats);
router.get('/bets', adminController.listBets);
router.get('/users', adminController.listUsers);

// Supervisores
router.post('/supervisors', adminController.createSupervisor);
router.get('/supervisors', adminController.listSupervisors);
router.delete('/supervisors/:id', adminController.deleteSupervisor);

// Resultados
router.post('/results', adminController.createResult);
router.get('/results', adminController.listResults);

// Saques
router.get('/withdrawals', adminController.listWithdrawals);
router.patch('/withdrawals/:id/status', adminController.updateWithdrawalStatus);

// Cupons
router.post('/coupons', adminController.createCoupon);
router.get('/coupons', adminController.listCoupons);

module.exports = router;
