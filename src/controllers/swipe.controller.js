const Swipe = require('../models/Swipe');
const Match = require('../models/Match');
const User = require('../models/User');
const { computeMatchScore } = require('../services/matchmaking.service');
const { getIO } = require('../socket/socket');
const { createNotification } = require('../services/notification.service');
const { generateMatchExplanation } = require('../services/vertexai.service');

// Fire-and-forget: generates the AI explanation after the match already
// exists and the response has gone back to the client. Never awaited from
// the request path, so a slow/unavailable Vertex AI call can't add latency
// to a swipe. Writes the result back to the Match doc and pushes it live.
const attachMatchExplanation = (match, userA, userB, score, sharedSkills) => {
    generateMatchExplanation({ userA, userB, score, sharedSkills })
        .then(async ({ explanation }) => {
            match.matchExplanation = explanation;
            match.explanationStatus = 'ready';
            await match.save();

            const io = getIO();
            match.users.forEach(uid => {
                io.to(uid.toString()).emit('match_explanation_ready', {
                    matchId: match._id,
                    explanation,
                });
            });
        })
        .catch(async (err) => {
            console.error('Match explanation pipeline failed:', err.message);
            match.explanationStatus = 'failed';
            await match.save().catch(() => {});
        });
};

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
                const { score, sharedSkills } = computeMatchScore(userA, userB);
                match = await Match.create({
                    users: [fromId, targetId],
                    matchScore: score,
                    explanationStatus: 'pending',
                });

                const io = getIO();
                [fromId.toString(), targetId.toString()].forEach(uid => {
                    io.to(uid).emit('new_match', {
                        matchId: match._id,
                        matchScore: score,
                        with: uid === fromId.toString() ? userB : userA,
                    });
                });

                // Notification belongs here — only on an actual mutual match,
                // not on every single swipe. Sent to both sides.
                await Promise.all([
                    createNotification({
                        user: fromId,
                        type: 'new_match',
                        title: 'New Match!',
                        body: `You matched with ${userB.name}`,
                        link: '/matches',
                        from: targetId,
                    }),
                    createNotification({
                        user: targetId,
                        type: 'new_match',
                        title: 'New Match!',
                        body: `You matched with ${userA.name}`,
                        link: '/matches',
                        from: fromId,
                    }),
                ]);

                // Kick off the AI explanation in the background — response
                // below does not wait on this.
                attachMatchExplanation(match, userA, userB, score, sharedSkills);
            }
        }

        res.json({ success: true, matched: !!match, match });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { swipe };