const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SAFE_AVATAR_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const BLOCKED_ATTACHMENT_MIME_TYPES = new Set([
  "application/ecmascript",
  "application/javascript",
  "application/vnd.microsoft.portable-executable",
  "application/x-bat",
  "application/x-executable",
  "application/x-httpd-php",
  "application/x-javascript",
  "application/x-msdos-program",
  "application/x-msdownload",
  "application/x-php",
  "application/x-sh",
  "image/svg+xml",
  "text/ecmascript",
  "text/html",
  "text/javascript",
  "text/php",
  "text/x-php",
  "text/x-script",
  "text/x-sh"
]);

function getEnvNumber(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  const normalized = normalizeEmail(email);
  return Boolean(normalized) && normalized.length <= 254 && EMAIL_REGEX.test(normalized);
}

function getPasswordPolicy() {
  const minLength = Math.min(72, Math.max(8, getEnvNumber("PASSWORD_MIN_LENGTH", 8)));
  const maxLength = Math.min(72, Math.max(minLength, getEnvNumber("PASSWORD_MAX_LENGTH", 72)));
  return { minLength, maxLength };
}

function passwordPolicyMessage() {
  const { minLength, maxLength } = getPasswordPolicy();
  return `Password must be ${minLength}-${maxLength} characters and include uppercase, lowercase, and a number.`;
}

function validatePassword(password) {
  const value = String(password || "");
  const { minLength, maxLength } = getPasswordPolicy();

  if (value.length < minLength || value.length > maxLength) {
    return { ok: false, message: passwordPolicyMessage() };
  }
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value)) {
    return { ok: false, message: passwordPolicyMessage() };
  }

  return { ok: true, password: value };
}

function getSafeFileName(name, fallback = "file") {
  const source = String(name || fallback || "file").trim() || String(fallback || "file");
  return source
    .slice(0, 160)
    .replace(/[^\w.\- ()]/g, "_")
    .replace(/^\.+/, "")
    .trim() || String(fallback || "file");
}

function normalizeMime(mime) {
  return String(mime || "application/octet-stream")
    .split(";")[0]
    .trim()
    .toLowerCase();
}

function isAllowedAvatarMime(mime) {
  return SAFE_AVATAR_MIME_TYPES.has(normalizeMime(mime));
}

function isAllowedAttachmentMime(mime) {
  return !BLOCKED_ATTACHMENT_MIME_TYPES.has(normalizeMime(mime));
}

function getFileKind(mime) {
  const mt = normalizeMime(mime);
  if (mt.startsWith("image/")) return "image";
  if (mt.startsWith("video/")) return "video";
  if (mt.startsWith("audio/")) return "audio";
  return "file";
}

module.exports = {
  getEnvNumber,
  normalizeEmail,
  isValidEmail,
  getPasswordPolicy,
  passwordPolicyMessage,
  validatePassword,
  getSafeFileName,
  normalizeMime,
  isAllowedAvatarMime,
  isAllowedAttachmentMime,
  getFileKind
};
