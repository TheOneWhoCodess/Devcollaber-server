const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const { protect } = require('../middleware/auth.middleware');

router.get('/', protect, async (req, res) => {
    try {
        const matches = await Match.find({ users: req.user._id })
            .populate('users', 'name avatar role skills bio')
            .sort({ matchedAt: -1 });

        res.json({ success: true, matches });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;