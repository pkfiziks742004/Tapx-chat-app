const activeCallPeerByUserId = new Map(); // userId -> peerId
const activeCallLogIdByUserId = new Map(); // userId -> callLogId
const activeCallStateByLogId = new Map(); // callLogId -> { fromId, toId, answered }

function clearActiveCall(userId) {
  if (!userId) return;
  const peer = activeCallPeerByUserId.get(userId);
  const logId = activeCallLogIdByUserId.get(userId);
  activeCallPeerByUserId.delete(userId);
  activeCallLogIdByUserId.delete(userId);
  if (peer && activeCallPeerByUserId.get(peer) === userId) {
    activeCallPeerByUserId.delete(peer);
    activeCallLogIdByUserId.delete(peer);
  }
  if (logId) activeCallStateByLogId.delete(logId);
}

function setActiveCallPair(a, b) {
  if (!a || !b) return;
  activeCallPeerByUserId.set(a, b);
  activeCallPeerByUserId.set(b, a);
}

function getActiveCallLogId(a, b) {
  return activeCallLogIdByUserId.get(a) || activeCallLogIdByUserId.get(b) || null;
}

function isActiveCallPeer(userId, peerId) {
  if (!userId || !peerId) return false;
  return activeCallPeerByUserId.get(userId) === peerId && activeCallPeerByUserId.get(peerId) === userId;
}

function registerSocketHandlers(io, store) {
  io.on("connection", (socket) => {
    const { id, email } = socket.user;
    socket.join(`user:${id}`);
    let lastTypingAt = 0;

    store
      .getUserById(id)
      .then((user) => {
        if (!user) socket.disconnect(true);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        // Don't hard-disconnect on transient DB errors.
        // If Supabase is temporarily unavailable or the schema is mid-migration,
        // disconnecting breaks real-time delivery for everyone and forces reloads.
        // We still validate the JWT in `socketAuthMiddleware`.
        console.error("Socket user lookup failed:", err?.message || err);
      });

    store
      .listGroupIdsForUser(id)
      .then((groupIds) => {
        for (const gid of groupIds || []) {
          if (!gid) continue;
          socket.join(`group:${gid}`);
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("Socket group join failed:", err?.message || err);
      });

    socket.on("group:subscribe", async ({ groupId } = {}) => {
      try {
        if (typeof groupId !== "string") return;
        const ok = await store.isUserGroupMember(id, groupId);
        if (!ok) return;
        socket.join(`group:${groupId}`);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Socket group subscribe failed:", err?.message || err);
      }
    });

    socket.on("message:send", async ({ to, text } = {}) => {
      try {
        if (typeof to !== "string") return;
        if (typeof text !== "string") return;
        const safeText = text.trim().slice(0, 1000);
        if (!safeText) return;
        if (to === id) return;

        await Promise.allSettled([store.addContact(id, to), store.addContact(to, id)]);
        const message = await store.createMessage({ from: id, to, text: safeText });
        io.to(`user:${id}`).to(`user:${to}`).emit("message:new", message);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
      }
    });

    socket.on("message:delivered", async ({ id: messageId } = {}) => {
      try {
        if (typeof messageId !== "string") return;
        const updated = await store.markMessageDelivered({ id: messageId, recipientId: id });
        if (!updated) return;
        io.to(`user:${updated.from}`).to(`user:${updated.to}`).emit("message:update", updated);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
      }
    });

    socket.on("message:read", async ({ with: peerId } = {}) => {
      try {
        if (typeof peerId !== "string") return;
        if (peerId === id) return;
        const clearedAt = await store.getChatClearAt(id, peerId);
        const updated = await store.markMessagesRead({ userId: id, peerId, after: clearedAt });
        if (!updated || updated.length === 0) return;
        for (const msg of updated) {
          io.to(`user:${msg.from}`).to(`user:${msg.to}`).emit("message:update", msg);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
      }
    });

    socket.on("typing", ({ to, typing } = {}) => {
      if (typeof to !== "string") return;
      if (to === id) return;

      const isTyping = Boolean(typing);
      const now = Date.now();
      if (isTyping && now - lastTypingAt < 250) return;
      if (isTyping) lastTypingAt = now;

      io.to(`user:${to}`).emit("typing", { from: id, typing: isTyping });
    });

    socket.on("call:offer", async ({ to, sdp, media } = {}) => {
      if (typeof to !== "string" || !sdp) return;
      const safeMedia = media === "audio" ? "audio" : "video";
      if (to === id) return;

      try {
        const peer = await store.getUserById(to);
        if (!peer?.id) return;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Call offer user lookup failed:", err?.message || err);
        return;
      }

      const busyPeer = activeCallPeerByUserId.get(to);
      if (busyPeer) {
        io.to(`user:${id}`).emit("call:busy", { to });
        try {
          const endedAt = new Date().toISOString();
          const log = await store.createCallLog({
            fromId: id,
            toId: to,
            media: safeMedia,
            status: "busy",
            endedAt,
            endedBy: to,
            endReason: "busy"
          });

          if (log?.id) {
            // Hide from the callee: they were already in a call and never saw this offer.
            try {
              await store.deleteCallLogForMe({ userId: to, callLogId: log.id });
            } catch (_e) {}
            io.to(`user:${id}`).emit("calllog:new", log);
          }
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("Call log (busy) failed:", err?.message || err);
        }
        return;
      }

      clearActiveCall(id);
      setActiveCallPair(id, to);

      io.to(`user:${id}`).emit("call:ringing", { to, media: safeMedia });
      io.to(`user:${to}`).emit("call:offer", { from: id, sdp, media: safeMedia });

      try {
        const log = await store.createCallLog({ fromId: id, toId: to, media: safeMedia, status: "ringing" });
        if (log?.id) {
          activeCallLogIdByUserId.set(id, log.id);
          activeCallLogIdByUserId.set(to, log.id);
          activeCallStateByLogId.set(log.id, { fromId: id, toId: to, answered: false, media: safeMedia, startedAt: null });
          io.to(`user:${id}`).to(`user:${to}`).emit("calllog:new", log);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Call log (offer) failed:", err?.message || err);
      }
    });

    socket.on("call:answer", ({ to, sdp, media } = {}) => {
      if (typeof to !== "string" || !sdp) return;
      const safeMedia = media === "audio" ? "audio" : "video";
      if (!isActiveCallPeer(id, to)) return;
      io.to(`user:${to}`).emit("call:answer", { from: id, sdp, media: safeMedia });

      const logId = getActiveCallLogId(id, to);
      if (logId) {
        const state = activeCallStateByLogId.get(logId) || { fromId: null, toId: null, answered: false };
        activeCallStateByLogId.set(logId, { ...state, answered: true, startedAt: new Date().toISOString() });
        store
          .markCallConnected({ id: logId })
          .then((updated) => {
            if (updated?.id) io.to(`user:${id}`).to(`user:${to}`).emit("calllog:update", updated);
          })
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.error("Call log (answer) failed:", err?.message || err);
          });
      }
    });

    socket.on("call:ice", ({ to, candidate } = {}) => {
      if (typeof to !== "string" || !candidate) return;
      if (!isActiveCallPeer(id, to)) return;
      const candidateSize = JSON.stringify(candidate).length;
      if (candidateSize > 64 * 1024) return;
      io.to(`user:${to}`).emit("call:ice", { from: id, candidate });
    });

    socket.on("call:upgrade_request", ({ to } = {}) => {
      if (typeof to !== "string" || !isActiveCallPeer(id, to)) return;
      io.to(`user:${to}`).emit("call:upgrade_request", { from: id });
    });

    socket.on("call:upgrade_accept", ({ to } = {}) => {
      if (typeof to !== "string" || !isActiveCallPeer(id, to)) return;
      io.to(`user:${to}`).emit("call:upgrade_accept", { from: id });
    });

    socket.on("call:upgrade_decline", ({ to } = {}) => {
      if (typeof to !== "string" || !isActiveCallPeer(id, to)) return;
      io.to(`user:${to}`).emit("call:upgrade_decline", { from: id });
    });

    socket.on("call:media_state", ({ to, video, audio, screen } = {}) => {
      if (typeof to !== "string" || !isActiveCallPeer(id, to)) return;
      io.to(`user:${to}`).emit("call:media_state", { from: id, video, audio, screen });
    });

    socket.on("call:renegotiate", ({ to, sdp } = {}) => {
      if (typeof to !== "string" || !sdp || !isActiveCallPeer(id, to)) return;
      io.to(`user:${to}`).emit("call:renegotiate", { from: id, sdp });
    });

    socket.on("call:renegotiate_answer", ({ to, sdp } = {}) => {
      if (typeof to !== "string" || !sdp || !isActiveCallPeer(id, to)) return;
      io.to(`user:${to}`).emit("call:renegotiate_answer", { from: id, sdp });
    });

    socket.on("call:hangup", ({ to } = {}) => {
      if (typeof to !== "string") return;
      if (!isActiveCallPeer(id, to)) return;
      const logId = getActiveCallLogId(id, to);
      const state = logId ? activeCallStateByLogId.get(logId) : null;
      clearActiveCall(id);
      clearActiveCall(to);
      io.to(`user:${id}`).to(`user:${to}`).emit("call:hangup", { from: id });

      if (logId) {
        const answered = Boolean(state?.answered);
        const fromId = state?.fromId || null;
        const toId = state?.toId || null;
        const callMedia = state?.media === "video" ? "video" : "audio";
        const startedAt = state?.startedAt || null;
        let status = answered ? "ended" : "missed";
        if (!answered) {
          if (fromId && id === fromId) status = "cancelled";
          else if (toId && id === toId) status = "declined";
        }

        store
          .endCallLog({ id: logId, status, endedBy: id, endReason: answered ? "hangup" : "no_answer" })
          .then(async (updated) => {
            if (updated?.id) io.to(`user:${id}`).to(`user:${to}`).emit("calllog:update", updated);

            // Create call event message in chat for both caller and receiver (WhatsApp-style)
            if (fromId && toId) {
              try {
                await Promise.allSettled([store.addContact(fromId, toId), store.addContact(toId, fromId)]);
                const isVid = callMedia === "video";
                let durationSec = 0;
                if (answered && startedAt) {
                  const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
                  if (diff > 0) durationSec = diff;
                }
                const durationText = answered
                  ? durationSec > 0
                    ? `${Math.floor(durationSec / 60) > 0 ? `${Math.floor(durationSec / 60)}m ` : ""}${durationSec % 60}s`
                    : "Call ended"
                  : "No answer";
                const text = isVid
                  ? answered
                    ? `📹 Video call`
                    : `📹 Missed video call`
                  : answered
                    ? `📞 Voice call`
                    : `📞 Missed voice call`;
                const msg = await store.createFileMessage({
                  from: fromId,
                  to: toId,
                  text,
                  file: {
                    kind: answered ? "call" : "missed_call",
                    name: isVid ? "video" : "audio",
                    mime: durationText,
                    size: durationSec
                  }
                });
                if (msg?.id) {
                  io.to(`user:${fromId}`).to(`user:${toId}`).emit("message:new", msg);
                }
              } catch (msgErr) {
                // eslint-disable-next-line no-console
                console.error("Call message creation failed:", msgErr?.message || msgErr);
              }
            }
          })
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.error("Call log (hangup) failed:", err?.message || err);
          })
          .finally(() => {
            activeCallStateByLogId.delete(logId);
          });
      }
    });

    socket.on("disconnect", () => {
      const peer = activeCallPeerByUserId.get(id);
      if (!peer) return;
      const logId = getActiveCallLogId(id, peer);
      const state = logId ? activeCallStateByLogId.get(logId) : null;
      clearActiveCall(id);
      io.to(`user:${peer}`).emit("call:hangup", { from: id });

      if (logId) {
        const answered = Boolean(state?.answered);
        const fromId = state?.fromId || null;
        const toId = state?.toId || null;
        const callMedia = state?.media === "video" ? "video" : "audio";
        const startedAt = state?.startedAt || null;
        let status = answered ? "ended" : "missed";
        if (!answered) {
          if (fromId && id === fromId) status = "cancelled";
          else if (toId && id === toId) status = "declined";
        }

        store
          .endCallLog({ id: logId, status, endedBy: id, endReason: "disconnect" })
          .then(async (updated) => {
            if (updated?.id) io.to(`user:${peer}`).emit("calllog:update", updated);

            if (fromId && toId) {
              try {
                await Promise.allSettled([store.addContact(fromId, toId), store.addContact(toId, fromId)]);
                const isVid = callMedia === "video";
                let durationSec = 0;
                if (answered && startedAt) {
                  const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
                  if (diff > 0) durationSec = diff;
                }
                const durationText = answered
                  ? durationSec > 0
                    ? `${Math.floor(durationSec / 60) > 0 ? `${Math.floor(durationSec / 60)}m ` : ""}${durationSec % 60}s`
                    : "Call ended"
                  : "No answer";
                const text = isVid
                  ? answered
                    ? `📹 Video call`
                    : `📹 Missed video call`
                  : answered
                    ? `📞 Voice call`
                    : `📞 Missed voice call`;
                const msg = await store.createFileMessage({
                  from: fromId,
                  to: toId,
                  text,
                  file: {
                    kind: answered ? "call" : "missed_call",
                    name: isVid ? "video" : "audio",
                    mime: durationText,
                    size: durationSec
                  }
                });
                if (msg?.id) {
                  io.to(`user:${fromId}`).to(`user:${toId}`).emit("message:new", msg);
                }
              } catch (msgErr) {
                // eslint-disable-next-line no-console
                console.error("Disconnect call message failed:", msgErr?.message || msgErr);
              }
            }
          })
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.error("Call log (disconnect) failed:", err?.message || err);
          })
          .finally(() => {
            activeCallStateByLogId.delete(logId);
          });
      }
    });
  });
}

module.exports = { registerSocketHandlers };
