const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const User = require('../models/User');
const { protect } = require('../middleware/auth.middleware');
const { getIO } = require('../socket/socket');
const { generateProjectIdea } = require('../services/vertexai.service');
const { computeMatchScore } = require('../services/matchmaking.service');

router.get('/', protect, async (req, res) => {
    try {
        const matches = await Match.find({ users: req.user._id })
            .populate('users', 'name avatar role skills bio')
            .sort({ matchedAt: -1 });

        res.json({ success: true, matches });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Generates an AI project idea for a match, on-demand (button click),
// unlike the match explanation which fires automatically on match
// creation. Fire-and-forget, same pattern as attachMatchExplanation in
// swipe.controller.js: respond immediately, push the result over socket
// once it's ready.
router.post('/:matchId/project-idea', protect, async (req, res) => {
    try {
        const match = await Match.findById(req.params.matchId);
        if (!match) return res.status(404).json({ message: 'Match not found' });

        const isParticipant = match.users.some(
            (uid) => uid.toString() === req.user._id.toString()
        );
        if (!isParticipant) return res.status(403).json({ message: 'Not authorized for this match' });

        if (match.projectIdeaStatus === 'pending') {
            return res.json({ success: true, status: 'pending' });
        }

        // Targeted update, not match.save() — avoids full-document
        // validation issues on unrelated fields, same lesson learned
        // from the GitHub summary bug.
        await Match.findByIdAndUpdate(match._id, { projectIdeaStatus: 'pending' });
        res.json({ success: true, status: 'pending' });

        const [userA, userB] = await Promise.all(
            match.users.map((uid) => User.findById(uid))
        );
        const { sharedSkills } = computeMatchScore(userA, userB);

        generateProjectIdea({ userA, userB, sharedSkills })
            .then(async (projectIdea) => {
                await Match.findByIdAndUpdate(match._id, {
                    projectIdea,
                    projectIdeaStatus: 'ready',
                });
                const io = getIO();
                match.users.forEach((uid) => {
                    io.to(uid.toString()).emit('project_idea_ready', {
                        matchId: match._id,
                        projectIdea,
                    });
                });
            })
            .catch(async (err) => {
                console.error('Project idea pipeline failed:', err.message);
                await Match.findByIdAndUpdate(match._id, { projectIdeaStatus: 'failed' }).catch(() => {});
            });
    } catch (err) {
        // Only reachable if the error happened before res.json() above
        // (e.g. match lookup itself failed) — the async generation
        // errors are handled in their own .catch() and never reach here.
        if (!res.headersSent) {
            res.status(500).json({ message: err.message });
        }
    }
});

module.exports = router;