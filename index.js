import { Server } from "socket.io";
import { createServer } from "http";
import express  from "express";
import cors from "cors";
const socketIdToDevices= {};
const roomToSocketIds = {}; // roomId => Set of socket IDs
const socketIdToRoom = {};  // socket.id => roomId
const socketIdToUserName = {}; // socket.id => Username
const roomIdToScreenShare = {}; // roomId => socketid of screenshare user

const app = express();
app.use(cors({
    origin: "videochat-two.vercel.app", 
    methods: ["GET", "POST"],
    credentials: true
  }));
const server = createServer(app);
const io = new Server(server, {
    cors: {
      origin: "videochat-two.vercel.app", 
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
        socket.emit("peer-usernames", {peerusernames: socketIdToUserName});
        console.log("socket -> userName:", socketIdToUserName);
        console.log("Room Map:", roomToSocketIds);
        console.log("Socket → Room:", socketIdToRoom);


        for(let peerid of roomToSocketIds[roomId]) {
            if (peerid !== socket.id) {
                io.to(peerid).emit("user-joined", {socketId: socket.id});
            }
        }
        const existingPeers = Array.from(roomToSocketIds[roomId]).filter(id => id !== socket.id);
        
        socket.emit("existing-peers", { peers: existingPeers});
        const sharerId = roomIdToScreenShare[roomId] || null;
        socket.emit("screen-share-status", { sharerId });
        console.log(`User ${socket.id} joined room ${roomId}`);
    })

    socket.on("signal", ({ to, type, payload, remoteName2 }) => {
        const fromRoom = socketIdToRoom[socket.id]; 
        if (!fromRoom) return; 


        if (to) {
            const toRoom = socketIdToRoom[to];
            if (toRoom === fromRoom) {
                io.to(to).emit("signal", {
                    from: socket.id,
                    type, 
                    payload,
                    remoteName2: socketIdToUserName[socket.id]
                });
            }
        } else {
            
            socket.to(fromRoom).emit("signal", {
                from: socket.id,
                type,
                payload,
                remoteName2: socketIdToUserName[socket.id]
            });
    }

    });


    socket.on("disconnect", () => {
        const roomId = socketIdToRoom[socket.id];
        if (roomId && roomToSocketIds[roomId]) {
            roomToSocketIds[roomId].delete(socket.id);
            delete socketIdToRoom[socket.id];
            delete socketIdToUserName[socket.id];
            delete roomIdToScreenShare[roomId];
            delete socketIdToDevices[socket.id];
            io.in(roomId).emit("users-box", {
                devices: socketIdToDevices// changed to send the hashmap
            })

            for (let peerid of roomToSocketIds[roomId]) {
                io.to(peerid).emit("user-disconnected", {socketId: socket.id});
            }
            if (roomToSocketIds[roomId].size === 0) {
                delete roomToSocketIds[roomId];
            }
            if (roomIdToScreenShare[roomId] === socket.id) {
              delete roomIdToScreenShare[roomId];
              
              socket.to(roomId).emit("screen-share-state-update", {
                isActive: false,
                sharerId: null,
                sharerSocketId: null
              });
            }
        }
        console.log(`User ${socket.id} disconnected from room ${roomId}`);
    })

    socket.on("start-screen-share", ({ roomId }) => {
        const current = roomIdToScreenShare[roomId];
        if (current && current !== socket.id) {
          socket.emit("screen-share-already-active");
          return;
        }
        roomIdToScreenShare[roomId] = socket.id;
        io.to(roomId).emit("screen-share-state-update", {
          isActive: true,
          sharerId: socket.id,
          sharerSocketId: socket.id
        });
      });
    
      socket.on("stop-screen-share", ({ roomId }) => {
        if (roomIdToScreenShare[roomId] === socket.id) {
          delete roomIdToScreenShare[roomId];
          io.to(roomId).emit("screen-share-state-update", {
            isActive: false,
            sharerId: null,
            sharerSocketId: null
          });
        }
      });

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
      socket.join(roomId)
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

  socket.on("disconnect", ({roomId})=> {
      delete socketIdToDevices[socket.id];
      io.in(roomId).emit("users-box", {
          devices: socketIdToDevices// changed to send the hashmap
      })
  })


});

server.listen(4000, () => {
    console.log(`server listening on port 4000`);
  });
//9