const express = require('express');
const router = express.Router();
const {
    getProjects, getProject, createProject, updateProject,
    deleteProject, getMyProjects, applyToProject,
    getApplications, updateApplication,
} = require('../controllers/project.controller');
const {
    getTasks, createTask, updateTask, deleteTask,
    getLinks, createLink, deleteLink,
    getMembers,
} = require('../controllers/room.controller');
const { protect } = require('../middleware/auth.middleware');

// existing routes
router.get('/', protect, getProjects);
router.get('/mine', protect, getMyProjects);
router.get('/:id', protect, getProject);
router.post('/', protect, createProject);
router.put('/:id', protect, updateProject);
router.delete('/:id', protect, deleteProject);
router.post('/:id/apply', protect, applyToProject);
router.get('/:id/applications', protect, getApplications);
router.put('/:id/applications/:appId', protect, updateApplication);

// ✅ room routes
router.get('/:id/tasks', protect, getTasks);
router.post('/:id/tasks', protect, createTask);
router.patch('/:id/tasks/:taskId', protect, updateTask);
router.delete('/:id/tasks/:taskId', protect, deleteTask);

router.get('/:id/links', protect, getLinks);
router.post('/:id/links', protect, createLink);
router.delete('/:id/links/:linkId', protect, deleteLink);

router.get('/:id/members', protect, getMembers);

module.exports = router;