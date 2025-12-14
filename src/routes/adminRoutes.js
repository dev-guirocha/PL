const express = require('express');
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/auth');
const adminOnly = require('../middleware/adminOnly');

const router = express.Router();

router.use(authMiddleware, adminOnly);

router.get('/stats', adminController.stats);
router.get('/bets', adminController.listBets);
router.get('/users', adminController.listUsers);
router.patch('/users/:id/roles', adminController.updateUserRoles);
router.delete('/users/:id', adminController.deleteUser);
router.delete('/users', adminController.deleteUser);

// Supervisores
router.post('/supervisors', adminController.createSupervisor);
router.get('/supervisors', adminController.listSupervisors);
router.patch('/supervisors/:id', adminController.updateSupervisor);
router.delete('/supervisors/:id', adminController.deleteSupervisor);

// Resultados
router.post('/results', adminController.createResult);
router.get('/results', adminController.listResults);
router.post('/results/:id/settle', adminController.settleResult);
router.get('/results/:id/settle', adminController.settleResult); // fallback para chamadas GET
router.post('/results/:id/pule', adminController.generateResultPule);

// Saques
router.get('/withdrawals', adminController.listWithdrawals);
router.patch('/withdrawals/:id/status', adminController.updateWithdrawalStatus);

// Cupons
router.post('/coupons', adminController.createCoupon);
router.get('/coupons', adminController.listCoupons);
router.put('/coupons/:id', adminController.updateCoupon);

// Pix manual (fallback)
router.post('/pix/credit', adminController.manualCreditPix);

module.exports = router;
