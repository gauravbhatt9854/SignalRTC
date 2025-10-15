import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

let clients = [];

app.get("/", (req, res) => {
  res.send("signal server listening");
});

io.on("connection", (socket) => {
  console.log(`🟢 [CONNECT] ${socket.id}`);
  clients.push(socket.id);
  io.emit("connected-users", clients);


  // New start-call event from frontend
  socket.on("start-call", (targetUserId) => {
    console.log(`📨 [START-CALL] from ${socket.id} to ${targetUserId}`);
    if (clients.includes(targetUserId)) {
      io.to(targetUserId).emit("initiate-call");
    }
  });

  socket.on("offer", (offer) => {
    console.log(`📨 [OFFER] from ${socket.id}`);
    const other = clients.find((id) => id !== socket.id);
    if (other) io.to(other).emit("offer", offer);
  });

  socket.on("answer", (answer) => {
    console.log(`📩 [ANSWER] from ${socket.id}`);
    const other = clients.find((id) => id !== socket.id);
    if (other) io.to(other).emit("answer", answer);
  });

  socket.on("ice-candidate", (candidate) => {
    console.log(`❄️ [ICE] from ${socket.id}`);
    const other = clients.find((id) => id !== socket.id);
    if (other) io.to(other).emit("ice-candidate", candidate);
  });

  socket.on("disconnect", () => {
    console.log(`🔴 [DISCONNECT] ${socket.id}`);
    clients = clients.filter((id) => id !== socket.id);
    io.emit("connected-users", clients);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`✅ Signaling server running on port ${PORT}`));
