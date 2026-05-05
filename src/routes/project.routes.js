const express = require('express');
const router = express.Router();
const {
    getProjects, getProject, createProject, updateProject,
    deleteProject, getMyProjects, applyToProject,
    getApplications, updateApplication,
} = require('../controllers/project.controller');
const { protect } = require('../middleware/auth.middleware');

router.get('/', protect, getProjects);
router.get('/mine', protect, getMyProjects);
router.get('/:id', protect, getProject);
router.post('/', protect, createProject);
router.put('/:id', protect, updateProject);
router.delete('/:id', protect, deleteProject);
router.post('/:id/apply', protect, applyToProject);
router.get('/:id/applications', protect, getApplications);
router.put('/:id/applications/:appId', protect, updateApplication);

module.exports = router;