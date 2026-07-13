const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },
    avatar: { type: String, default: '' },
    bio: { type: String, maxlength: 300 },
    role: { type: String, enum: ['frontend', 'backend', 'fullstack', 'devops', 'ml', 'mobile'], required: true },
    skills: [{ type: String }],
    lookingFor: [{ type: String }],        // roles they want to partner with
    projectIdea: { type: String, maxlength: 500 },
    projectType: { type: String, enum: ['saas', 'opensource', 'startup', 'sideproject'] },
    commitment: { type: String, enum: ['parttime', 'fulltime', 'flexible'] },
    experience: { type: Number, default: 0 },
    github: { type: String, default: '' },
    githubSummary: { type: String, default: '' },     // AI-generated plain-English repo summary
    githubSummaryUpdatedAt: { type: Date },
    linkedin: { type: String, default: '' },
    isAvailable: { type: Boolean, default: true },
    location: { type: String },
    eloScore: { type: Number, default: 1200 },   // for match ranking

    // --- Business model / premium tier ---
    plan: {
        type: String,
        enum: ['free', 'premium'],
        default: 'free',
    },
    premiumExpiresAt: {
        type: Date,
    },

    // --- Free-tier daily AI usage tracking ---
    // Counts toward a daily cap on AI-powered actions (GitHub sync,
    // Project Idea generation, Match Concierge). Premium users bypass
    // this cap entirely — see checkAiUsageLimit middleware.
    aiUsageCount: {
        type: Number,
        default: 0,
    },
    aiUsageDate: {
        type: Date, // the day aiUsageCount is counting for; reset when this is stale
    },
}, { timestamps: true });

UserSchema.pre('save', async function () {
    if (!this.isModified('password')) return;
    this.password = await bcrypt.hash(this.password, 10);
});

UserSchema.methods.matchPassword = function (entered) {
    return bcrypt.compare(entered, this.password);
};

UserSchema.index({ skills: 1, role: 1, isAvailable: 1 });
// Discover feed filters by availability then sorts by ELO descending —
// this compound index lets Mongo satisfy that query without an in-memory sort.
UserSchema.index({ isAvailable: 1, eloScore: -1 });

module.exports = mongoose.model('User', UserSchema);