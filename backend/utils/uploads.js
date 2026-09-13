const multer = require("multer");

const { getEnvNumber, isAllowedAttachmentMime, isAllowedAvatarMime } = require("./security");

function getUploadMaxBytes(envName, fallbackMb) {
  const mb = getEnvNumber(envName, fallbackMb);
  return Math.max(1, mb) * 1024 * 1024;
}

function createSingleFileUpload({
  mode = "attachment",
  maxMbEnv = "UPLOAD_MAX_MB",
  fallbackMb = 15,
  tooLargeMessage = "File too large.",
  invalidMessage = "Invalid file upload."
} = {}) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: getUploadMaxBytes(maxMbEnv, fallbackMb),
      files: 1,
      fields: 4,
      fieldSize: 64 * 1024,
      parts: 6
    },
    fileFilter: (_req, file, cb) => {
      const isAllowed = mode === "avatar" ? isAllowedAvatarMime(file?.mimetype) : isAllowedAttachmentMime(file?.mimetype);
      if (!isAllowed) {
        const err = new Error(
          mode === "avatar"
            ? "Unsupported avatar format. Use JPG, PNG, WEBP, or GIF."
            : "This file type is blocked for security reasons."
        );
        err.status = 415;
        err.code = "UNSUPPORTED_MEDIA_TYPE";
        return cb(err);
      }
      return cb(null, true);
    }
  });

  return (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (!err) return next();
      const code = String(err?.code || "");
      if (code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ message: tooLargeMessage });
      }
      if (err?.status === 415 || code === "UNSUPPORTED_MEDIA_TYPE") {
        return res.status(415).json({ message: err.message });
      }
      return res.status(400).json({ message: invalidMessage });
    });
  };
}

module.exports = { createSingleFileUpload };
