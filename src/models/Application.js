const mongoose = require('mongoose');

const ApplicationSchema = new mongoose.Schema({
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
    },
    applicant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    message: {
        type: String,
        maxlength: 500,
    },
    role: {
        type: String,
        enum: ['frontend', 'backend', 'fullstack', 'devops', 'ml', 'mobile'],
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected'],
        default: 'pending',
    },
}, { timestamps: true });

// One application per user per project
ApplicationSchema.index({ project: 1, applicant: 1 }, { unique: true });

module.exports = mongoose.model('Application', ApplicationSchema);