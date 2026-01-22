const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const authMiddleware = require('../middleware/auth');
const reportController = require('../controllers/reportController');
const walletController = require('../controllers/walletController');
const supervisorAuth = require('../middleware/supervisorAuth');

router.use(authMiddleware);
router.put('/', profileController.update);
router.get('/supervisor/stats', supervisorAuth, reportController.getSupervisorStats);
router.get('/supervisor/users', supervisorAuth, reportController.getSupervisorUsers);
router.get('/supervisor/withdrawals', supervisorAuth, walletController.listSupervisorWithdrawals);
router.post('/supervisor/withdrawals', supervisorAuth, walletController.requestSupervisorWithdrawal);

module.exports = router;
