const rooms = {};  // roomId → array of socketIds

function socketController(io) {
    io.on('connection', (socket) => {
        // console.log('New socket connected:', socket.id);

        socket.on('join', (roomId) => {
            if (!rooms[roomId]) {
                rooms[roomId] = [];
            }

            rooms[roomId].push(socket.id);
            socket.join(roomId);

            // console.log(`${socket.id} joined room ${roomId}`);

            const otherUsers = rooms[roomId].filter(id => id !== socket.id);
            socket.emit('all-users', otherUsers);

            socket.to(roomId).emit('user-joined', socket.id);
        });

        // WebRTC Offer
        socket.on('offer', ({ to, from, offer }) => {
            io.to(to).emit('offer', { from, offer });
        });

        // WebRTC Answer
        socket.on('answer', ({ to, from, answer }) => {
            io.to(to).emit('answer', { from, answer });
        });

        // WebRTC ICE Candidates
        socket.on('ice-candidate', ({ to, from, candidate }) => {
            io.to(to).emit('ice-candidate', { from, candidate });
        });

        // Chat Broadcast
        socket.on('chat', ({room, msg}) => {
            io.to(room).emit('chat', msg);
        });

        // User manually leaving a room
        socket.on('leave', ({ room, id }) => {
            socket.leave(room);
            if (rooms[room]) {
                rooms[room] = rooms[room].filter(userId => userId !== id);
                if (rooms[room].length === 0) delete rooms[room];
            }
            socket.to(room).emit('user-left', id);
        });

        // Handle socket disconnect
        socket.on('disconnect', () => {
            // console.log('Socket disconnected:', socket.id);

            // Remove user from all rooms they were part of
            for (const roomId in rooms) {
                const index = rooms[roomId].indexOf(socket.id);
                if (index !== -1) {
                    rooms[roomId].splice(index, 1);
                    socket.to(roomId).emit('user-left', socket.id);
                    if (rooms[roomId].length === 0) delete rooms[roomId];
                }
            }
        });
    });
}

module.exports = socketController;
