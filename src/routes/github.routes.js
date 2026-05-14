const express = require('express');
const router = express.Router();
const { getGitHubStats } = require('../controllers/github.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/stats', protect, getGitHubStats);

module.exports = router;