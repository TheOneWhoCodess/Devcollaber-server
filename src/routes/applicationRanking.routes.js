const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { rankApplicants } = require('../services/groq.service');
const { checkAiUsageLimit } = require('../middleware/checkAiUsageLimit');

// ASSUMPTION: model names guessed from your file tree (Project.js, and an
// Application.js mirroring the Feedback.js pattern). Adjust if applications
// are actually stored differently (e.g. as a subdocument on Project).
const Project = require('../models/project');
const Application = require('../models/Application');

/**
 * POST /api/projects/:id/applications/rank
 * Only the project owner can call this (same 403 pattern as your existing
 * GET /:id/applications route). Returns a score + one-line reason per
 * pending application via Groq, so the frontend can sort by fit.
 */
router.post('/:id/applications/rank', protect, checkAiUsageLimit, async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ message: 'Project not found' });
        if (String(project.postedBy) !== String(req.user._id)) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        const applications = await Application.find({ project: project._id, status: 'pending' })
            .populate('applicant', 'name role skills bio');

        if (applications.length === 0) {
            return res.json({ rankings: [] });
        }

        const applicantList = applications.map((a) => ({
            id: String(a._id),
            role: a.applicant?.role || a.role || 'unspecified',
            skills: a.applicant?.skills || [],
            bio: a.applicant?.bio || '',
            message: a.message || '',
        }));

        const { rankings } = await rankApplicants({
            project: {
                rolesNeeded: project.rolesNeeded,
                techStack: project.techStack,
                description: project.description,
            },
            applicants: applicantList,
        });

        return res.json({ rankings });
    } catch (err) {
        console.error('rank applicants error:', err);
        return res.status(500).json({ message: 'Failed to rank applicants' });
    }
});

module.exports = router;