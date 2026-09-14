const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const { sendOtpEmail } = require("../utils/mailer");
const { signAccessToken } = require("../utils/generateToken");
const { normalizeEmail, isValidEmail, passwordPolicyMessage, validatePassword } = require("../utils/security");

function getOtpSecret() {
  const secret = process.env.OTP_SECRET || process.env.JWT_SECRET || "06eee39b58a4a9f6fc4f6d9309890fe91f9092751845146e6ccf732979f99d97";
  return secret;
}

function generateOtp() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function hashOtp({ email, purpose, otp }) {
  const secret = getOtpSecret();
  return crypto
    .createHmac("sha256", secret)
    .update(`${purpose}:${normalizeEmail(email)}:${String(otp).trim()}`)
    .digest("hex");
}

function getOtpConfig() {
  const expiresMinutes = process.env.OTP_EXPIRES_MINUTES ? Number(process.env.OTP_EXPIRES_MINUTES) : 10;
  const cooldownSeconds = process.env.OTP_COOLDOWN_SECONDS ? Number(process.env.OTP_COOLDOWN_SECONDS) : 60;
  return {
    expiresMinutes: Number.isFinite(expiresMinutes) ? Math.max(1, expiresMinutes) : 10,
    cooldownSeconds: Number.isFinite(cooldownSeconds) ? Math.max(10, cooldownSeconds) : 60
  };
}

function isLikelyDbSchemaError(err) {
  const code = String(err?.code || "");
  const msg = String(err?.message || "").toLowerCase();

  if (!code && !msg) return false;

  return (
    code === "42P01" || // undefined_table
    code === "42703" || // undefined_column
    // foreign_key_violation (often happens when an old schema still references `users`/`auth.users`)
    (code === "23503" &&
      (msg.includes("profiles_id_fkey") ||
        msg.includes("auth.users") ||
        msg.includes('table "users"') ||
        msg.includes(" is not present in table \"users\""))) ||
    code.startsWith("PGRST") ||
    msg.includes("schema cache") ||
    (msg.includes("relation") && msg.includes("does not exist")) ||
    (msg.includes("column") && msg.includes("does not exist"))
  );
}

function dbSchemaFixMessage() {
  return "Database schema missing/mismatched. Run supabase/schema.sql in Supabase Dashboard -> SQL Editor (it drops old `profiles_id_fkey` and adds required columns), then restart the server.";
}

function withDebugMessage(message, err) {
  const enabled = process.env.DEBUG_ERRORS === "1";
  if (!enabled) return message;
  const detail = String(err?.message || "").trim();
  if (!detail) return message;
  return `${message} (${detail})`;
}

function createAuthController({ users }) {
  return {
    sendSignupOtp: async (req, res) => {
      try {
        const email = normalizeEmail(req.body?.email);
        if (!email) return res.status(400).json({ message: "Email is required." });
        if (!isValidEmail(email)) return res.status(400).json({ message: "Enter a valid email address." });

        // Enforce Single Account Per Email
        const existing = await users.getAuthByEmail(email);
        if (existing && existing.passwordHash) {
          return res.status(400).json({
            message: "An account with this email already exists. Please login or reset your password.",
            code: "user_already_exists"
          });
        }

        const { cooldownSeconds, expiresMinutes } = getOtpConfig();
        const latest = await users.otp.getLatest(email, "signup");
        if (latest?.createdAt) {
          const deltaMs = Date.now() - new Date(latest.createdAt).getTime();
          if (deltaMs >= 0 && deltaMs < cooldownSeconds * 1000) {
            const remaining = Math.ceil((cooldownSeconds * 1000 - deltaMs) / 1000);
            return res.status(429).json({
              message: `Please wait ${remaining}s before requesting another OTP.`,
              code: "over_email_send_rate_limit"
            });
          }
        }

        const otp = generateOtp();
        const otpHash = hashOtp({ email, purpose: "signup", otp });
        const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000).toISOString();

        await users.otp.create({ email, purpose: "signup", otpHash, expiresAt });
        const mailPromise = sendOtpEmail({
          to: email,
          otp,
          expiresMinutes,
          subject: `Your Tapx Signup Verification Code: ${otp}`
        });

        await Promise.race([
          mailPromise,
          new Promise((resolve) => setTimeout(resolve, 3500))
        ]).catch((mailErr) => {
          // eslint-disable-next-line no-console
          console.error("Signup email send error:", mailErr?.message || mailErr);
        });

        return res.json({ ok: true });
      } catch (err) {
        if (err?.code === "SERVER_MISCONFIG") {
          return res.status(500).json({ message: err.message, code: err.code });
        }
        if (isLikelyDbSchemaError(err)) {
          return res.status(500).json({ message: dbSchemaFixMessage(), code: "db_schema_error" });
        }
        // eslint-disable-next-line no-console
        console.error(err);
        return res.status(500).json({
          message: withDebugMessage("Could not send OTP.", err),
          code: "internal_error"
        });
      }
    },

    sendForgotPasswordOtp: async (req, res) => {
      try {
        const email = normalizeEmail(req.body?.email);
        if (!email) return res.status(400).json({ message: "Email is required." });
        if (!isValidEmail(email)) return res.status(400).json({ message: "Enter a valid email address." });

        const existing = await users.getAuthByEmail(email);
        if (!existing) {
          return res.status(404).json({
            message: "No account found with this email address. Please sign up first.",
            code: "user_not_found"
          });
        }

        const { cooldownSeconds, expiresMinutes } = getOtpConfig();
        const latest = await users.otp.getLatest(email, "reset_password");
        if (latest?.createdAt) {
          const deltaMs = Date.now() - new Date(latest.createdAt).getTime();
          if (deltaMs >= 0 && deltaMs < cooldownSeconds * 1000) {
            const remaining = Math.ceil((cooldownSeconds * 1000 - deltaMs) / 1000);
            return res.status(429).json({
              message: `Please wait ${remaining}s before requesting another OTP.`,
              code: "over_email_send_rate_limit"
            });
          }
        }

        const otp = generateOtp();
        const otpHash = hashOtp({ email, purpose: "reset_password", otp });
        const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000).toISOString();

        await users.otp.create({ email, purpose: "reset_password", otpHash, expiresAt });
        const mailPromise = sendOtpEmail({
          to: email,
          otp,
          expiresMinutes,
          subject: `Your Tapx Password Reset Code: ${otp}`,
          text: `Your password reset code is: ${otp}\n\nThis code expires in ${expiresMinutes} minutes.\n\nIf you did not request this, you can ignore this email.`
        });

        await Promise.race([
          mailPromise,
          new Promise((resolve) => setTimeout(resolve, 3500))
        ]).catch((mailErr) => {
          // eslint-disable-next-line no-console
          console.error("Forgot-password email send error:", mailErr?.message || mailErr);
        });

        return res.json({ ok: true });
      } catch (err) {
        if (err?.code === "SERVER_MISCONFIG") {
          return res.status(500).json({ message: err.message, code: err.code });
        }
        if (isLikelyDbSchemaError(err)) {
          return res.status(500).json({ message: dbSchemaFixMessage(), code: "db_schema_error" });
        }
        // eslint-disable-next-line no-console
        console.error(err);
        return res.status(500).json({
          message: withDebugMessage("Could not send password reset OTP.", err),
          code: "internal_error"
        });
      }
    },

    verifyForgotPasswordOtp: async (req, res) => {
      try {
        const email = normalizeEmail(req.body?.email);
        const otp = String(req.body?.otp || "").trim();
        if (!email) return res.status(400).json({ message: "Email is required." });
        if (!isValidEmail(email)) return res.status(400).json({ message: "Enter a valid email address." });
        if (!otp) return res.status(400).json({ message: "OTP is required." });
        if (!/^\d{6}$/.test(otp)) return res.status(400).json({ message: "OTP must be 6 digits." });

        const otpHash = hashOtp({ email, purpose: "reset_password", otp });
        const otpRow = await users.otp.getValid({ email, purpose: "reset_password", otpHash });
        if (!otpRow) {
          return res.status(400).json({ message: "Invalid or expired OTP code.", code: "invalid_otp" });
        }

        return res.json({ ok: true });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        return res.status(500).json({ message: "Could not verify OTP.", code: "internal_error" });
      }
    },

    resetPasswordWithOtp: async (req, res) => {
      try {
        const email = normalizeEmail(req.body?.email);
        const otp = String(req.body?.otp || "").trim();
        const newPassword = String(req.body?.newPassword || req.body?.password || "");

        if (!email) return res.status(400).json({ message: "Email is required." });
        if (!isValidEmail(email)) return res.status(400).json({ message: "Enter a valid email address." });
        if (!otp) return res.status(400).json({ message: "OTP is required to reset password." });
        if (!/^\d{6}$/.test(otp)) return res.status(400).json({ message: "OTP must be 6 digits." });

        const validation = validatePassword(newPassword);
        if (!validation.ok) {
          return res.status(400).json({ message: validation.message || passwordPolicyMessage() });
        }

        const otpHash = hashOtp({ email, purpose: "reset_password", otp });
        const otpRow = await users.otp.getValid({ email, purpose: "reset_password", otpHash });
        if (!otpRow) {
          return res.status(400).json({
            message: "Invalid or expired OTP. Please request a new code.",
            code: "invalid_otp"
          });
        }

        const user = await users.getAuthByEmail(email);
        if (!user) return res.status(404).json({ message: "User not found." });

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await users.setPasswordHash(user.id, passwordHash);
        if (!user.emailVerified) {
          await users.setEmailVerified(user.id, true);
        }

        await users.otp.consumeById(otpRow.id);

        const accessToken = signAccessToken({ id: user.id, email: user.email });
        const { passwordHash: _hash, ...publicUser } = user;

        return res.json({
          ok: true,
          message: "Password reset successfully.",
          session: {
            access_token: accessToken,
            token_type: "bearer",
            user: publicUser
          }
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        return res.status(500).json({ message: "Could not reset password.", code: "internal_error" });
      }
    },

    verifySignupOtp: async (req, res) => {
      try {
        const email = normalizeEmail(req.body?.email);
        const otp = String(req.body?.otp || "").trim();
        if (!email) return res.status(400).json({ message: "Email is required." });
        if (!isValidEmail(email)) return res.status(400).json({ message: "Enter a valid email address." });
        if (!otp) return res.status(400).json({ message: "OTP is required." });
        if (!/^\d{6}$/.test(otp)) return res.status(400).json({ message: "OTP must be 6 digits." });

        const otpHash = hashOtp({ email, purpose: "signup", otp });
        const otpRow = await users.otp.getValid({ email, purpose: "signup", otpHash });
        if (!otpRow) {
          return res.status(400).json({ message: "Invalid or expired OTP.", code: "invalid_otp" });
        }

        let user = await users.getByEmail(email);
        if (!user) user = await users.create({ email, emailVerified: true });
        else if (!user.emailVerified) user = await users.setEmailVerified(user.id, true);

        const accessToken = signAccessToken({ id: user.id, email: user.email });
        const consumed = await users.otp.consumeById(otpRow.id);
        if (!consumed) {
          return res.status(400).json({ message: "Invalid or expired OTP.", code: "invalid_otp" });
        }

        return res.json({
          session: {
            access_token: accessToken,
            token_type: "bearer",
            user
          }
        });
      } catch (err) {
        if (err?.code === "SERVER_MISCONFIG") {
          return res.status(500).json({ message: err.message, code: err.code });
        }
        if (isLikelyDbSchemaError(err)) {
          return res.status(500).json({ message: dbSchemaFixMessage(), code: "db_schema_error" });
        }
        // eslint-disable-next-line no-console
        console.error(err);
        return res.status(500).json({
          message: withDebugMessage("Could not verify OTP.", err),
          code: "internal_error"
        });
      }
    },

    setPassword: async (req, res) => {
      try {
        const password = String(req.body?.password || "");
        const currentPassword = String(req.body?.currentPassword || "");
        const validation = validatePassword(password);
        if (!validation.ok) {
          return res.status(400).json({ message: validation.message || passwordPolicyMessage() });
        }

        const user = await users.getAuthById(req.user.id);
        if (!user) return res.status(401).json({ message: "User not found." });

        const hasExistingPassword = Boolean(user.passwordHash);
        if (hasExistingPassword) {
          if (!currentPassword) {
            return res.status(400).json({ message: "Current password is required to change your password." });
          }
          const currentOk = await bcrypt.compare(currentPassword, user.passwordHash);
          if (!currentOk) {
            return res.status(400).json({ message: "Current password is incorrect." });
          }
          const sameAsCurrent = await bcrypt.compare(password, user.passwordHash);
          if (sameAsCurrent) {
            return res.status(400).json({ message: "Choose a new password that is different from your current one." });
          }
        }

        const passwordHash = await bcrypt.hash(password, 10);
        await users.setPasswordHash(req.user.id, passwordHash);

        return res.json({ ok: true });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
        return res.status(500).json({ message: "Could not set password." });
      }
    },

    login: async (req, res) => {
      try {
        const email = normalizeEmail(req.body?.email);
        const password = String(req.body?.password || "");
        if (!email) return res.status(400).json({ message: "Email is required." });
        if (!isValidEmail(email)) return res.status(400).json({ message: "Enter a valid email address." });
        if (!password) return res.status(400).json({ message: "Password is required." });

        const user = await users.getAuthByEmail(email);
        const passwordHash = user?.passwordHash || null;
        if (!user || !passwordHash) {
          return res.status(400).json({ message: "Invalid email or password." });
        }

        if (!user.emailVerified) {
          return res.status(400).json({ message: "Please verify your email first." });
        }

        const ok = await bcrypt.compare(password, passwordHash);
        if (!ok) return res.status(400).json({ message: "Invalid email or password." });

        const accessToken = signAccessToken({ id: user.id, email: user.email });
        const { passwordHash: _passwordHash, ...publicUser } = user;
        return res.json({
          session: {
            access_token: accessToken,
            token_type: "bearer",
            user: publicUser
          }
        });
      } catch (err) {
        if (err?.code === "SERVER_MISCONFIG") {
          return res.status(500).json({ message: err.message, code: err.code });
        }
        // eslint-disable-next-line no-console
        console.error(err);
        return res.status(500).json({ message: "Login failed." });
      }
    }
  };
}

module.exports = { createAuthController };
