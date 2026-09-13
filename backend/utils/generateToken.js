const jwt = require("jsonwebtoken");

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const err = new Error("Server misconfigured: JWT_SECRET is missing.");
    err.code = "SERVER_MISCONFIG";
    throw err;
  }
  return secret;
}

function signAccessToken({ id, email }) {
  const secret = getJwtSecret();
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";

  return jwt.sign({ email }, secret, {
    algorithm: "HS256",
    subject: id,
    expiresIn
  });
}

module.exports = { signAccessToken };

