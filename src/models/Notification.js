const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
        type: String,
        enum: ['new_match', 'new_message', 'new_application', 'application_accepted', 'application_rejected'],
        required: true,
    },
    title: String,
    body: String,
    link: String,
    read: { type: Boolean, default: false },
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Notification', NotificationSchema);