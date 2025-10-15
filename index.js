import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

// Keep track of all connected sockets
let clients = [];

app.get("/", (req, res) => {
  res.send("Signal server listening");
});

io.on("connection", (socket) => {
  console.log(`🟢 [CONNECT] ${socket.id}`);
  clients.push(socket.id);

  // Send updated list of connected users to all clients, excluding themselves
  clients.forEach((id) => {
    const otherClients = clients.filter((clientId) => clientId !== id);
    io.to(id).emit("connected-users", otherClients);
  });

  // One-to-one start call
  socket.on("start-call", (targetUserId) => {
    if (clients.includes(targetUserId)) {
      console.log(`📨 [START-CALL] ${socket.id} -> ${targetUserId}`);
      io.to(targetUserId).emit("initiate-call", socket.id); // send caller id
    }
  });

  // Offer sent from caller to callee
  socket.on("offer", ({ offer, targetUserId }) => {
    if (clients.includes(targetUserId)) {
      console.log(`📨 [OFFER] from ${socket.id} to ${targetUserId}`);
      io.to(targetUserId).emit("offer", { offer, callerId: socket.id });
    }
  });

  // Answer sent from callee to caller
  socket.on("answer", ({ answer, targetUserId }) => {
    if (clients.includes(targetUserId)) {
      console.log(`📩 [ANSWER] from ${socket.id} to ${targetUserId}`);
      io.to(targetUserId).emit("answer", { answer, calleeId: socket.id });
    }
  });

  // ICE candidates sent between the two peers
  socket.on("ice-candidate", ({ candidate, targetUserId }) => {
    if (clients.includes(targetUserId)) {
      io.to(targetUserId).emit("ice-candidate", { candidate, from: socket.id });
    }
  });

  // Remove disconnected socket
  socket.on("disconnect", () => {
    console.log(`🔴 [DISCONNECT] ${socket.id}`);
    clients = clients.filter((id) => id !== socket.id);

    // Update remaining clients with new list (excluding themselves)
    clients.forEach((id) => {
      const otherClients = clients.filter((clientId) => clientId !== id);
      io.to(id).emit("connected-users", otherClients);
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`✅ Signaling server running on port ${PORT}`));
