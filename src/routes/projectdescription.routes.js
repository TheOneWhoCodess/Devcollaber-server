const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { expandProjectDescription } = require('../services/groq.service');

// Same rate-limit pattern your /concierge and /project-idea routes use —
// adjust the import path if checkAiUsageLimit lives elsewhere or is applied
// differently in your existing routes.
const { checkAiUsageLimit } = require('../middleware/checkAiUsageLimit');

/**
 * POST /api/projects/expand-description
 * Takes a rough draft + selected metadata, returns a clearer,
 * better-structured project description via Groq.
 */
router.post('/expand-description', protect, checkAiUsageLimit, async (req, res) => {
    try {
        const { draft, title, techStack, rolesNeeded, projectType, stage } = req.body;

        if (!draft || !draft.trim()) {
            return res.status(400).json({ message: 'Draft description is required' });
        }

        const { description } = await expandProjectDescription({
            draft,
            title,
            techStack,
            rolesNeeded,
            projectType,
            stage,
        });

        return res.json({ description });
    } catch (err) {
        console.error('expand-description error:', err);
        return res.status(500).json({ message: 'Failed to expand description' });
    }
});

module.exports = router;