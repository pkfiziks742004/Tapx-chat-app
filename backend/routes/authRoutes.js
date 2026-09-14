const express = require("express");
const { createRateLimiter, getClientAddress } = require("../middleware/rateLimit");
const { normalizeEmail } = require("../utils/security");

function wrapAsync(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function createAuthRoutes({ controller, authMiddleware }) {
  const router = express.Router();
  const keyByIpAndEmail = (req) => {
    const ip = getClientAddress(req);
    const email = normalizeEmail(req.body?.email);
    return email ? `${ip}:${email}` : ip;
  };

  const sendOtpIpLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 8,
    message: "Too many OTP requests. Please wait and try again.",
    code: "over_request_rate_limit"
  });
  const sendOtpEmailLimiter = createRateLimiter({
    windowMs: 10 * 60 * 1000,
    max: 4,
    keyGenerator: (req) => normalizeEmail(req.body?.email) || getClientAddress(req),
    message: "Too many OTP emails sent. Please wait a bit and try again.",
    code: "over_email_send_rate_limit"
  });
  const verifyOtpLimiter = createRateLimiter({
    windowMs: 10 * 60 * 1000,
    max: 10,
    keyGenerator: keyByIpAndEmail,
    message: "Too many OTP verification attempts. Please wait and try again.",
    code: "over_request_rate_limit"
  });
  const loginLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 12,
    keyGenerator: keyByIpAndEmail,
    message: "Too many login attempts. Please wait and try again.",
    code: "over_request_rate_limit"
  });
  const setPasswordLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 6,
    keyGenerator: (req) => req.user?.id || getClientAddress(req),
    message: "Too many password update attempts. Please wait and try again.",
    code: "over_request_rate_limit"
  });

  router.post("/signup/send-otp", sendOtpIpLimiter, sendOtpEmailLimiter, wrapAsync(controller.sendSignupOtp));
  router.post("/signup/verify-otp", verifyOtpLimiter, wrapAsync(controller.verifySignupOtp));
  router.post("/forgot-password/send-otp", sendOtpIpLimiter, sendOtpEmailLimiter, wrapAsync(controller.sendForgotPasswordOtp));
  router.post("/forgot-password/verify-otp", verifyOtpLimiter, wrapAsync(controller.verifyForgotPasswordOtp));
  router.post("/forgot-password/reset", setPasswordLimiter, wrapAsync(controller.resetPasswordWithOtp));
  router.post("/set-password", authMiddleware, setPasswordLimiter, wrapAsync(controller.setPassword));
  router.post("/login", loginLimiter, wrapAsync(controller.login));

  return router;
}

module.exports = { createAuthRoutes };
