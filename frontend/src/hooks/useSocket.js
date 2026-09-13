import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";

const API_URL = process.env.VITE_API_URL || "http://localhost:3000";

export function createAuthedSocket(token) {
  return io(API_URL, {
    auth: { token },
    // Don't force websocket-only: polling fallback makes local + Render deploys more reliable.
    transports: ["polling", "websocket"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 500
  });
}

export function useSocket(token) {
  const socket = useMemo(() => createAuthedSocket(token), [token]);
  const [connected, setConnected] = useState(() => socket.connected);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onConnectError = (err) => {
      // eslint-disable-next-line no-console
      console.warn("Socket connect_error:", err?.message || err);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.disconnect();
    };
  }, [socket]);

  return { socket, connected };
}
