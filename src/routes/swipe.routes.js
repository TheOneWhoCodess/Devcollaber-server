const express = require('express');
const router = express.Router();
const { swipe } = require('../controllers/swipe.controller');
const { protect } = require('../middleware/auth.middleware');

router.post('/', protect, swipe);

module.exports = router;