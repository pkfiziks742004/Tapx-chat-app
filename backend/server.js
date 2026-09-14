const path = require("path");
const http = require("http");
const dns = require("dns");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");

if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

require("dotenv").config({ path: path.join(__dirname, ".env") });

const { createStore } = require("./config/db");
const { authMiddleware, socketAuthMiddleware } = require("./middleware/authMiddleware");
const { getEnvNumber } = require("./utils/security");

const { createUserModel } = require("./models/User");
const { createChatModel } = require("./models/Chat");
const { createMessageModel } = require("./models/Message");
const { createGroupModel } = require("./models/Group");
const { createCallModel } = require("./models/Call");

const { createAuthController } = require("./controllers/authController");
const { createChatController } = require("./controllers/chatController");
const { createMessageController } = require("./controllers/messageController");
const { createGroupController } = require("./controllers/groupController");
const { createCallController } = require("./controllers/callController");

const { createAuthRoutes } = require("./routes/authRoutes");
const { createChatRoutes } = require("./routes/chatRoutes");
const { createMessageRoutes } = require("./routes/messageRoutes");
const { createGroupRoutes } = require("./routes/groupRoutes");
const { createCallRoutes } = require("./routes/callRoutes");
const { warmupMailer } = require("./utils/mailer");

const { registerSocketHandlers } = require("./sockets/socket");

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const MESSAGE_CLEANUP_INTERVAL_MINUTES = process.env.MESSAGE_CLEANUP_INTERVAL_MINUTES
  ? Number(process.env.MESSAGE_CLEANUP_INTERVAL_MINUTES)
  : 15;
const JSON_BODY_MAX_MB = Math.max(1, getEnvNumber("JSON_BODY_MAX_MB", 1));
const SOCKET_MAX_BUFFER_KB = Math.max(64, getEnvNumber("SOCKET_MAX_BUFFER_KB", 256));

function getCleanupIntervalMs() {
  const minutes = Number.isFinite(MESSAGE_CLEANUP_INTERVAL_MINUTES)
    ? Math.max(1, MESSAGE_CLEANUP_INTERVAL_MINUTES)
    : 15;
  return minutes * 60 * 1000;
}

function compileOriginMatchers(value) {
  const parts = String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const defaults = ["http://localhost:5173", "http://localhost:3000", "http://localhost:4173", "https://*.vercel.app"];
  for (const d of defaults) {
    if (!parts.includes(d)) parts.push(d);
  }

  return parts.map((part) => {
    if (part === "*") return /.*/;
    if (!part.includes("*")) return part;
    const escaped = part.replace(/[|\\{}()[\]^$+?.]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`);
  });
}

const originMatchers = compileOriginMatchers(CLIENT_ORIGIN);
function corsOrigin(origin, callback) {
  if (!origin) return callback(null, true);
  const allowed = originMatchers.some((m) => (typeof m === "string" ? origin === m : m.test(origin)));
  return callback(allowed ? null : new Error("Not allowed by CORS"), allowed);
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

async function main() {
  const store = await createStore();

  const users = createUserModel(store);
  const chats = createChatModel(store);
  const messages = createMessageModel(store);
  const groups = createGroupModel(store);
  const calls = createCallModel(store);

  const authController = createAuthController({ users });
  const chatController = createChatController({ users, chats });
  const messageController = createMessageController({ chats, messages });
  const groupController = createGroupController({ groups, users });
  const callController = createCallController({ calls });

  // Pre-warm SMTP mailer connection pool for instant OTP delivery
  warmupMailer();

  // Auto-delete old messages (default: 24h TTL). This keeps the database clean on Render.
  async function runMessageCleanup() {
    try {
      await messages.deleteExpired();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Message cleanup failed:", err?.message || err);
    }
  }

  runMessageCleanup();
  const cleanupTimer = setInterval(runMessageCleanup, getCleanupIntervalMs());
  if (cleanupTimer.unref) cleanupTimer.unref();

  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    if (req.path !== "/health") {
      res.setHeader("Cache-Control", "no-store");
    }

    const proto = String(req.headers["x-forwarded-proto"] || "");
    if (req.secure || proto === "https") {
      res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    }

    next();
  });
  app.use(
    cors({
      origin: corsOrigin,
      credentials: true
    })
  );
  app.use(express.json({ limit: `${JSON_BODY_MAX_MB}mb`, strict: true }));
  app.use(express.urlencoded({ extended: false, limit: `${JSON_BODY_MAX_MB}mb` }));

  app.get("/health", (_req, res) =>
    res.json({
      ok: true,
      auth: "custom-jwt",
      otp: "smtp"
    })
  );

  app.use("/auth", createAuthRoutes({ controller: authController, authMiddleware }));

  const apiRouter = express.Router();
  apiRouter.use(createChatRoutes({ controller: chatController }));
  apiRouter.use(createMessageRoutes({ controller: messageController }));
  apiRouter.use(createGroupRoutes({ controller: groupController }));
  apiRouter.use(createCallRoutes({ controller: callController }));
  app.use("/api", authMiddleware, apiRouter);

  app.use((err, _req, res, _next) => {
    // eslint-disable-next-line no-console
    console.error(err);

    const isCorsError = err?.message === "Not allowed by CORS";
    const status = isCorsError ? 403 : Number(err?.status) || 500;
    if (!isCorsError && status >= 500 && isLikelyDbSchemaError(err)) {
      return res.status(500).json({ message: dbSchemaFixMessage(), code: "db_schema_error" });
    }

    const message = status >= 500 ? "Server error." : err?.message || "Request failed.";
    return res.status(status).json({ message });
  });

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: corsOrigin, methods: ["GET", "POST"], credentials: true },
    maxHttpBufferSize: SOCKET_MAX_BUFFER_KB * 1024
  });
  app.set("io", io);

  io.use(socketAuthMiddleware);
  registerSocketHandlers(io, store);

  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://localhost:${PORT}`);
    // eslint-disable-next-line no-console
    console.log("Auth: custom-jwt | OTP: smtp");
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
