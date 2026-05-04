const mongoose = require('mongoose');

const SwipeSchema = new mongoose.Schema({
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, enum: ['like', 'pass', 'superlike'], required: true },
}, { timestamps: true });

SwipeSchema.index({ from: 1, to: 1 }, { unique: true });

module.exports = mongoose.model('Swipe', SwipeSchema);