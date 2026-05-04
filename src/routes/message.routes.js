const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Match = require('../models/Match');
const { protect } = require('../middleware/auth.middleware');

router.get('/:matchId', protect, async (req, res) => {
    try {
        const match = await Match.findOne({
            _id: req.params.matchId,
            users: req.user._id,
        });

        if (!match) return res.status(403).json({ message: 'Not authorized' });

        const messages = await Message.find({ matchId: req.params.matchId })
            .populate('sender', 'name avatar')
            .sort({ createdAt: 1 });

        res.json({ success: true, messages });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;