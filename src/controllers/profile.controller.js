const User = require('../models/User');
const Swipe = require('../models/Swipe');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadToCloudinary = (buffer) => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: 'devcollab_avatars',
                transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        streamifier.createReadStream(buffer).pipe(stream);
    });
};

const uploadAvatar = async (req, res) => {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const user = await User.findById(req.user._id);

        // Delete old Cloudinary avatar if exists
        if (user.avatar && user.avatar.includes('cloudinary')) {
            const publicId = user.avatar.split('/').pop().split('.')[0];
            await cloudinary.uploader.destroy(`devcollab_avatars/${publicId}`);
        }

        const result = await uploadToCloudinary(req.file.buffer);

        // Only update the avatar field — don't touch anything else
        await User.findByIdAndUpdate(req.user._id, { avatar: result.secure_url });

        res.json({ success: true, avatar: result.secure_url });
    } catch (err) {
        console.error('Avatar upload error:', err);
        res.status(500).json({ message: err.message });
    }
};

const getDiscoverFeed = async (req, res) => {
    try {
        const { role, skills, commitment, projectType, search, limit = 10 } = req.query;
        const swiped = await Swipe.find({ from: req.user._id }).select('to');
        const swipedIds = swiped.map(s => s.to);

        const filter = {
            _id: { $ne: req.user._id, $nin: swipedIds },
            isAvailable: true,
        };

        if (role) filter.role = role;
        if (commitment) filter.commitment = commitment;
        if (projectType) filter.projectType = projectType;
        if (skills) filter.skills = { $in: skills.split(',') };
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { skills: { $in: [new RegExp(search, 'i')] } },
                { role: { $regex: search, $options: 'i' } },
            ];
        }
        const profiles = await User.find(filter)
            .select('-password -email')
            .sort({ eloScore: -1 })
            .limit(Number(limit));

        res.json({ success: true, profiles });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const updateProfile = async (req, res) => {
    try {
        const allowed = [
            'name', 'bio', 'role', 'skills', 'lookingFor', 'projectIdea',
            'projectType', 'commitment', 'experience', 'github', 'linkedin',
            'isAvailable', 'location'
        ];
        const updates = {};
        allowed.forEach(key => {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        });

        const user = await User.findByIdAndUpdate(
            req.user._id, updates, { new: true }
        ).select('-password');

        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const getPublicProfile = async (req, res) => {
    try {
        const user = await User.findOne({
            name: { $regex: new RegExp(`^${req.params.name}$`, 'i') }
        }).select('-password -email');

        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

module.exports = { getDiscoverFeed, updateProfile, uploadAvatar, getPublicProfile };