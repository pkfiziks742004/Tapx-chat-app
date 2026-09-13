function createCallController({ calls }) {
  return {
    listCalls: async (req, res) => {
      const limitRaw = req.query?.limit;
      const limit = typeof limitRaw === "string" ? Number(limitRaw) : undefined;
      const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(500, Math.floor(limit))) : 200;
      const callsList = await calls.list(req.user.id, { limit: safeLimit });
      return res.json({ calls: callsList || [] });
    },

    deleteCall: async (req, res) => {
      const id = typeof req.body?.id === "string" ? req.body.id : "";
      if (!id) return res.status(400).json({ message: "Missing body.id" });
      await calls.deleteForMe({ userId: req.user.id, callLogId: id });
      return res.json({ ok: true });
    },

    clearCalls: async (req, res) => {
      const result = await calls.clearForMe(req.user.id);
      return res.json({ ok: true, deleted: result?.deleted || 0 });
    }
  };
}

module.exports = { createCallController };

