// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Define os endereços: localhost:3000/api/auth/register
router.post('/register', authController.register);
router.post('/login', authController.login);

module.exports = router;