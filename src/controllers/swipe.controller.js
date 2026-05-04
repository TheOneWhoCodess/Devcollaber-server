const Swipe = require('../models/Swipe');
const Match = require('../models/Match');
const User = require('../models/User');
const { computeMatchScore } = require('../services/matchmaking.service');
const { getIO } = require('../socket/socket');

const swipe = async (req, res) => {
    try {
        const { targetId, action } = req.body;
        const fromId = req.user._id;

        if (fromId.toString() === targetId)
            return res.status(400).json({ message: 'Cannot swipe yourself' });

        await Swipe.findOneAndUpdate(
            { from: fromId, to: targetId },
            { action },
            { upsert: true, new: true }
        );

        let match = null;

        if (action === 'like' || action === 'superlike') {
            const mutual = await Swipe.findOne({
                from: targetId,
                to: fromId,
                action: { $in: ['like', 'superlike'] },
            });

            if (mutual) {
                const [userA, userB] = await Promise.all([
                    User.findById(fromId),
                    User.findById(targetId),
                ]);
                const score = computeMatchScore(userA, userB);
                match = await Match.create({ users: [fromId, targetId], matchScore: score });

                const io = getIO();
                [fromId.toString(), targetId.toString()].forEach(uid => {
                    io.to(uid).emit('new_match', {
                        matchId: match._id,
                        matchScore: score,
                        with: uid === fromId.toString() ? userB : userA,
                    });
                });
            }
        }

        res.json({ success: true, matched: !!match, match });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { swipe };