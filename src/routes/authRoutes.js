// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

// Define os endereços: localhost:3000/api/auth/register
router.post('/register', authController.register);
router.post('/login', authController.login);
router.put('/password', authMiddleware, authController.changePassword);

module.exports = router;
