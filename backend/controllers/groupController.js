const crypto = require("crypto");
const { getFileKind, getSafeFileName, normalizeMime } = require("../utils/security");

function createGroupController({ groups, users }) {
  async function withFileUrls(message) {
    if (!message?.file?.path) return message;
    if (message.file.url && (message.file.url.startsWith("http://") || message.file.url.startsWith("https://"))) {
      return message;
    }
    if (message.file.path.startsWith("http://") || message.file.path.startsWith("https://") || message.file.bucket === "cloudinary") {
      return { ...message, file: { ...message.file, url: message.file.path } };
    }
    try {
      const url = await groups.createAttachmentSignedUrl({
        bucket: message.file.bucket || undefined,
        path: message.file.path
      });
      return { ...message, file: { ...message.file, url } };
    } catch (_e) {
      return message;
    }
  }

  async function withSenderName(message) {
    if (!message?.from) return message;
    if (String(message.fromName || "").trim()) return message;
    if (!users) return message;
    try {
      const u = await users.getById(message.from);
      if (!u) return message;
      return { ...message, fromName: u.name || u.email || "" };
    } catch (_e) {
      return message;
    }
  }

  return {
    listGroups: async (req, res) => {
      const list = await groups.listMine(req.user.id);
      return res.json({ groups: list || [] });
    },

    createGroup: async (req, res) => {
      const name = typeof req.body?.name === "string" ? req.body.name : "";
      const memberIds = Array.isArray(req.body?.memberIds)
        ? req.body.memberIds.filter((x) => typeof x === "string")
        : [];

      const group = await groups.create({ userId: req.user.id, name, memberIds });
      return res.json({ group });
    },

    clearChat: async (req, res) => {
      const groupId = typeof req.params?.id === "string" ? req.params.id : "";
      if (!groupId) return res.status(400).json({ message: "Missing group id." });

      const isMember = await groups.isMember(req.user.id, groupId);
      if (!isMember) return res.status(404).json({ message: "Group not found." });

      await groups.clearChat({ userId: req.user.id, groupId });
      return res.json({ ok: true });
    },

    markRead: async (req, res) => {
      const groupId = typeof req.params?.id === "string" ? req.params.id : "";
      if (!groupId) return res.status(400).json({ message: "Missing group id." });

      const isMember = await groups.isMember(req.user.id, groupId);
      if (!isMember) return res.status(404).json({ message: "Group not found." });

      await groups.markRead({ userId: req.user.id, groupId });
      return res.json({ ok: true });
    },

    listMessages: async (req, res) => {
      const groupId = typeof req.params?.id === "string" ? req.params.id : "";
      if (!groupId) return res.status(400).json({ message: "Missing group id." });

      const isMember = await groups.isMember(req.user.id, groupId);
      if (!isMember) return res.status(404).json({ message: "Group not found." });

      const raw = await groups.listMessages(req.user.id, groupId, 100);
      const list = await Promise.all((raw || []).map(withFileUrls));
      return res.json({ messages: list });
    },

    deleteMessages: async (req, res) => {
      const groupId = typeof req.params?.id === "string" ? req.params.id : "";
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x) => typeof x === "string") : [];
      const scope = typeof req.body?.scope === "string" ? req.body.scope : "me";

      if (!groupId) return res.status(400).json({ message: "Missing group id." });
      if (ids.length === 0) return res.status(400).json({ message: "Missing body.ids" });
      if (ids.length > 60) return res.status(400).json({ message: "Too many messages selected." });

      const isMember = await groups.isMember(req.user.id, groupId);
      if (!isMember) return res.status(404).json({ message: "Group not found." });

      if (scope === "everyone") {
        const result = await groups.deleteManyForEveryone({ userId: req.user.id, groupId, messageIds: ids });
        const list = (result?.messages || []).filter(Boolean);

        const io = req.app.get("io");
        if (io) {
          for (const msg of list) io.to(`group:${groupId}`).emit("group:message:update", msg);
        }

        return res.json({ messages: list });
      }

      const result = await groups.deleteManyForMe({ userId: req.user.id, groupId, messageIds: ids });
      return res.json({ ok: true, deletedIds: result?.deletedIds || [] });
    },

    sendMessage: async (req, res) => {
      const groupId = typeof req.params?.id === "string" ? req.params.id : "";
      const rawText = typeof req.body?.text === "string" ? req.body.text : "";
      if (!groupId) return res.status(400).json({ message: "Missing group id." });

      const isMember = await groups.isMember(req.user.id, groupId);
      if (!isMember) return res.status(404).json({ message: "Group not found." });

      const message = await groups.createMessage({ userId: req.user.id, groupId, text: rawText });
      if (!message) return res.status(404).json({ message: "Group not found." });

      const withUrl = await withSenderName(await withFileUrls(message));

      const io = req.app.get("io");
      if (io) {
        io.to(`group:${groupId}`).emit("group:message:new", withUrl);
      }

      return res.json({ message: withUrl });
    },

    sendFile: async (req, res) => {
      const groupId = typeof req.params?.id === "string" ? req.params.id : "";
      const rawText = typeof req.body?.text === "string" ? req.body.text : "";
      const file = req.file;

      if (!groupId) return res.status(400).json({ message: "Missing group id." });
      if (!file) return res.status(400).json({ message: "File is required." });
      if (!Number.isFinite(Number(file.size)) || Number(file.size) <= 0) {
        return res.status(400).json({ message: "File is empty." });
      }

      const isMember = await groups.isMember(req.user.id, groupId);
      if (!isMember) return res.status(404).json({ message: "Group not found." });

      const caption = rawText.trim().slice(0, 1000);
      const mime = normalizeMime(file.mimetype || "application/octet-stream");
      const originalName = getSafeFileName(file.originalname || "file");
      const size = Number(file.size || 0);
      const kind = getFileKind(mime);

      const objectId = crypto.randomUUID();
      const safeName = getSafeFileName(originalName);
      const objectPath = `group-messages/${groupId}/${req.user.id}/${objectId}-${safeName}`;

      let uploaded;
      try {
        uploaded = await groups.uploadAttachment({
          path: objectPath,
          data: file.buffer,
          contentType: mime,
          folder: `chat_app/group_messages/${groupId}`,
          resource_type: kind === "image" ? "image" : kind === "video" ? "video" : kind === "audio" ? "video" : "auto",
          filename: safeName
        });
      } catch (_err) {
        return res.status(500).json({ message: "Could not upload file." });
      }

      try {
        let message = await groups.createFile({
          from: req.user.id,
          groupId,
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

        if (!message) return res.status(404).json({ message: "Group not found." });
        message = await withSenderName(await withFileUrls(message));

        const io = req.app.get("io");
        if (io) {
          io.to(`group:${groupId}`).emit("group:message:new", message);
        }

        return res.json({ message });
      } catch (err) {
        try {
          await groups.removeAttachments({ bucket: uploaded.bucket, paths: [uploaded.path] });
        } catch (_e) {}
        // eslint-disable-next-line no-console
        console.error(err);
        return res.status(500).json({ message: "Could not send file." });
      }
    }
  };
}

module.exports = { createGroupController };
