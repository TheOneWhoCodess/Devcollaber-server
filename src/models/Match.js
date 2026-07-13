const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    matchScore: { type: Number },            // computed skill overlap %
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
    matchedAt: { type: Date, default: Date.now },
    matchExplanation: { type: String },      // AI-generated "why you match" text
    explanationStatus: {
        type: String,
        enum: ['pending', 'ready', 'failed'],
        default: 'pending',
    },
    // AI-generated project idea combining both matched users' skills.
    // Generated on-demand (button click), not automatically like the
    // match explanation, since it's a heavier/more optional feature.
    projectIdea: {
        title: { type: String },
        description: { type: String },
        techStack: [{ type: String }],
    },
    projectIdeaStatus: {
        type: String,
        enum: ['none', 'pending', 'ready', 'failed'],
        default: 'none',
    },
}, { timestamps: true });

MatchSchema.index({ users: 1 });

module.exports = mongoose.model('Match', MatchSchema);