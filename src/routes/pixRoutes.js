const express = require('express');
const router = express.Router();
const pixController = require('../controllers/pixController');
const webhookController = require('../controllers/webhookController');
const couponController = require('../controllers/couponController');
const auth = require('../middleware/auth');
const woovi = require('../lib/wooviClient');

// Rota para criar o Pix
router.post('/charge', auth, pixController.createPixCharge);

// Rota para validar cupom
router.post('/validate-coupon', auth, couponController.validateCoupon);

// Rota de teste para validar credencial Woovi
router.get('/woovi-test', async (req, res) => {
  try {
    const r = await woovi.charge.list();
    return res.json({ ok: true, data: r });
  } catch (err) {
    return res.status(err.response?.status || 500).json({
      ok: false,
      status: err.response?.status,
      data: err.response?.data,
      message: err.message,
    });
  }
});

// Webhook OpenPix - cadastre esta URL no painel: /api/webhook/openpix
router.post('/webhook/openpix', webhookController.handleOpenPixWebhook);

module.exports = router;
