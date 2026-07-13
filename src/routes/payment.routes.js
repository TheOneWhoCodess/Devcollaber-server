const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const User = require('../models/User');
const Payment = require('../models/Payment');
const {
    createOrder,
    verifySignature,
    getPlan,
    PLANS,
} = require('../services/payment.service');

// Public-ish (but still requires auth, same as everything else) —
// lets the frontend render the plan cards without hardcoding prices.
router.get('/plans', protect, (req, res) => {
    res.json({ success: true, plans: PLANS });
});

router.post('/create-order', protect, async (req, res) => {
    try {
        const { planId } = req.body;
        const plan = getPlan(planId);
        if (!plan) {
            return res.status(400).json({ message: 'Invalid plan selected' });
        }

        const { order } = await createOrder(req.user._id, planId);

        await Payment.create({
            user: req.user._id,
            razorpayOrderId: order.id,
            amount: plan.amountPaise,
            planDurationDays: plan.durationDays,
        });

        res.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID, // public key — safe to send to frontend
            planLabel: plan.label,
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/verify', protect, async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ message: 'Missing payment verification fields' });
        }

        const isValid = verifySignature({
            orderId: razorpay_order_id,
            paymentId: razorpay_payment_id,
            signature: razorpay_signature,
        });

        if (!isValid) {
            await Payment.findOneAndUpdate(
                { razorpayOrderId: razorpay_order_id },
                { status: 'failed' }
            );
            return res.status(400).json({ message: 'Payment verification failed' });
        }

        const payment = await Payment.findOneAndUpdate(
            { razorpayOrderId: razorpay_order_id },
            { razorpayPaymentId: razorpay_payment_id, status: 'paid' },
            { new: true }
        );

        if (!payment) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Extend from current expiry if still active (stacking renewals),
        // otherwise start fresh from now.
        const user = await User.findById(req.user._id);
        const currentExpiry = user.premiumExpiresAt && new Date(user.premiumExpiresAt) > new Date()
            ? new Date(user.premiumExpiresAt)
            : new Date();
        const newExpiry = new Date(currentExpiry.getTime() + payment.planDurationDays * 24 * 60 * 60 * 1000);

        await User.findByIdAndUpdate(req.user._id, {
            plan: 'premium',
            premiumExpiresAt: newExpiry,
        });

        res.json({ success: true, plan: 'premium', premiumExpiresAt: newExpiry });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Lets the frontend check current plan status without decoding it from
// the auth token.
router.get('/status', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('plan premiumExpiresAt aiUsageCount aiUsageDate');
        res.json({ success: true, ...user.toObject() });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;