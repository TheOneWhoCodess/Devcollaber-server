const Notification = require('../models/Notification');
const { getIO } = require('../socket/socket');

const createNotification = async ({ user, type, title, body, link, from }) => {
    try {
        const notification = await Notification.create({ user, type, title, body, link, from });

        // Push it live to the user if they're connected (personal room = userId,
        // joined in socket.js on connection). If they're offline this is a no-op;
        // the notification is already persisted above for them to fetch later.
        try {
            getIO().to(user.toString()).emit('new_notification', notification);
        } catch (socketErr) {
            // Socket server not initialized (e.g. during tests/seed scripts) — safe to ignore.
        }

        return notification;
    } catch (err) {
        console.error('Notification error:', err);
    }
};

module.exports = { createNotification };