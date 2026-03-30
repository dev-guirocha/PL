const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const authMiddleware = require('../middleware/auth');
const { getDepositAvailability } = require('../utils/platformMode');

const ensureDepositsAvailable = (req, res, next) => {
  const availability = getDepositAvailability();
  if (!availability.enabled) {
    return res.status(503).json({ error: availability.message });
  }
  return next();
};

router.use(authMiddleware);

router.get('/me', walletController.me);
router.get('/statement', walletController.listStatement);
router.post('/deposit', ensureDepositsAvailable, walletController.deposit);
router.post('/withdraw', walletController.requestWithdrawal);
router.get('/withdraws', walletController.listMyWithdrawals);

module.exports = router;
