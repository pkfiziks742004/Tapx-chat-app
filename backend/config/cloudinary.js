const cloudinary = require("cloudinary").v2;

function isCloudinaryConfigured() {
  if (process.env.CLOUDINARY_URL) return true;
  return Boolean(
    (process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_NAME) &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

function initCloudinary() {
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config();
    return;
  }
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  if (cloud_name && api_key && api_secret) {
    cloudinary.config({
      cloud_name,
      api_key,
      api_secret,
      secure: true
    });
  }
}

initCloudinary();

/**
 * Upload a memory buffer to Cloudinary using upload_stream
 * @param {Object} options
 * @param {Buffer} options.buffer - The file buffer
 * @param {string} [options.folder] - Folder path in Cloudinary (e.g., "chat_app/avatars")
 * @param {string} [options.resource_type] - "auto" | "image" | "video" | "raw"
 * @param {string} [options.public_id] - Optional custom public ID
 * @param {string} [options.filename] - Original filename for context
 * @returns {Promise<{ url: string, public_id: string, format: string, bytes: number, resource_type: string, bucket: string, path: string }>}
 */
function uploadBuffer({ buffer, folder = "chat_app", resource_type = "auto", public_id, filename } = {}) {
  return new Promise((resolve, reject) => {
    if (!isCloudinaryConfigured()) {
      return reject(new Error("Cloudinary credentials are not configured in environment variables."));
    }
    if (!buffer || !Buffer.isBuffer(buffer)) {
      return reject(new Error("Valid file buffer is required for Cloudinary upload."));
    }

    const uploadOptions = {
      folder,
      resource_type: resource_type || "auto",
      use_filename: true,
      unique_filename: true,
      overwrite: false
    };

    if (public_id) {
      uploadOptions.public_id = public_id;
    }

    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) return reject(error);
      if (!result) return reject(new Error("Empty response from Cloudinary upload."));

      const secureUrl = result.secure_url || result.url;
      resolve({
        url: secureUrl,
        public_id: result.public_id,
        format: result.format,
        bytes: result.bytes,
        resource_type: result.resource_type,
        bucket: "cloudinary",
        path: secureUrl
      });
    });

    stream.end(buffer);
  });
}

/**
 * Delete a resource from Cloudinary
 * @param {Object} options
 * @param {string} options.public_id
 * @param {string} [options.resource_type] - "image" | "video" | "raw"
 */
async function deleteResource({ public_id, resource_type = "image" } = {}) {
  if (!isCloudinaryConfigured() || !public_id) return { result: "skipped" };
  try {
    return await cloudinary.uploader.destroy(public_id, { resource_type: resource_type || "image" });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("Cloudinary destroy error:", err?.message || err);
    return { result: "error", error: err?.message };
  }
}

module.exports = {
  cloudinary,
  isCloudinaryConfigured,
  uploadBuffer,
  deleteResource
};
