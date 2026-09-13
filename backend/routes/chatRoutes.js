const express = require("express");
const { createSingleFileUpload } = require("../utils/uploads");

function wrapAsync(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function createChatRoutes({ controller }) {
  const router = express.Router();
  const uploadSingleAvatar = createSingleFileUpload({
    mode: "avatar",
    fallbackMb: 5,
    tooLargeMessage: "Avatar image too large.",
    invalidMessage: "Invalid avatar upload."
  });

  router.get("/me", wrapAsync(controller.getMe));
  router.put("/me", wrapAsync(controller.updateMe));
  router.post("/me/avatar", uploadSingleAvatar, wrapAsync(controller.updateAvatar));
  router.get("/threads", wrapAsync(controller.listThreads));

  router.get("/contacts", wrapAsync(controller.listContacts));
  router.post("/contacts", wrapAsync(controller.addContact));

  router.post("/chats/clear", wrapAsync(controller.clearChat));

  return router;
}

module.exports = { createChatRoutes };
