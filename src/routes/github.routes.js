const express = require('express');
const router = express.Router();
const { getGitHubStats, summarizeGithub } = require('../controllers/github.controller');
const { protect } = require('../middleware/auth.middleware');

// Public lookup by ?username= — used on public profile pages
// (e.g. /u/[username]) where the viewer may not be logged in.
// Must NOT require auth.
router.get('/stats', getGitHubStats);

// Authenticated action — only operates on the logged-in user's own
// stored GitHub username (see summarizeGithub in the controller),
// so it must stay behind protect.
router.post('/summarize', protect, summarizeGithub);

module.exports = router;