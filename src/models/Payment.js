const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    razorpayOrderId: { type: String, required: true },
    razorpayPaymentId: { type: String },
    amount: { type: Number, required: true }, // in paise
    currency: { type: String, default: 'INR' },
    status: {
        type: String,
        enum: ['created', 'paid', 'failed'],
        default: 'created',
    },
    planDurationDays: { type: Number, default: 30 },
}, { timestamps: true });

module.exports = mongoose.model('Payment', PaymentSchema);