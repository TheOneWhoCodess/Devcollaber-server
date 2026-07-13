const express = require('express');
const router = express.Router();
const { getGitHubStats, summarizeGithub } = require('../controllers/github.controller');
const { protect } = require('../middleware/auth.middleware');
const { checkAiUsageLimit } = require('../middleware/checkAiUsageLimit');

// Public lookup by ?username= — used on public profile pages
// (e.g. /u/[username]) where the viewer may not be logged in.
// Must NOT require auth, and no LLM call happens here, so no usage cap.
router.get('/stats', getGitHubStats);

// Authenticated action — only operates on the logged-in user's own
// stored GitHub username (see summarizeGithub in the controller),
// so it must stay behind protect. Costs an LLM call, so it's subject
// to the free-tier daily AI usage cap.
router.post('/summarize', protect, checkAiUsageLimit, summarizeGithub);

module.exports = router;