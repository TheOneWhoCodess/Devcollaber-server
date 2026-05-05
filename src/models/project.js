const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
    },
    description: {
        type: String,
        required: true,
        maxlength: 1000,
    },
    techStack: [{
        type: String,
        trim: true,
    }],
    rolesNeeded: [{
        type: String,
        enum: ['frontend', 'backend', 'fullstack', 'devops', 'ml', 'mobile'],
    }],
    stage: {
        type: String,
        enum: ['idea', 'mvp', 'building', 'launched'],
        default: 'idea',
    },
    commitment: {
        type: String,
        enum: ['parttime', 'fulltime', 'flexible'],
    },
    projectType: {
        type: String,
        enum: ['saas', 'opensource', 'startup', 'sideproject'],
    },
    postedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    openPositions: {
        type: Number,
        default: 1,
    },
    isOpen: {
        type: Boolean,
        default: true,
    },
    github: String,
    website: String,
}, { timestamps: true });

module.exports = mongoose.model('Project', ProjectSchema);