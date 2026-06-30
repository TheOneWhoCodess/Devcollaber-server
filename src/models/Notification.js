const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
        type: String,
        enum: ['new_match', 'new_message', 'new_application', 'application_accepted', 'application_rejected', 'project_invite'],
        required: true,
    },
    title: String,
    body: String,
    link: String,
    read: { type: Boolean, default: false },
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Every notification fetch is "this user's unread, newest first" —
// this compound index covers that query directly instead of scanning.
NotificationSchema.index({ user: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);