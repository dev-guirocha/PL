const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const authMiddleware = require('../middleware/auth');
const reportController = require('../controllers/reportController');

router.use(authMiddleware);
router.put('/', profileController.update);
router.get('/supervisor/stats', reportController.getSupervisorStats);

module.exports = router;
