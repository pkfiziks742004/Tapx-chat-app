const express = require("express");
const { createSingleFileUpload } = require("../utils/uploads");

function wrapAsync(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function createMessageRoutes({ controller }) {
  const router = express.Router();
  const uploadSingleFile = createSingleFileUpload({
    mode: "attachment",
    fallbackMb: 15,
    tooLargeMessage: "File too large.",
    invalidMessage: "Invalid file upload."
  });

  router.get("/messages", wrapAsync(controller.listMessages));
  router.post("/messages", wrapAsync(controller.sendMessage));
  router.post("/messages/file", uploadSingleFile, wrapAsync(controller.sendFile));
  router.post("/messages/read", wrapAsync(controller.markRead));
  router.post("/messages/delete", wrapAsync(controller.deleteMessage));
  router.post("/messages/delete-many", wrapAsync(controller.deleteMessages));
  router.post("/messages/forward", wrapAsync(controller.forwardMessage));
  router.post("/messages/forward-many", wrapAsync(controller.forwardMessages));

  return router;
}

module.exports = { createMessageRoutes };
