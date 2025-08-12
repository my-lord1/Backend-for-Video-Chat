import { Server } from "socket.io";
import { createServer } from "http";
import express  from "express";
import cors from "cors";

const roomToSocketIds = {}; // roomId => Set of socket IDs
const socketIdToRoom = {};  // socket.id => roomId

const app = express();
app.use(cors({
    origin: "http://localhost:5173", // ✅ 2. Allow your frontend origin
    methods: ["GET", "POST"],
    credentials: true
  }));
const server = createServer(app);
const io = new Server(server, {
    cors: {
      origin: "http://localhost:5173", // ✅ 4. Match frontend
      methods: ["GET", "POST"],
      credentials: true
    }
  });




io.on("connection", (socket) => {
    console.log('a user connected');
    socket.emit('hello', { message: 'Hello from server!' });

  socket.on("join-room", ( {roomId} )=> {
    if (!roomToSocketIds[roomId]){
        roomToSocketIds[roomId] = new Set();
    }

    roomToSocketIds[roomId].add(socket.id)
    socketIdToRoom[socket.id] = roomId;
    console.log("Room Map:", roomToSocketIds);
    console.log("Socket → Room:", socketIdToRoom);


    for(let peerid of roomToSocketIds[roomId]) {
        if (peerid !== socket.id) {
            io.to(peerid).emit("user-joined", {socketId: socket.id});
        }
    }
    const existingPeers = Array.from(roomToSocketIds[roomId]).filter(id => id !== socket.id);
    socket.emit("existing-peers", { peers: existingPeers });
    
    console.log(`User ${socket.id} joined room ${roomId}`);
})

socket.on("signal", ({to, type, payload}) => {
    const fromRoom = socketIdToRoom[socket.id]; 
    const toRoom = socketIdToRoom[to]; 
    if (fromRoom != toRoom) {
    io.to(to).emit("signal", {
        from: socket.id,
        type, //offer, answer, ice
        payload
    });
}
    console.log(`signal sent to ${to} type${type} from ${socket.id} payload: ${payload}`);
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
  