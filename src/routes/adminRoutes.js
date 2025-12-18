// src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { protect, admin } = require('../middleware/authMiddleware');

// Rotas de Dashboard
router.get('/dashboard', protect, admin, adminController.getDashboardStats);
router.get('/stats', protect, admin, adminController.getDashboardStats); // Rota alternativa

// Rotas de Usuários
router.get('/users', protect, admin, adminController.listUsers);
router.put('/users/:id/block', protect, admin, adminController.toggleUserBlock);
router.get('/supervisors', protect, admin, adminController.listSupervisors); // Evita erro 501

// Rotas de Resultados
router.get('/results', protect, admin, adminController.listResults);
router.post('/results', protect, admin, adminController.createResult);
router.put('/results/:id', protect, admin, adminController.updateResult);
router.delete('/results/:id', protect, admin, adminController.deleteResult);

// Rota de Liquidação (O Foguete 🚀)
router.post('/results/:id/settle', protect, admin, adminController.settleBetsForResult);

module.exports = router;
