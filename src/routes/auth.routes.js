const express = require('express');
const router = express.Router();
const { logout, getMe, googleAuth } = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');

router.post('/google', googleAuth);
router.post('/logout', logout);
router.get('/me', protect, getMe);

module.exports = router;