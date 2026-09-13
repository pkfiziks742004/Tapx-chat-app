const jwt = require("jsonwebtoken");

function getBearerToken(req) {
  const header = req.headers.authorization;
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

function verifyAccessToken(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const err = new Error("Server misconfigured: JWT_SECRET is missing.");
    err.code = "SERVER_MISCONFIG";
    throw err;
  }

  const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
  const id = payload?.sub;
  const email = payload?.email;
  if (!id || !email) {
    const err = new Error("Invalid token payload.");
    err.code = "INVALID_TOKEN";
    throw err;
  }
  return { id, email };
}

function devBypassUser(req) {
  const enabled = process.env.DEV_AUTH_BYPASS === "1";
  const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";
  if (isProd) return null;
  if (!enabled) return null;
  const id = req.headers["x-dev-user-id"] || "dev-user";
  const email = req.headers["x-dev-email"] || "dev@example.com";
  return { id: String(id), email: String(email) };
}

function authMiddleware(req, res, next) {
  try {
    if (req.method === "OPTIONS") return next();

    const devUser = devBypassUser(req);
    if (devUser) {
      req.user = devUser;
      return next();
    }

    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ message: "Missing access token." });

    req.user = verifyAccessToken(token);
    return next();
  } catch (err) {
    if (err?.code === "SERVER_MISCONFIG") {
      return res.status(500).json({ message: err.message });
    }
    return res.status(401).json({ message: "Invalid access token." });
  }
}

function socketAuthMiddleware(socket, next) {
  try {
    const token = socket.handshake?.auth?.token;
    if (!token) return next(new Error("Missing access token."));
    socket.user = verifyAccessToken(token);
    return next();
  } catch (_err) {
    return next(new Error("Invalid access token."));
  }
}

module.exports = { authMiddleware, socketAuthMiddleware };
