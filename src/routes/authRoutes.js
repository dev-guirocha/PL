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

const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Muitas tentativas de recuperação. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas de redefinição. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Define os endereços: localhost:3000/api/auth/register
router.post('/register', authController.register);
router.post('/login', loginLimiter, authController.login);
router.post('/logout', authController.logout);
router.put('/password', authMiddleware, authController.changePassword);
router.post('/forgot', forgotLimiter, authController.requestPasswordReset);
router.post('/reset', resetLimiter, authController.resetPassword);
router.post('/forgot-password', forgotLimiter, authController.requestPasswordReset);
router.post('/reset-password', resetLimiter, authController.resetPassword);

module.exports = router;
