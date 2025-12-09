const express = require('express');
const betController = require('../controllers/betController');
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.post('/', authMiddleware, betController.create);
router.get('/my-bets', authMiddleware, betController.myBets);
router.get('/result-pules', authMiddleware, reportController.listResultPules);
router.get('/', authMiddleware, betController.list);

module.exports = router;
