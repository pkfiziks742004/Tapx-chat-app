const crypto = require("crypto");
const { getFileKind, getSafeFileName, normalizeMime } = require("../utils/security");

function isDbSchemaError(err) {
  const code = String(err?.code || "");
  const msg = String(err?.message || "").toLowerCase();
  return (
    code === "42P01" || // undefined_table
    code === "42703" || // undefined_column
    code.startsWith("PGRST") ||
    msg.includes("schema cache") ||
    (msg.includes("relation") && msg.includes("does not exist")) ||
    (msg.includes("column") && msg.includes("does not exist"))
  );
}

function dbSchemaFixMessage() {
  return "Database schema missing/mismatched. Run supabase/schema.sql in Supabase Dashboard -> SQL Editor (it drops old `profiles_id_fkey` and adds required columns), then restart the server.";
}

function createMessageController({ chats, messages }) {
  async function withFileUrls(message) {
    if (!message?.file?.path) return message;
    if (message.file.url && (message.file.url.startsWith("http://") || message.file.url.startsWith("https://"))) {
      return message;
    }
    if (message.file.path.startsWith("http://") || message.file.path.startsWith("https://") || message.file.bucket === "cloudinary") {
      return { ...message, file: { ...message.file, url: message.file.path } };
    }
    try {
      const url = await messages.createAttachmentSignedUrl({
        bucket: message.file.bucket || undefined,
        path: message.file.path
      });
      return { ...message, file: { ...message.file, url } };
    } catch (_e) {
      return message;
    }
  }

  return {
    listMessages: async (req, res) => {
      const otherId = typeof req.query?.with === "string" ? req.query.with : "";
      if (!otherId) return res.status(400).json({ message: "Missing ?with=userId" });

      const clearedAt = await chats.getChatClearAt(req.user.id, otherId);

      // Mark incoming messages as delivered when the receiver loads the thread.
      const delivered = await messages.markDelivered({
        userId: req.user.id,
        peerId: otherId,
        after: clearedAt
      });

      const io = req.app.get("io");
      if (io) {
        for (const msg of delivered) {
          io.to(`user:${msg.from}`).to(`user:${msg.to}`).emit("message:update", msg);
        }
      }

      const raw = await messages.listBetween(req.user.id, otherId, 100, { after: clearedAt });
      const list = await Promise.all(raw.map(withFileUrls));
      return res.json({ messages: list });
    },

    deleteMessages: async (req, res) => {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x) => typeof x === "string") : [];
      const scope = typeof req.body?.scope === "string" ? req.body.scope : "me";

      if (ids.length === 0) return res.status(400).json({ message: "Missing body.ids" });
      if (ids.length > 60) return res.status(400).json({ message: "Too many messages selected." });

      try {
        if (scope === "everyone") {
          const result = await messages.deleteManyForEveryone({ userId: req.user.id, messageIds: ids });
          const list = (result?.messages || []).filter(Boolean);

          const io = req.app.get("io");
          if (io) {
            for (const msg of list) {
              io.to(`user:${msg.from}`).to(`user:${msg.to}`).emit("message:update", msg);
            }
          }

          return res.json({ messages: list });
        }

        const result = await messages.deleteManyForMe({ userId: req.user.id, messageIds: ids });
        return res.json({ ok: true, deletedIds: result?.deletedIds || [] });
      } catch (err) {
        if (isDbSchemaError(err)) {
          return res.status(500).json({ message: dbSchemaFixMessage(), code: "db_schema_error" });
        }
        throw err;
      }
    },

    deleteMessage: async (req, res) => {
      const messageId = typeof req.body?.id === "string" ? req.body.id : "";
      const scope = typeof req.body?.scope === "string" ? req.body.scope : "me";

      if (!messageId) return res.status(400).json({ message: "Missing body.id" });

      try {
        if (scope === "everyone") {
          const result = await messages.deleteForEveryone({ userId: req.user.id, messageId });
          if (!result?.ok || !result?.message) {
            return res.status(404).json({ message: "Message not found." });
          }

          const io = req.app.get("io");
          if (io) {
            io.to(`user:${result.message.from}`).to(`user:${result.message.to}`).emit("message:update", result.message);
          }

          return res.json({ message: result.message });
        }

        const result = await messages.deleteForMe({ userId: req.user.id, messageId });
        if (!result?.ok) return res.status(404).json({ message: "Message not found." });
        return res.json({ ok: true });
      } catch (err) {
        if (isDbSchemaError(err)) {
          return res.status(500).json({ message: dbSchemaFixMessage(), code: "db_schema_error" });
        }
        throw err;
      }
    },

    forwardMessages: async (req, res) => {
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x) => typeof x === "string") : [];
      const to = typeof req.body?.to === "string" ? req.body.to : "";

      if (ids.length === 0) return res.status(400).json({ message: "Missing body.ids" });
      if (ids.length > 20) return res.status(400).json({ message: "Too many messages selected." });
      if (!to) return res.status(400).json({ message: "Recipient is required." });
      if (to === req.user.id) return res.status(400).json({ message: "You can't message yourself." });

      await Promise.allSettled([chats.addContact(req.user.id, to), chats.addContact(to, req.user.id)]);

      try {
        const result = await messages.forwardMany({ userId: req.user.id, messageIds: ids, to });
        const raw = (result?.messages || []).filter(Boolean);
        const list = await Promise.all(raw.map(withFileUrls));

        const io = req.app.get("io");
        if (io) {
          for (const msg of list) {
            io.to(`user:${req.user.id}`).to(`user:${to}`).emit("message:new", msg);
          }
        }

        return res.json({ messages: list });
      } catch (err) {
        if (isDbSchemaError(err)) {
          return res.status(500).json({ message: dbSchemaFixMessage(), code: "db_schema_error" });
        }
        throw err;
      }
    },

    forwardMessage: async (req, res) => {
      const messageId = typeof req.body?.id === "string" ? req.body.id : "";
      const to = typeof req.body?.to === "string" ? req.body.to : "";

      if (!messageId) return res.status(400).json({ message: "Missing body.id" });
      if (!to) return res.status(400).json({ message: "Recipient is required." });
      if (to === req.user.id) return res.status(400).json({ message: "You can't message yourself." });

      await Promise.allSettled([chats.addContact(req.user.id, to), chats.addContact(to, req.user.id)]);

      try {
        const result = await messages.forward({ userId: req.user.id, messageId, to });
        if (result?.deleted) return res.status(400).json({ message: "Can't forward a deleted message." });
        if (!result?.ok || !result?.message) return res.status(404).json({ message: "Message not found." });

        const message = await withFileUrls(result.message);

        const io = req.app.get("io");
        if (io) {
          io.to(`user:${req.user.id}`).to(`user:${to}`).emit("message:new", message);
        }

        return res.json({ message });
      } catch (err) {
        if (isDbSchemaError(err)) {
          return res.status(500).json({ message: dbSchemaFixMessage(), code: "db_schema_error" });
        }
        throw err;
      }
    },

    sendMessage: async (req, res) => {
      const to = typeof req.body?.to === "string" ? req.body.to : "";
      const rawText = typeof req.body?.text === "string" ? req.body.text : "";

      if (!to) return res.status(400).json({ message: "Recipient is required." });
      if (to === req.user.id) return res.status(400).json({ message: "You can't message yourself." });

      const text = rawText.trim().slice(0, 1000);
      if (!text) return res.status(400).json({ message: "Message text is required." });

      await Promise.allSettled([chats.addContact(req.user.id, to), chats.addContact(to, req.user.id)]);

      const message = await messages.create({ from: req.user.id, to, text });

      const io = req.app.get("io");
      if (io) {
        io.to(`user:${req.user.id}`).to(`user:${to}`).emit("message:new", message);
      }

      return res.json({ message });
    },

    sendFile: async (req, res) => {
      const to = typeof req.body?.to === "string" ? req.body.to : "";
      const rawText = typeof req.body?.text === "string" ? req.body.text : "";
      const file = req.file;

      if (!to) return res.status(400).json({ message: "Recipient is required." });
      if (to === req.user.id) return res.status(400).json({ message: "You can't message yourself." });
      if (!file) return res.status(400).json({ message: "File is required." });
      if (!Number.isFinite(Number(file.size)) || Number(file.size) <= 0) {
        return res.status(400).json({ message: "File is empty." });
      }

      const caption = rawText.trim().slice(0, 1000);
      const mime = normalizeMime(file.mimetype || "application/octet-stream");
      const originalName = getSafeFileName(file.originalname || "file");
      const size = Number(file.size || 0);
      const kind = getFileKind(mime);

      await Promise.allSettled([chats.addContact(req.user.id, to), chats.addContact(to, req.user.id)]);

      const objectId = crypto.randomUUID();
      const safeName = getSafeFileName(originalName);
      const objectPath = `messages/${req.user.id}/${to}/${objectId}-${safeName}`;

      let uploaded;
      try {
        uploaded = await messages.uploadAttachment({
          path: objectPath,
          data: file.buffer,
          contentType: mime,
          folder: `chat_app/messages/${req.user.id}`,
          resource_type: kind === "image" ? "image" : kind === "video" ? "video" : kind === "audio" ? "video" : "auto",
          filename: safeName
        });
      } catch (_err) {
        return res.status(500).json({ message: "Could not upload file." });
      }

      try {
        let message = await messages.createFile({
          from: req.user.id,
          to,
          text: caption,
          file: {
            bucket: uploaded.bucket,
            path: uploaded.path,
            name: originalName,
            mime,
            size,
            kind
          }
        });

        message = await withFileUrls(message);

        const io = req.app.get("io");
        if (io) {
          io.to(`user:${req.user.id}`).to(`user:${to}`).emit("message:new", message);
        }

        return res.json({ message });
      } catch (err) {
        try {
          await messages.removeAttachments({ bucket: uploaded.bucket, paths: [uploaded.path] });
        } catch (_e) {}

        if (isDbSchemaError(err)) {
          return res.status(500).json({ message: dbSchemaFixMessage(), code: "db_schema_error" });
        }
        // eslint-disable-next-line no-console
        console.error(err);
        return res.status(500).json({ message: "Could not send file." });
      }
    },

    markRead: async (req, res) => {
      const peerId = typeof req.body?.with === "string" ? req.body.with : "";
      if (!peerId) return res.status(400).json({ message: "Missing body.with" });
      if (peerId === req.user.id) return res.status(400).json({ message: "Invalid peer." });

      const clearedAt = await chats.getChatClearAt(req.user.id, peerId);
      const updated = await messages.markRead({ userId: req.user.id, peerId, after: clearedAt });

      const io = req.app.get("io");
      if (io) {
        for (const msg of updated) {
          io.to(`user:${msg.from}`).to(`user:${msg.to}`).emit("message:update", msg);
        }
      }

      return res.json({ ok: true, updated: updated.length });
    }
  };
}

module.exports = { createMessageController };
