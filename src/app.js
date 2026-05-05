const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth.routes');
const profileRoutes = require('./routes/profile.routes');
const swipeRoutes = require('./routes/swipe.routes');
const matchRoutes = require('./routes/match.routes');
const messageRoutes = require('./routes/message.routes');
const projectRoutes = require('./routes/project.routes');
connectDB();
const app = express();

app.use(helmet());
app.use(cors({
    origin: function (origin, callback) {
        const allowed = [
            process.env.CLIENT_URL,
            'https://dev-collaber-fe-eight.vercel.app',
            'http://localhost:3000'
        ];
        if (!origin || allowed.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(cookieParser());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500 });

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/swipe', swipeRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/messages', messageRoutes);

app.use('/api/profile', limiter);
app.use('/api/swipe', limiter);
app.use('/api/matches', limiter);
app.use('/api/messages', limiter);
app.use('/api/projects', projectRoutes);
module.exports = app;