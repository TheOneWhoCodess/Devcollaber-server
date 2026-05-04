const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const Match = require('../models/Match');

let io;

const initSocket = (server) => {
    io = new Server(server, {
        cors: { origin: process.env.CLIENT_URL, credentials: true },
    });

    // JWT auth middleware for socket
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error('Auth error'));
        try {
            socket.user = jwt.verify(token, process.env.JWT_SECRET);
            next();
        } catch {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        const userId = socket.user.id;
        socket.join(userId);   // personal room for notifications

        socket.on('join_match', async ({ matchId }) => {
            // Verify user is part of this match before joining room
            const match = await Match.findOne({ _id: matchId, users: userId });
            if (match) socket.join(`match:${matchId}`);
        });

        socket.on('send_message', async ({ matchId, content, type = 'text' }) => {
            try {
                const match = await Match.findOne({ _id: matchId, users: userId });
                if (!match) return;

                const message = await Message.create({
                    matchId, sender: userId, content, type,
                });
                await message.populate('sender', 'name avatar');

                io.to(`match:${matchId}`).emit('receive_message', message);
            } catch (err) {
                socket.emit('error', { message: err.message });
            }
        });

        socket.on('typing', ({ matchId }) => {
            socket.to(`match:${matchId}`).emit('user_typing', { userId });
        });

        socket.on('disconnect', () => {
            io.emit('user_offline', { userId });
        });
    });
};

const getIO = () => {
    if (!io) throw new Error('Socket not initialized');
    return io;
};

module.exports = { initSocket, getIO };