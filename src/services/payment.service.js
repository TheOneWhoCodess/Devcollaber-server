const Razorpay = require('razorpay');
const crypto = require('crypto');

let _razorpay = null;
function getClient() {
    if (_razorpay) return _razorpay;
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new Error('Razorpay keys are not configured');
    }
    _razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    return _razorpay;
}

// Amounts are always in paise (smallest currency unit) for Razorpay.
// Yearly priced at roughly a 44% discount vs. 12x monthly, to make it
// the obvious "best value" pick — standard subscription pricing pattern.
const PLANS = {
    weekly: { amountPaise: 4900, durationDays: 7, label: 'Weekly' },
    monthly: { amountPaise: 14900, durationDays: 30, label: 'Monthly' },
    yearly: { amountPaise: 99900, durationDays: 365, label: 'Yearly' },
};

const getPlan = (planId) => PLANS[planId] || null;

const createOrder = async (userId, planId) => {
    const plan = getPlan(planId);
    if (!plan) throw new Error(`Unknown plan: ${planId}`);

    const razorpay = getClient();
    const order = await razorpay.orders.create({
        amount: plan.amountPaise,
        currency: 'INR',
        receipt: `premium_${planId}_${userId}_${Date.now()}`,
    });
    return { order, plan };
};

// Verifies the signature Razorpay's Checkout returns after a successful
// payment. This MUST happen server-side — the browser response can be
// tampered with, only a signature match (computed with the secret key,
// never sent to the client) proves the payment is genuine.
const verifySignature = ({ orderId, paymentId, signature }) => {
    const expected = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');
    return expected === signature;
};

module.exports = {
    createOrder,
    verifySignature,
    getPlan,
    PLANS,
};