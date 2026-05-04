const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, maxlength: 2000 },
    type: { type: String, enum: ['text', 'project_proposal'], default: 'text' },
    read: { type: Boolean, default: false },
}, { timestamps: true });

MessageSchema.index({ matchId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', MessageSchema);