const mongoose = require('mongoose');

const FeedbackSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    category: {
        type: String,
        enum: ['bug', 'suggestion', 'praise', 'other'],
        default: 'other',
    },
    message: { type: String, required: true, maxlength: 1000 },
    status: {
        type: String,
        enum: ['new', 'reviewed'],
        default: 'new',
    },
}, { timestamps: true });

module.exports = mongoose.model('Feedback', FeedbackSchema);