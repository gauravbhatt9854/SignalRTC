import { useState, useRef, useEffect } from "react";
import { io } from "socket.io-client";

export function useWebRTC(email) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const socketRef = useRef(null);
  const connectedUsersRef = useRef([]);

  const [connectedUsers, setConnectedUsers] = useState([]);
  const [mySocketId, setMySocketId] = useState(null);
  const [started, setStarted] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const [targetUser, setTargetUser] = useState(null);

  useEffect(() => {
    if (!email) return;

    const socket = io(import.meta.env.VITE_SIGNALING_SERVER);
    socketRef.current = socket;

    socket.on("connect", () => {
      setMySocketId(socket.id);
      socket.emit("register-email", email);
    });

    socket.on("connected-users", (users) => {
      setConnectedUsers(users);
      connectedUsersRef.current = users;
    });

    socket.on("initiate-call", ({ callerId, offer }) => {
      const caller = connectedUsersRef.current.find(u => u.socketId === callerId);
      setIncomingCall({ socketId: callerId, email: caller?.email || "Unknown", offer });
    });

    socket.on("answer", async ({ answer }) => {
      if (pcRef.current) await pcRef.current.setRemoteDescription(answer);
    });

    socket.on("ice-candidate", async ({ candidate }) => {
      if (pcRef.current && candidate) await pcRef.current.addIceCandidate(candidate);
    });

    socket.on("disconnect-call", endCall);

    return () => {
      socket.disconnect();
      pcRef.current?.close();
    };
  }, [email]);

  const createPeerConnection = (targetId) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        {
          urls: import.meta.env.VITE_TURN_URL,
          username: import.meta.env.VITE_TURN_USERNAME,
          credential: import.meta.env.VITE_TURN_PASSWORD,
        },
      ],
    });

    pc.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && targetId) {
        socketRef.current.emit("ice-candidate", { candidate: event.candidate, targetUserId: targetId });
      }
    };

    return pc;
  };

  const startCall = async (targetId) => {
    setTargetUser(targetId);

    // Close any previous peer connection before creating a new one
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    const pc = createPeerConnection(targetId);
    pcRef.current = pc;

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideoRef.current.srcObject = stream;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // FIXED: Send the offer using the correct key matching backend
    socketRef.current.emit("initiate-call", { targetId, offer });
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    const { socketId, offer } = incomingCall;
    setTargetUser(socketId);

    await handleReceiveOffer(offer, socketId);
    setIncomingCall(null);
  };

  const declineCall = () => {
    setIncomingCall(null);
  };

  const handleReceiveOffer = async (offer, callerId) => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    const pc = createPeerConnection(callerId);
    pcRef.current = pc;

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideoRef.current.srcObject = stream;
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socketRef.current.emit("answer", { answer, targetUserId: callerId });
    setStarted(true);
  };

  const endCall = () => {
    pcRef.current?.close();
    pcRef.current = null;
    setTargetUser(null);
    setStarted(false);
    localVideoRef.current.srcObject = null;
    remoteVideoRef.current.srcObject = null;
  };

  return {
    localVideoRef,
    remoteVideoRef,
    connectedUsers,
    started,
    incomingCall,
    mySocketId,
    startCall,
    acceptCall,
    declineCall,
    endCall,
  };
}