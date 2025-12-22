// src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, admin } = require('../middleware/authMiddleware');

// Dashboard
router.get('/dashboard', protect, admin, adminController.getDashboardStats);
router.get('/stats', protect, admin, adminController.getDashboardStats);

// Usuários
router.get('/users', protect, admin, adminController.listUsers);
router.put('/users/:id/block', protect, admin, adminController.toggleUserBlock);

// Supervisores
router.get('/supervisors', protect, admin, adminController.listSupervisors);

// Apostas
router.get('/bets', protect, admin, adminController.listBets);

// Saques
router.get('/withdrawals', protect, admin, adminController.listWithdrawals);

// Resultados & Liquidação
router.get('/results', protect, admin, adminController.listResults);
router.post('/results', protect, admin, adminController.createResult);
router.put('/results/:id', protect, admin, adminController.updateResult);
router.delete('/results/:id', protect, admin, adminController.deleteResult);
router.post('/results/:id/settle', protect, admin, adminController.settleBetsForResult);

// Pule
router.post('/results/:id/pule', protect, admin, adminController.generatePule);

// Debug apostas sem loteria
router.get('/debug/bets', protect, admin, adminController.debugOrphanedBets);
router.post('/debug/bets/repair', protect, admin, adminController.repairOrphanedBets);

module.exports = router;
