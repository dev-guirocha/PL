const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);
router.put('/', profileController.update);

module.exports = router;
