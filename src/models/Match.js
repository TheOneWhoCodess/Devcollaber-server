const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    matchScore: { type: Number },            // computed skill overlap %
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
    matchedAt: { type: Date, default: Date.now },
}, { timestamps: true });

MatchSchema.index({ users: 1 });

module.exports = mongoose.model('Match', MatchSchema);