const express = require("express");

function wrapAsync(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function createCallRoutes({ controller }) {
  const router = express.Router();

  router.get("/calls", wrapAsync(controller.listCalls));
  router.post("/calls/delete", wrapAsync(controller.deleteCall));
  router.post("/calls/clear", wrapAsync(controller.clearCalls));

  return router;
}

module.exports = { createCallRoutes };

