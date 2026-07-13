const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');
const { protect } = require('../middleware/auth.middleware');

router.post('/', protect, async (req, res) => {
    try {
        const { rating, category, message } = req.body;
        if (!message || !message.trim()) {
            return res.status(400).json({ message: 'Feedback message is required' });
        }
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Rating must be between 1 and 5' });
        }

        const feedback = await Feedback.create({
            user: req.user._id,
            rating,
            category: category || 'other',
            message: message.trim(),
        });

        res.json({ success: true, feedback });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Lets a user see their own past feedback submissions.
router.get('/', protect, async (req, res) => {
    try {
        const feedback = await Feedback.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json({ success: true, feedback });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;