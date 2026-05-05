const Notification = require('../models/Notification');

const createNotification = async ({ user, type, title, body, link, from }) => {
    try {
        await Notification.create({ user, type, title, body, link, from });
    } catch (err) {
        console.error('Notification error:', err);
    }
};

module.exports = { createNotification };