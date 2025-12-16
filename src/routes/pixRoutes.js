const express = require('express');
const router = express.Router();
const pixController = require('../controllers/pixController');
const webhookController = require('../controllers/webhookController');

// Rota para criar o Pix
router.post('/charge', pixController.createPixCharge);

// Webhook OpenPix - cadastre esta URL no painel: /api/webhook/openpix
router.post('/webhook/openpix', webhookController.handleOpenPixWebhook);

module.exports = router;
