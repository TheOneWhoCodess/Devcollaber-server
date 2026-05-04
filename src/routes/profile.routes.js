const express = require('express');
const router = express.Router();
const { getDiscoverFeed, updateProfile, uploadAvatar } = require('../controllers/profile.controller');
const { protect } = require('../middleware/auth.middleware');
const multer = require('multer');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files allowed'));
    },
});

router.get('/discover', protect, getDiscoverFeed);
router.put('/update', protect, updateProfile);
router.post('/avatar', protect, upload.single('avatar'), uploadAvatar);

module.exports = router;