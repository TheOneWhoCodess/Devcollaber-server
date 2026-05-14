const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
    },
    status: {
        type: String,
        enum: ['todo', 'inprogress', 'done'],
        default: 'todo',
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
}, { timestamps: true });

module.exports = mongoose.model('Task', TaskSchema);