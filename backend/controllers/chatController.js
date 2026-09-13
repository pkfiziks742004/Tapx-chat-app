const crypto = require("crypto");
const { getSafeFileName, isValidEmail, normalizeMime } = require("../utils/security");

function createChatController({ users, chats }) {
  return {
    getMe: async (req, res) => {
      const user = await users.getById(req.user.id);
      if (!user) return res.status(401).json({ message: "User not found." });
      return res.json({ user });
    },

    updateMe: async (req, res) => {
      const hasName = typeof req.body?.name === "string";
      const hasBio = typeof req.body?.bio === "string";

      const name = hasName ? req.body.name.trim() : "";
      const bio = hasBio ? String(req.body.bio || "").trim() : "";

      if (!hasName && !hasBio) {
        return res.status(400).json({ message: "Nothing to update." });
      }
      if (hasName) {
        if (!name) return res.status(400).json({ message: "Name is required." });
        if (name.length > 32) return res.status(400).json({ message: "Name too long." });
      }
      if (hasBio && bio.length > 160) {
        return res.status(400).json({ message: "Bio too long." });
      }

      const existing = await users.getById(req.user.id);
      if (!existing) return res.status(401).json({ message: "User not found." });

      const user = await users.updateProfile(req.user.id, {
        ...(hasName ? { name } : {}),
        ...(hasBio ? { bio } : {})
      });
      return res.json({ user: user || existing });
    },

    updateAvatar: async (req, res) => {
      const file = req.file;
      if (!file) return res.status(400).json({ message: "Avatar image is required." });
      if (!Number.isFinite(Number(file.size)) || Number(file.size) <= 0) {
        return res.status(400).json({ message: "Avatar image is empty." });
      }

      const mime = normalizeMime(file.mimetype || "application/octet-stream");

      const existing = await users.getById(req.user.id);
      if (!existing) return res.status(401).json({ message: "User not found." });

      const oldBucket = existing?.avatar?.bucket || null;
      const oldPath = existing?.avatar?.path || null;

      const safeName = getSafeFileName(file.originalname || "avatar");
      const objectId = crypto.randomUUID();
      const objectPath = `avatars/${req.user.id}/${objectId}-${safeName}`;

      let uploaded = null;
      try {
        uploaded = await users.uploadAttachment({
          path: objectPath,
          data: file.buffer,
          contentType: mime,
          folder: `chat_app/avatars/${req.user.id}`,
          resource_type: "image",
          filename: safeName
        });
      } catch (_err) {
        return res.status(500).json({ message: "Could not upload avatar." });
      }

      try {
        const user = await users.updateAvatar(req.user.id, { bucket: uploaded.bucket, path: uploaded.path });

        if (oldPath && oldPath !== uploaded.path) {
          const bucket = oldBucket || uploaded.bucket;
          await users.removeAttachments({ bucket, paths: [oldPath] });
        }

        return res.json({ user });
      } catch (err) {
        try {
          await users.removeAttachments({ bucket: uploaded.bucket, paths: [uploaded.path] });
        } catch (_e) {}
        throw err;
      }
    },

    listThreads: async (req, res) => {
      const threads = await chats.listThreads(req.user.id);
      return res.json({ threads });
    },

    listContacts: async (req, res) => {
      const contacts = await chats.listContacts(req.user.id);
      return res.json({ contacts });
    },

    addContact: async (req, res) => {
      const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
      if (!email) return res.status(400).json({ message: "Email is required." });
      if (!isValidEmail(email)) return res.status(400).json({ message: "Enter a valid email address." });
      if (email === req.user.email.toLowerCase()) {
        return res.status(400).json({ message: "You can't add yourself." });
      }

      const contact = await users.getByEmail(email);
      if (!contact) return res.status(404).json({ message: "User not found." });

      await chats.addContact(req.user.id, contact.id);
      return res.json({ contact });
    },

    clearChat: async (req, res) => {
      const peerId = typeof req.body?.with === "string" ? req.body.with : "";
      if (!peerId) return res.status(400).json({ message: "Missing body.with" });
      if (peerId === req.user.id) return res.status(400).json({ message: "Invalid peer." });

      try {
        await chats.clearChat(req.user.id, peerId);
      } catch (err) {
        if (err?.code === "db_schema_error") {
          return res.status(500).json({ message: err.message, code: err.code });
        }
        throw err;
      }

      return res.json({ ok: true });
    }
  };
}

module.exports = { createChatController };
