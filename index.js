import { Server } from "socket.io";
import { createServer } from "http";
import express  from "express";
import cors from "cors";

const roomToSocketIds = {}; // roomId => Set of socket IDs
const socketIdToRoom = {};  // socket.id => roomId
const socketIdToUserName = {}; // socket.id => Username
const socketIdToDevices= {}; // socket.id => devices list

const app = express();
app.use(cors({
    origin: "http://localhost:5173", 
    methods: ["GET", "POST"],
    credentials: true
  }));
const server = createServer(app);
const io = new Server(server, {
    cors: {
      origin: "http://localhost:5173", 
      methods: ["GET", "POST"],
      credentials: true
    }
  });

io.on("connection", (socket) => {
    console.log('a user connected');
    socket.emit('hello', { message: 'Hello from server!' });

    socket.on("join-room", ( {roomId, userName} )=> {
        socket.join(roomId)
        console.log("roomID", roomId)
        if (!roomToSocketIds[roomId]){
            roomToSocketIds[roomId] = new Set(); 
        }

        roomToSocketIds[roomId].add(socket.id)
        socketIdToRoom[socket.id] = roomId;
        socketIdToUserName[socket.id] = userName //assinging socketid to username
        console.log("socket -> userName:", socketIdToRoom)
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

    socket.on("signal", ({ to, type, payload }) => {
        const fromRoom = socketIdToRoom[socket.id]; 
        if (!fromRoom) return; 


        if (to) {
            const toRoom = socketIdToRoom[to];
            if (toRoom === fromRoom) {
                io.to(to).emit("signal", {
                    from: socket.id,
                    type, 
                    payload
                });
            }
        } else {
            
            socket.to(fromRoom).emit("signal", {
                from: socket.id,
                type,
                payload
            });
    }
    console.log(
        `Signal from ${socket.id} (${type}) → ${
            to || "all peers in room"
        } payload:`,
        JSON.stringify(payload, null, 2)
    );
    });


    socket.on("disconnect", () => {
        const roomId = socketIdToRoom[socket.id];
        if (roomId && roomToSocketIds[roomId]) {
            roomToSocketIds[roomId].delete(socket.id);
            delete socketIdToRoom[socket.id];
            delete socketIdToUserName[socket.id];
            delete socketIdToDevices[socket.id]
            
            io.in(roomId).emit("users-box", {
                devices: socketIdToDevices// changed to send the hashmap
            })

            for (let peerid of roomToSocketIds[roomId]) {
                io.to(peerid).emit("user-disconnected", {socketId: socket.id});
            }

            if (roomToSocketIds[roomId].size === 0) {
                delete roomToSocketIds[roomId];
            }

        }
        console.log(`User ${socket.id} disconnected from room ${roomId}`);
    })

    socket.on("sendMessage", ({roomId, userName, message}) => {
        console.log("Emitting to room:", roomId); 
        io.in(roomId).emit("chat-box", {
            socketId: socket.id, 
            userName,
            message,
            ts: Date.now(),
        })
        console.log("Message sent to room", message); 
    })
    
   
    socket.on("seeUsers", ({roomId, userName, isvideoON, isaudioON})=> {
        socketIdToDevices[socket.id] = {
            userName, 
            isvideoON, 
            isaudioON
        }
        console.log("opened the seeUsers event", isvideoON, isaudioON);
        io.in(roomId).emit("users-box", {
            devices: socketIdToDevices // changed to send the hashmap
        })
        console.log("Message sent to room");
    })
});

server.listen(4000, () => {
    console.log(`server listening on port 3000`);
  });
        