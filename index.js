import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

// Store clients as objects: { socketId, email }
let clients = [];

app.get("/", (req, res) => {
  res.send("Signal server listening");
});

io.on("connection", (socket) => {
  console.log(`🟢 [CONNECT] ${socket.id}`);
  clients.push({ socketId: socket.id, email: null });

  const updateClientList = () => {
    clients.forEach((client) => {
      const otherClients = clients
        .filter((c) => c.socketId !== client.socketId && c.email)
        .map((c) => ({ socketId: c.socketId, email: c.email }));
      io.to(client.socketId).emit("connected-users", otherClients);
    });
  };

  updateClientList();

  // Register or update email
  socket.on("register-email", (email) => {
    const client = clients.find((c) => c.socketId === socket.id);
    if (client) {
      // If email changed, disconnect any current call
      if (client.email && client.email !== email) {
        io.to(socket.id).emit("disconnect-call");
      }
      client.email = email;
      console.log(`📧 [EMAIL] ${socket.id} -> ${email}`);
      updateClientList();
    }
  });

  // One-to-one start call
  socket.on("start-call", (targetUserId) => {
    const target = clients.find((c) => c.socketId === targetUserId);
    if (target) {
      console.log(`📨 [START-CALL] ${socket.id} -> ${targetUserId}`);
      io.to(targetUserId).emit("initiate-call", socket.id);
    }
  });

  // Offer sent from caller to callee
  socket.on("offer", ({ offer, targetUserId }) => {
    const target = clients.find((c) => c.socketId === targetUserId);
    if (target) {
      io.to(targetUserId).emit("offer", { offer, callerId: socket.id });
    }
  });

  // Answer sent from callee to caller
  socket.on("answer", ({ answer, targetUserId }) => {
    const target = clients.find((c) => c.socketId === targetUserId);
    if (target) {
      io.to(targetUserId).emit("answer", { answer, calleeId: socket.id });
    }
  });

  // ICE candidates
  socket.on("ice-candidate", ({ candidate, targetUserId }) => {
    const target = clients.find((c) => c.socketId === targetUserId);
    if (target) {
      io.to(targetUserId).emit("ice-candidate", { candidate, from: socket.id });
    }
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log(`🔴 [DISCONNECT] ${socket.id}`);
    clients = clients.filter((c) => c.socketId !== socket.id);
    updateClientList();
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () =>
  console.log(`✅ Signaling server running on port ${PORT}`)
);
