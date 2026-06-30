const express = require('express');
const router = express.Router();
const { getGitHubStats, summarizeGithub } = require('../controllers/github.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/stats', protect, getGitHubStats);
router.post('/summarize', protect, summarizeGithub);

module.exports = router;