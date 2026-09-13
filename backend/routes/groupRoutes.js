const express = require("express");
const { createSingleFileUpload } = require("../utils/uploads");

function wrapAsync(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function createGroupRoutes({ controller }) {
  const router = express.Router();
  const uploadSingleFile = createSingleFileUpload({
    mode: "attachment",
    fallbackMb: 15,
    tooLargeMessage: "File too large.",
    invalidMessage: "Invalid file upload."
  });

  router.get("/groups", wrapAsync(controller.listGroups));
  router.post("/groups", wrapAsync(controller.createGroup));
  router.post("/groups/:id/clear", wrapAsync(controller.clearChat));
  router.post("/groups/:id/read", wrapAsync(controller.markRead));

  router.get("/groups/:id/messages", wrapAsync(controller.listMessages));
  router.post("/groups/:id/messages", wrapAsync(controller.sendMessage));
  router.post("/groups/:id/messages/file", uploadSingleFile, wrapAsync(controller.sendFile));
  router.post("/groups/:id/messages/delete-many", wrapAsync(controller.deleteMessages));

  return router;
}

module.exports = { createGroupRoutes };
