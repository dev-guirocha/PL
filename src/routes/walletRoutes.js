const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/me', walletController.me);
router.get('/statement', walletController.listStatement);
router.post('/deposit', walletController.deposit);
router.post('/withdraw', walletController.requestWithdrawal);
router.get('/withdraws', walletController.listMyWithdrawals);

module.exports = router;
