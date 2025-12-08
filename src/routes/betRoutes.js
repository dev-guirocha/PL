const express = require('express');
const betController = require('../controllers/betController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.post('/', authMiddleware, betController.create);

module.exports = router;
