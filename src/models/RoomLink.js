const mongoose = require('mongoose');

const RoomLinkSchema = new mongoose.Schema({
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
    },
    url: {
        type: String,
        required: true,
    },
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
}, { timestamps: true });

module.exports = mongoose.model('RoomLink', RoomLinkSchema);