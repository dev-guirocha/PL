const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/me', walletController.me);
router.post('/deposit', walletController.deposit);

module.exports = router;
