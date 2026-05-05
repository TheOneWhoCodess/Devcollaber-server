const Notification = require('../models/Notification');

const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ user: req.user._id })
            .populate('from', 'name avatar')
            .sort({ createdAt: -1 })
            .limit(30);

        const unreadCount = await Notification.countDocuments({ user: req.user._id, read: false });
        res.json({ success: true, notifications, unreadCount });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const markAllRead = async (req, res) => {
    try {
        await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const markRead = async (req, res) => {
    try {
        await Notification.findByIdAndUpdate(req.params.id, { read: true });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getNotifications, markAllRead, markRead };