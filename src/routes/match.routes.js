const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const User = require('../models/User');
const { protect } = require('../middleware/auth.middleware');
const { checkAiUsageLimit } = require('../middleware/checkAiUsageLimit');
const { getIO } = require('../socket/socket');
const { generateProjectIdea, generateIcebreaker, runMatchConcierge } = require('../services/vertexai.service');
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
// once it's ready. Costs an LLM call, so it's subject to the free-tier
// daily AI usage cap.
router.post('/:matchId/project-idea', protect, checkAiUsageLimit, async (req, res) => {
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

// Match Concierge — the agentic feature. Unlike /project-idea above
// (fixed: always generates a project idea), this endpoint lets the MODEL
// decide what would help this match, by giving it tools to investigate
// first (chat history, GitHub activity). See runMatchConcierge in
// vertexai.service.js for the actual agent loop. Costs an LLM call
// (possibly several, via the agent loop), so it's subject to the
// free-tier daily AI usage cap.
router.post('/:matchId/concierge', protect, checkAiUsageLimit, async (req, res) => {
    try {
        const match = await Match.findById(req.params.matchId).populate('users');
        if (!match) return res.status(404).json({ message: 'Match not found' });

        const isParticipant = match.users.some(
            (u) => u._id.toString() === req.user._id.toString()
        );
        if (!isParticipant) return res.status(403).json({ message: 'Not authorized for this match' });

        if (match.concierge?.status === 'investigating') {
            return res.json({ success: true, status: 'investigating' });
        }

        await Match.findByIdAndUpdate(match._id, { 'concierge.status': 'investigating' });
        res.json({ success: true, status: 'investigating' });

        const [userA, userB] = match.users;
        const { sharedSkills } = computeMatchScore(userA, userB);

        try {
            const { action, reasoning, toolsUsed } = await runMatchConcierge({
                matchId: match._id,
                userA,
                userB,
                sharedSkills,
            });

            const update = {
                'concierge.status': 'ready',
                'concierge.action': action,
                'concierge.reasoning': reasoning,
                'concierge.toolsUsed': toolsUsed,
            };

            // Execute whatever the agent decided — reusing the existing
            // single-shot generators for the actual content.
            if (action === 'project_idea') {
                const projectIdea = await generateProjectIdea({ userA, userB, sharedSkills });
                update.projectIdea = projectIdea;
                update.projectIdeaStatus = 'ready';
            } else if (action === 'icebreaker') {
                const icebreaker = await generateIcebreaker({ userA, userB });
                update['concierge.icebreaker'] = icebreaker;
            }
            // follow_up_nudge: no content to generate, the decision itself is the output.

            await Match.findByIdAndUpdate(match._id, update);

            const io = getIO();
            match.users.forEach((u) => {
                io.to(u._id.toString()).emit('concierge_ready', {
                    matchId: match._id,
                    action,
                    reasoning,
                    toolsUsed,
                    icebreaker: update['concierge.icebreaker'],
                    projectIdea: update.projectIdea,
                });
            });
        } catch (err) {
            console.error('Match concierge agent failed:', err.message);
            await Match.findByIdAndUpdate(match._id, { 'concierge.status': 'failed' }).catch(() => {});
        }
    } catch (err) {
        if (!res.headersSent) {
            res.status(500).json({ message: err.message });
        }
    }
});

module.exports = router;