// src/middlewares/authMiddleware.js
const { protect, admin } = require('../middleware/authMiddleware');

const verifyToken = protect;
const isAdmin = admin;

module.exports = { verifyToken, isAdmin, protect, admin };
