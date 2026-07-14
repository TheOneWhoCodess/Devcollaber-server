const User = require('../models/User');

const FREE_DAILY_AI_LIMIT = 5;

const isSameDay = (a, b) => {
    if (!a || !b) return false;
    return new Date(a).toDateString() === new Date(b).toDateString();
};

const isPremiumActive = (user) =>
    user.plan === 'premium' && user.premiumExpiresAt && new Date(user.premiumExpiresAt) > new Date();

// Apply this to any route that triggers an LLM call the user can
// repeatedly click (GitHub sync, Project Idea, Match Concierge).
// Deliberately NOT applied to the automatic Match Explainer, since
// that's not user-triggered on demand — it fires once per real match.
const checkAiUsageLimit = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (isPremiumActive(user)) {
            return next(); // no cap for active premium users
        }

        const today = new Date();
        const usageIsStale = !isSameDay(user.aiUsageDate, today);
        const currentCount = usageIsStale ? 0 : (user.aiUsageCount || 0);

        if (currentCount >= FREE_DAILY_AI_LIMIT) {
            return res.status(429).json({
                message: `You've used your ${FREE_DAILY_AI_LIMIT} free AI actions for today. Upgrade to Premium for unlimited access.`,
                limitReached: true,
                upgradeUrl: '/premium',
            });
        }

        // Increment (or reset-and-set-to-1 if it's a new day) via a
        // targeted update — avoids re-triggering full-document
        // validation on unrelated fields, same lesson as elsewhere.
        // totalAiActionsUsed increments unconditionally — it never
        // resets, used for achievements/dashboard stats.
        // NOTE: $set and $inc must both be explicit operators here —
        // MongoDB rejects mixing plain top-level fields with $ operators
        // in the same update document.
        await User.findByIdAndUpdate(user._id, {
            $set: { aiUsageCount: currentCount + 1, aiUsageDate: today },
            $inc: { totalAiActionsUsed: 1 },
        });

        next();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { checkAiUsageLimit, FREE_DAILY_AI_LIMIT };