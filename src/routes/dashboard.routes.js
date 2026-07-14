const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const User = require('../models/User');
const Match = require('../models/Match');
const Swipe = require('../models/Swipe');

// ELO starts at 1200 (see User.js default). Every 100 points above that
// baseline is one "level" — purely a presentational framing over the
// existing matchmaking score, no new scoring logic.
const ELO_BASELINE = 1200;
const ELO_PER_LEVEL = 100;

const computeLevel = (eloScore) => {
    const level = Math.max(1, Math.floor((eloScore - ELO_BASELINE) / ELO_PER_LEVEL) + 1);
    const intoLevel = Math.max(0, (eloScore - ELO_BASELINE) % ELO_PER_LEVEL);
    return { level, progressPercent: Math.min(100, (intoLevel / ELO_PER_LEVEL) * 100) };
};

router.get('/stats', protect, async (req, res) => {
    try {
        const userId = req.user._id;

        const [user, matchCount, swipeCount] = await Promise.all([
            User.findById(userId),
            Match.countDocuments({ users: userId }),
            Swipe.countDocuments({ from: userId }),
        ]);

        if (!user) return res.status(404).json({ message: 'User not found' });

        const { level, progressPercent } = computeLevel(user.eloScore);

        const isPremiumActive =
            user.plan === 'premium' && user.premiumExpiresAt && new Date(user.premiumExpiresAt) > new Date();

        // Achievements are computed on the fly from existing data — no
        // separate "earned achievements" collection to keep in sync.
        // Each is just a boolean check against data we already have.
        const achievements = [
            {
                id: 'first_match',
                label: 'First Match',
                description: 'Matched with your first collaborator',
                earned: matchCount >= 1,
            },
            {
                id: 'networker',
                label: 'Networker',
                description: 'Reached 5 matches',
                earned: matchCount >= 5,
            },
            {
                id: 'github_verified',
                label: 'GitHub Verified',
                description: 'Synced your GitHub profile with AI',
                earned: !!user.githubSummary,
            },
            {
                id: 'ai_pioneer',
                label: 'AI Pioneer',
                description: 'Used an AI feature for the first time',
                earned: user.totalAiActionsUsed >= 1,
            },
            {
                id: 'ai_power_user',
                label: 'AI Power User',
                description: 'Used AI features 10+ times',
                earned: user.totalAiActionsUsed >= 10,
            },
            {
                id: 'super_swiper',
                label: 'Super Swiper',
                description: 'Swiped on 50+ profiles',
                earned: swipeCount >= 50,
            },
            {
                id: 'premium_member',
                label: 'Premium Member',
                description: 'Upgraded to DevCollab Premium',
                earned: isPremiumActive,
            },
        ];

        res.json({
            success: true,
            stats: {
                matchCount,
                swipeCount,
                totalAiActionsUsed: user.totalAiActionsUsed || 0,
                eloScore: user.eloScore,
                level,
                levelProgressPercent: progressPercent,
                plan: user.plan,
                premiumExpiresAt: user.premiumExpiresAt,
                isPremiumActive,
            },
            achievements,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;