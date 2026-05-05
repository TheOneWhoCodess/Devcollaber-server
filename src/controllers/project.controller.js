const Project = require('../models/project');
const Application = require('../models/Application');

// GET /api/projects — browse all open projects
const getProjects = async (req, res) => {
    try {
        const { techStack, role, stage, commitment, limit = 20, page = 1 } = req.query;

        const filter = { isOpen: true };
        if (stage) filter.stage = stage;
        if (commitment) filter.commitment = commitment;
        if (role) filter.rolesNeeded = { $in: [role] };
        if (techStack) filter.techStack = { $in: techStack.split(',') };

        const projects = await Project.find(filter)
            .populate('postedBy', 'name avatar role skills')
            .sort({ createdAt: -1 })
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit));

        const total = await Project.countDocuments(filter);

        res.json({ success: true, projects, total });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/projects/:id — get single project
const getProject = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id)
            .populate('postedBy', 'name avatar role skills bio github');

        if (!project) return res.status(404).json({ message: 'Project not found' });

        // Check if current user already applied
        const applied = await Application.findOne({
            project: project._id,
            applicant: req.user._id,
        });

        res.json({ success: true, project, applied: !!applied });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/projects — create project
const createProject = async (req, res) => {
    try {
        const {
            title, description, techStack, rolesNeeded,
            stage, commitment, projectType, openPositions,
            github, website,
        } = req.body;

        const project = await Project.create({
            title,
            description,
            techStack,
            rolesNeeded,
            stage,
            commitment,
            projectType,
            openPositions,
            github,
            website,
            postedBy: req.user._id,
        });

        await project.populate('postedBy', 'name avatar role');
        res.status(201).json({ success: true, project });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// PUT /api/projects/:id — update project
const updateProject = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ message: 'Project not found' });
        if (project.postedBy.toString() !== req.user._id.toString())
            return res.status(403).json({ message: 'Not authorized' });

        const allowed = ['title', 'description', 'techStack', 'rolesNeeded',
            'stage', 'commitment', 'projectType', 'openPositions',
            'isOpen', 'github', 'website'];

        allowed.forEach(key => {
            if (req.body[key] !== undefined) project[key] = req.body[key];
        });

        await project.save();
        res.json({ success: true, project });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/projects/:id
const deleteProject = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ message: 'Project not found' });
        if (project.postedBy.toString() !== req.user._id.toString())
            return res.status(403).json({ message: 'Not authorized' });

        await project.deleteOne();
        await Application.deleteMany({ project: req.params.id });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/projects/mine — my posted projects
const getMyProjects = async (req, res) => {
    try {
        const projects = await Project.find({ postedBy: req.user._id })
            .sort({ createdAt: -1 });

        // Get application counts for each project
        const projectsWithCounts = await Promise.all(
            projects.map(async (p) => {
                const count = await Application.countDocuments({ project: p._id, status: 'pending' });
                return { ...p.toObject(), pendingApplications: count };
            })
        );

        res.json({ success: true, projects: projectsWithCounts });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/projects/:id/apply
const applyToProject = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ message: 'Project not found' });
        if (!project.isOpen) return res.status(400).json({ message: 'Project is closed' });
        if (project.postedBy.toString() === req.user._id.toString())
            return res.status(400).json({ message: 'Cannot apply to your own project' });

        const existing = await Application.findOne({
            project: project._id,
            applicant: req.user._id,
        });
        if (existing) return res.status(400).json({ message: 'Already applied' });

        const application = await Application.create({
            project: project._id,
            applicant: req.user._id,
            message: req.body.message,
            role: req.body.role,
        });

        res.status(201).json({ success: true, application });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/projects/:id/applications — get applications for my project
const getApplications = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) return res.status(404).json({ message: 'Project not found' });
        if (project.postedBy.toString() !== req.user._id.toString())
            return res.status(403).json({ message: 'Not authorized' });

        const applications = await Application.find({ project: req.params.id })
            .populate('applicant', 'name avatar role skills bio github')
            .sort({ createdAt: -1 });

        res.json({ success: true, applications });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// PUT /api/projects/:id/applications/:appId — accept or reject
const updateApplication = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (project.postedBy.toString() !== req.user._id.toString())
            return res.status(403).json({ message: 'Not authorized' });

        const application = await Application.findByIdAndUpdate(
            req.params.appId,
            { status: req.body.status },
            { new: true }
        ).populate('applicant', 'name avatar role');

        res.json({ success: true, application });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    getProjects, getProject, createProject, updateProject,
    deleteProject, getMyProjects, applyToProject,
    getApplications, updateApplication,
};