const express = require('express');
const router = express.Router();
const pixController = require('../controllers/pixController');
const authMiddleware = require('../middleware/auth');

router.post('/charge', authMiddleware, pixController.createPixCharge);
// Webhook não usa auth de usuário; ajuste validação de assinatura conforme Efí
router.post('/webhook', pixController.handleWebhook);

module.exports = router;
