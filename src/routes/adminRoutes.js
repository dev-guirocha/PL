// src/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Tenta carregar middleware de auth; se não existir, usa fallback permissivo para evitar crash
let protect = (req, res, next) => next();
let admin = (req, res, next) => next();
try {
  const auth = require('../middleware/authMiddleware');
  protect = auth.protect || protect;
  admin = auth.admin || admin;
} catch (err) {
  console.warn('Auth middleware não encontrado, usando fallback permissivo.');
}

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
