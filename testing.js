import { Server } from "socket.io";
import { createServer } from "http";
import express  from "express";
import cors from "cors";

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
const socketIdToDevices= {}; // socket.id => devices list

io.on("connection", (socket)=> {
    socket.join(roomId)
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

    socket.on("disconnect", ()=> {
        delete socketIdToDevices[socket.id];
        io.in(roomId).emit("users-box", {
            devices: socketIdToDevices// changed to send the hashmap
        })
    })
})

server.listen(3000, () => {
    console.log(`server listening on port 3000`);
  });
//9