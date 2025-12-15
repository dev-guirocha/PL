const express = require('express');
const router = express.Router();
const pixController = require('../controllers/pixController');
const webhookController = require('../controllers/webhookController');

// Debug: Se o servidor subir, vai mostrar no log quais funções existem no controller
console.log('Funções do PixController:', Object.keys(pixController));

// Rota de criação do PIX
// O nome da função aqui (createPixCharge) deve ser IDÊNTICO ao exports.createPixCharge no controller
router.post('/charge', pixController.createPixCharge);

// Webhook SuitPay
router.post('/webhook/suitpay', webhookController.handleSuitpayWebhook);

module.exports = router;
