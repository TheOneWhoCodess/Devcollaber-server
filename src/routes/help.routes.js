const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { chatWithHelp } = require('../services/help.service');

// Stateless — the frontend keeps the conversation in local state and
// sends the full (capped) history each turn. No chat history is
// persisted server-side.
router.post('/chat', protect, async (req, res) => {
    try {
        const { messages } = req.body;
        if (!Array.isArray(messages)) {
            return res.status(400).json({ message: 'messages must be an array' });
        }
        const { reply } = await chatWithHelp(messages);
        res.json({ success: true, reply });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;