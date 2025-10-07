import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }, // allow all origins
});

let clients = [];

io.on("connection", (socket) => {
  clients.push(socket.id);

  socket.on("ready", () => {
    const other = clients.find(id => id !== socket.id);
    if (other) {
      // Tell the second client to start the offer
      socket.emit("initiate-call");
    }
  });

  socket.on("offer", (offer) => {
    const other = clients.find(id => id !== socket.id);
    if (other) socket.to(other).emit("offer", offer);
  });

  socket.on("answer", (answer) => {
    const other = clients.find(id => id !== socket.id);
    if (other) socket.to(other).emit("answer", answer);
  });

  socket.on("ice-candidate", (candidate) => {
    const other = clients.find(id => id !== socket.id);
    if (other) socket.to(other).emit("ice-candidate", candidate);
  });

  socket.on("disconnect", () => {
    clients = clients.filter(id => id !== socket.id);
  });
});


const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Signaling server running on port ${PORT}`));