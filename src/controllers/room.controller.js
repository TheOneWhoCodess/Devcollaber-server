const Project = require('../models/project');
const Application = require('../models/Application');
const Task = require('../models/Task');
const RoomLink = require('../models/RoomLink');

// Helper — check if user is a member (owner or accepted applicant)
const isMember = async (projectId, userId) => {
    const project = await Project.findById(projectId);
    if (!project) return false;
    if (project.postedBy.toString() === userId.toString()) return true;

    const accepted = await Application.findOne({
        project: projectId,
        applicant: userId,
        status: 'accepted',
    });
    return !!accepted;
};

// ── TASKS ─────────────────────────────────────────

// GET /api/projects/:id/tasks
const getTasks = async (req, res) => {
    try {
        if (!await isMember(req.params.id, req.user._id))
            return res.status(403).json({ message: 'Not a project member' });

        const tasks = await Task.find({ project: req.params.id })
            .populate('createdBy', 'name avatar')
            .sort({ createdAt: -1 });

        res.json({ success: true, tasks });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/projects/:id/tasks
const createTask = async (req, res) => {
    try {
        if (!await isMember(req.params.id, req.user._id))
            return res.status(403).json({ message: 'Not a project member' });

        const { title } = req.body;
        if (!title?.trim()) return res.status(400).json({ message: 'Title is required' });

        const task = await Task.create({
            project: req.params.id,
            title: title.trim(),
            createdBy: req.user._id,
        });

        await task.populate('createdBy', 'name avatar');
        res.status(201).json({ success: true, task });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// PATCH /api/projects/:id/tasks/:taskId
const updateTask = async (req, res) => {
    try {
        if (!await isMember(req.params.id, req.user._id))
            return res.status(403).json({ message: 'Not a project member' });

        const task = await Task.findOneAndUpdate(
            { _id: req.params.taskId, project: req.params.id },
            { status: req.body.status },
            { new: true }
        ).populate('createdBy', 'name avatar');

        if (!task) return res.status(404).json({ message: 'Task not found' });
        res.json({ success: true, task });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/projects/:id/tasks/:taskId
const deleteTask = async (req, res) => {
    try {
        if (!await isMember(req.params.id, req.user._id))
            return res.status(403).json({ message: 'Not a project member' });

        await Task.findOneAndDelete({ _id: req.params.taskId, project: req.params.id });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ── LINKS ─────────────────────────────────────────

// GET /api/projects/:id/links
const getLinks = async (req, res) => {
    try {
        if (!await isMember(req.params.id, req.user._id))
            return res.status(403).json({ message: 'Not a project member' });

        const links = await RoomLink.find({ project: req.params.id })
            .populate('addedBy', 'name avatar')
            .sort({ createdAt: -1 });

        res.json({ success: true, links });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/projects/:id/links
const createLink = async (req, res) => {
    try {
        if (!await isMember(req.params.id, req.user._id))
            return res.status(403).json({ message: 'Not a project member' });

        const { title, url } = req.body;
        if (!url?.trim()) return res.status(400).json({ message: 'URL is required' });

        const link = await RoomLink.create({
            project: req.params.id,
            title: title?.trim() || url,
            url: url.trim(),
            addedBy: req.user._id,
        });

        await link.populate('addedBy', 'name avatar');
        res.status(201).json({ success: true, link });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/projects/:id/links/:linkId
const deleteLink = async (req, res) => {
    try {
        if (!await isMember(req.params.id, req.user._id))
            return res.status(403).json({ message: 'Not a project member' });

        await RoomLink.findOneAndDelete({ _id: req.params.linkId, project: req.params.id });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// ── MEMBERS ───────────────────────────────────────

// GET /api/projects/:id/members
const getMembers = async (req, res) => {
    try {
        if (!await isMember(req.params.id, req.user._id))
            return res.status(403).json({ message: 'Not a project member' });

        const project = await Project.findById(req.params.id)
            .populate('postedBy', 'name avatar role skills github');

        // Accepted applicants
        const applications = await Application.find({
            project: req.params.id,
            status: 'accepted',
        }).populate('applicant', 'name avatar role skills github');

        const members = [
            {
                ...project.postedBy.toObject(),
                appliedRole: project.postedBy.role,
                isOwner: true,
            },
            ...applications.map(app => ({
                ...app.applicant.toObject(),
                appliedRole: app.role,
                isOwner: false,
            })),
        ];

        res.json({ success: true, members });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = {
    getTasks, createTask, updateTask, deleteTask,
    getLinks, createLink, deleteLink,
    getMembers,
};