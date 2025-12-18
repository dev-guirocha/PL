// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Define os endereços: localhost:3000/api/auth/register
router.post('/register', authController.register);
router.post('/login', loginLimiter, authController.login);
router.put('/password', authMiddleware, authController.changePassword);
router.post('/forgot', authController.requestPasswordReset);
router.post('/reset', authController.resetPassword);
router.post('/forgot-password', authController.requestPasswordReset);
router.post('/reset-password', authController.resetPassword);

module.exports = router;
