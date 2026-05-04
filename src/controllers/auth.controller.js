const User = require('../models/User');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}

const signToken = (id) =>
    jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

const sendTokenResponse = (user, statusCode, isNewUser, res) => {
    const token = signToken(user._id);
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.status(statusCode).json({
        success: true,
        isNewUser,
        user: { _id: user._id, name: user.name, email: user.email, role: user.role, avatar: user.avatar },
    });
};

const googleAuth = async (req, res) => {
    try {
        const { idToken } = req.body;
        if (!idToken) return res.status(400).json({ message: 'ID token required' });

        const decoded = await admin.auth().verifyIdToken(idToken);
        const { uid, email, name, picture } = decoded;

        let user = await User.findOne({ email });
        let isNewUser = false;

        if (!user) {
            isNewUser = true;
            user = await User.create({
                name: name || email.split('@')[0],
                email,
                password: uid,
                avatar: picture || '',
                role: 'fullstack',      // overwritten in profile-setup
            });
        }

        sendTokenResponse(user, isNewUser ? 201 : 200, isNewUser, res);
    } catch (err) {
        console.error('Google auth error:', err);
        res.status(401).json({ message: 'Invalid or expired token' });
    }
};

const logout = (req, res) => {
    res.cookie('token', '', { maxAge: 1 });
    res.json({ success: true });
};

const getMe = (req, res) => {
    const token = req.cookies.token;
    res.json({ success: true, user: req.user, token });
};
module.exports = { logout, getMe, googleAuth };