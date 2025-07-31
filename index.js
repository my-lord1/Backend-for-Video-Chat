import { Server } from "socket.io";
import { createServer } from "http";
import express  from "express";
import { v4 as uuidv4 } from "uuid";

const roomToSocketIds = {}; // roomId => Set of socket IDs
const socketIdToRoom = {};  // socket.id => roomId

const app = express();
const server = createServer(app);
const io = new Server(server)


io.on("connection", (socket) => {
  socket.on("join-room", (roomId)=> {
    if (!roomToSocketIds[roomId]){
        roomToSocketIds[roomId] = new Set();
    }

    roomToSocketIds[roomId].add(socket.id)
    socketIdToRoom[socket.id] = roomId;

    for(let peerid of roomToSocketIds[roomId]) {
        if (peerid !== socket.id) {
            io.to(peerid).emit("user-joined", {socketId: socket.id});
        }
    }

})

socket.on("signal", ({to, type, payload}) => {
    io.to(to).emit("signal", {
        from: socket.id,
        type, //offer, answer, ice
        payload
    });
})

socket.on("disconnect", () => {
    const roomId = socketIdToRoom[socket.id];
    if (roomId && roomToSocketIds[roomId]) {
        roomToSocketIds[roomId].delete(socket.id);
        delete socketIdToRoom[socket.id];

        for (let peerid of roomToSocketIds[roomId]) {
            io.to(peerid).emit("user-disconnected", {socketId: socket.id});
        }

        if (roomToSocketIds[roomId].size === 0) {
            delete roomToSocketIds[roomId];
        }

    }
})
    
});

server.listen(4000, () => {
    console.log(`server listening on port 4000`);
  });
  