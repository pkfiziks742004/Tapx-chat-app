const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");
const cloudinaryHelper = require("./cloudinary");

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isMissingColumnError(err, column) {
  const code = String(err?.code || "");
  const msg = String(err?.message || "").toLowerCase();
  const col = String(column || "").toLowerCase();
  if (!col) return false;
  return code === "42703" && msg.includes(col) && msg.includes("does not exist");
}

function isMissingTableError(err, table) {
  const code = String(err?.code || "");
  const msg = String(err?.message || "").toLowerCase();
  const t = String(table || "").toLowerCase();
  if (!t) return false;
  if (code !== "42P01") return false;
  return (msg.includes("relation") && msg.includes("does not exist") && msg.includes(t)) || msg.includes(t);
}

const MESSAGE_BASE_SELECT = "id,from_id,to_id,text,created_at,delivered_at,read_at";
const MESSAGE_MIN_SELECT = "id,from_id,to_id,text,created_at";
const MESSAGE_FILE_SELECT = "file_bucket,file_path,file_name,file_mime,file_size,file_kind";
const MESSAGE_DELETE_SELECT = "deleted_for_everyone_at,deleted_for_everyone_by";
const MESSAGE_SELECT_WITH_FILE = `${MESSAGE_BASE_SELECT},${MESSAGE_FILE_SELECT}`;
const MESSAGE_MIN_SELECT_WITH_FILE = `${MESSAGE_MIN_SELECT},${MESSAGE_FILE_SELECT}`;
const MESSAGE_BASE_SELECT_WITH_DELETE = `${MESSAGE_BASE_SELECT},${MESSAGE_DELETE_SELECT}`;
const MESSAGE_MIN_SELECT_WITH_DELETE = `${MESSAGE_MIN_SELECT},${MESSAGE_DELETE_SELECT}`;
const MESSAGE_SELECT_WITH_FILE_AND_DELETE = `${MESSAGE_BASE_SELECT_WITH_DELETE},${MESSAGE_FILE_SELECT}`;
const MESSAGE_MIN_SELECT_WITH_FILE_AND_DELETE = `${MESSAGE_MIN_SELECT_WITH_DELETE},${MESSAGE_FILE_SELECT}`;

const CALL_LOG_SELECT = "id,from_id,to_id,media,status,created_at,started_at,ended_at,ended_by,end_reason";

function isMissingMessageFileColumns(err) {
  return (
    isMissingColumnError(err, "file_bucket") ||
    isMissingColumnError(err, "file_path") ||
    isMissingColumnError(err, "file_name") ||
    isMissingColumnError(err, "file_mime") ||
    isMissingColumnError(err, "file_size") ||
    isMissingColumnError(err, "file_kind")
  );
}

function isMissingMessageStatusColumns(err) {
  return isMissingColumnError(err, "delivered_at") || isMissingColumnError(err, "read_at");
}

function isMissingMessageDeleteColumns(err) {
  return (
    isMissingColumnError(err, "deleted_for_everyone_at") ||
    isMissingColumnError(err, "deleted_for_everyone_by")
  );
}

function getEnvNumber(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function getMessageTtlHours() {
  const hours = getEnvNumber("MESSAGE_TTL_HOURS", 24);
  return Math.max(0, hours);
}

function getMessageCutoffIso() {
  const hours = getMessageTtlHours();
  if (!hours) return null;
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function mapProfile(row) {
  if (!row) return null;
  const avatarPath = row.avatar_path || null;
  return {
    id: row.id,
    email: row.email,
    name: row.name || "",
    bio: row.bio || "",
    avatar: avatarPath
      ? {
          bucket: row.avatar_bucket || null,
          path: avatarPath,
          updatedAt: row.avatar_updated_at || null
        }
      : null,
    avatarUrl: null,
    emailVerified: Boolean(row.email_verified),
    createdAt: row.created_at
  };
}

function mapMessage(row) {
  if (!row) return null;
  const deletedForEveryoneAt = row.deleted_for_everyone_at || null;
  const deletedForEveryoneBy = row.deleted_for_everyone_by || null;
  const deletedForEveryone = Boolean(deletedForEveryoneAt);
  const filePath = row.file_path || null;
  const file = filePath
    ? {
        bucket: row.file_bucket || null,
        path: filePath,
        name: row.file_name || "",
        mime: row.file_mime || "",
        size: row.file_size ?? null,
        kind: row.file_kind || "file",
        url: row.file_url || null
      }
    : null;
  return {
    id: row.id,
    from: row.from_id,
    to: row.to_id,
    text: deletedForEveryone ? "" : row.text,
    createdAt: row.created_at,
    deliveredAt: row.delivered_at || null,
    readAt: row.read_at || null,
    deletedForEveryoneAt,
    deletedForEveryoneBy,
    file: deletedForEveryone ? null : file
  };
}

function mapCallLog(row) {
  if (!row) return null;
  const safeMedia = row.media === "video" ? "video" : "audio";
  const safeStatus = typeof row.status === "string" && row.status ? row.status : "ringing";
  return {
    id: row.id,
    from: row.from_id,
    to: row.to_id,
    media: safeMedia,
    status: safeStatus,
    createdAt: row.created_at,
    startedAt: row.started_at || null,
    endedAt: row.ended_at || null,
    endedBy: row.ended_by || null,
    endReason: row.end_reason || null
  };
}

function mapGroup(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name || "",
    createdBy: row.created_by || null,
    createdAt: row.created_at
  };
}

function mapGroupMessage(row, { fromNameById } = {}) {
  if (!row) return null;
  const deletedForEveryoneAt = row.deleted_for_everyone_at || null;
  const deletedForEveryoneBy = row.deleted_for_everyone_by || null;
  const deletedForEveryone = Boolean(deletedForEveryoneAt);
  const filePath = row.file_path || null;
  const file = filePath
    ? {
        bucket: row.file_bucket || null,
        path: filePath,
        name: row.file_name || "",
        mime: row.file_mime || "",
        size: row.file_size ?? null,
        kind: row.file_kind || "file",
        url: row.file_url || null
      }
    : null;

  const fromName =
    (fromNameById && row.from_id ? fromNameById.get(row.from_id) : null) || row.from_name || row.from_email || "";

  return {
    id: row.id,
    groupId: row.group_id,
    from: row.from_id,
    fromName,
    // Keep frontend message shape compatible (Message.jsx expects `to`)
    to: row.group_id,
    text: deletedForEveryone ? "" : row.text,
    createdAt: row.created_at,
    deletedForEveryoneAt,
    deletedForEveryoneBy,
    file: deletedForEveryone ? null : file
  };
}

function createSupabaseStore({ url, serviceRoleKey }) {
  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });

  const storageBucket = process.env.STORAGE_BUCKET || "chat-files";
  const signedUrlSeconds = getEnvNumber("STORAGE_SIGNED_URL_SECONDS", 60 * 60 * 24);

  async function ensureBucketExists(bucket = storageBucket) {
    const { data, error } = await supabase.storage.getBucket(bucket);
    if (!error && data) return;

    const msg = String(error?.message || "").toLowerCase();
    const notFound =
      msg.includes("not found") || msg.includes("does not exist") || msg.includes("missing");
    if (!notFound) throw error;

    const { error: createErr } = await supabase.storage.createBucket(bucket, { public: false });
    if (createErr) {
      const cm = String(createErr?.message || "").toLowerCase();
      if (!cm.includes("already exists")) throw createErr;
    }
  }

  async function uploadAttachment({
    path,
    data,
    contentType,
    bucket = storageBucket,
    folder = "chat_app",
    resource_type = "auto",
    filename
  } = {}) {
    if (cloudinaryHelper.isCloudinaryConfigured()) {
      try {
        const cloudResult = await cloudinaryHelper.uploadBuffer({
          buffer: data,
          folder,
          resource_type,
          filename
        });
        return {
          bucket: "cloudinary",
          path: cloudResult.url,
          url: cloudResult.url,
          public_id: cloudResult.public_id
        };
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("Cloudinary upload failed, falling back to Supabase storage:", err?.message || err);
      }
    }

    if (!path) throw new Error("Missing upload path.");
    await ensureBucketExists(bucket);
    const { error } = await supabase.storage.from(bucket).upload(path, data, {
      contentType,
      upsert: false
    });
    if (error) throw error;
    return { bucket, path };
  }

  async function createAttachmentSignedUrl({ path, bucket = storageBucket, expiresInSeconds } = {}) {
    if (!path) return null;
    if (path.startsWith("http://") || path.startsWith("https://") || bucket === "cloudinary") {
      return path;
    }
    const seconds = Number.isFinite(expiresInSeconds) ? Math.max(60, expiresInSeconds) : signedUrlSeconds;
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, seconds);
    if (error) throw error;
    return data?.signedUrl || null;
  }

  const avatarUrlCache = new Map(); // key -> { url, expiresAtMs }
  const avatarCacheSkewMs = 30 * 1000;

  function avatarCacheKey({ bucket, path } = {}) {
    if (!bucket || !path) return "";
    return `${bucket}:${path}`;
  }

  async function getAvatarSignedUrl({ bucket = storageBucket, path } = {}) {
    if (!path) return null;
    if (path.startsWith("http://") || path.startsWith("https://") || bucket === "cloudinary") {
      return path;
    }
    const safeBucket = bucket || storageBucket;
    const key = avatarCacheKey({ bucket: safeBucket, path });
    if (key) {
      const cached = avatarUrlCache.get(key);
      if (cached?.url && cached?.expiresAtMs && cached.expiresAtMs - avatarCacheSkewMs > Date.now()) {
        return cached.url;
      }
    }

    const url = await createAttachmentSignedUrl({ bucket: safeBucket, path });
    if (key && url) {
      avatarUrlCache.set(key, { url, expiresAtMs: Date.now() + signedUrlSeconds * 1000 });
    }
    return url || null;
  }

  async function withAvatarUrl(profile) {
    if (!profile) return null;
    if (!profile.avatar?.path) return profile;
    try {
      const bucket = profile.avatar.bucket || storageBucket;
      const url = await getAvatarSignedUrl({ bucket, path: profile.avatar.path });
      return { ...profile, avatarUrl: url || null };
    } catch (_e) {
      return profile;
    }
  }

  async function removeAttachments({ bucket = storageBucket, paths } = {}) {
    const list = (paths || []).filter(Boolean);
    if (list.length === 0) return { ok: true, removed: 0 };
    if (bucket === "cloudinary") {
      return { ok: true, removed: list.length };
    }
    const { error } = await supabase.storage.from(bucket).remove(list);
    if (error) throw error;
    return { ok: true, removed: list.length };
  }

  async function getUserById(id) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return withAvatarUrl(mapProfile(data));
  }

  async function getUserByEmail(email) {
    const normalizedEmail = normalizeEmail(email);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (error) throw error;
    return withAvatarUrl(mapProfile(data));
  }

  async function getUserAuthById(id) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    const user = await withAvatarUrl(mapProfile(data));
    return { ...user, passwordHash: data.password_hash || null };
  }

  async function getUserAuthByEmail(email) {
    const normalizedEmail = normalizeEmail(email);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    const user = await withAvatarUrl(mapProfile(data));
    return { ...user, passwordHash: data.password_hash || null };
  }

  async function createUser({ email, emailVerified = true } = {}) {
    const normalizedEmail = normalizeEmail(email);
    const id = crypto.randomUUID();

    const { data, error } = await supabase
      .from("profiles")
      .insert({ id, email: normalizedEmail, email_verified: Boolean(emailVerified) })
      .select("*")
      .single();

    if (error) {
      if (String(error.code || "") === "23505") {
        const existing = await getUserByEmail(normalizedEmail);
        if (existing) return existing;
      }
      throw error;
    }
    return withAvatarUrl(mapProfile(data));
  }

  async function setUserEmailVerified(id, value = true) {
    const { data, error } = await supabase
      .from("profiles")
      .update({ email_verified: Boolean(value) })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return withAvatarUrl(mapProfile(data));
  }

  async function updateUserName(id, name) {
    const { data, error } = await supabase
      .from("profiles")
      .update({ name })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return withAvatarUrl(mapProfile(data));
  }

  async function updateUserBio(id, bio) {
    const { data, error } = await supabase
      .from("profiles")
      .update({ bio })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return withAvatarUrl(mapProfile(data));
  }

  async function updateUserProfile(id, { name, bio } = {}) {
    const payload = {};
    if (typeof name === "string") payload.name = name;
    if (typeof bio === "string") payload.bio = bio;
    if (Object.keys(payload).length === 0) return getUserById(id);

    const { data, error } = await supabase.from("profiles").update(payload).eq("id", id).select("*").single();
    if (error) throw error;
    return withAvatarUrl(mapProfile(data));
  }

  async function updateUserAvatar({ userId, bucket, path } = {}) {
    const now = new Date().toISOString();
    const payload = {
      avatar_bucket: bucket || null,
      avatar_path: path || null,
      avatar_updated_at: now
    };

    const { data, error } = await supabase.from("profiles").update(payload).eq("id", userId).select("*").single();
    if (error) throw error;
    return withAvatarUrl(mapProfile(data));
  }

  async function setUserPasswordHash(id, passwordHash) {
    const { data, error } = await supabase
      .from("profiles")
      .update({ password_hash: passwordHash })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return withAvatarUrl(mapProfile(data));
  }

  async function getLatestEmailOtp(email, purpose) {
    const normalizedEmail = normalizeEmail(email);
    const { data, error } = await supabase
      .from("email_otps")
      .select("created_at")
      .eq("email", normalizedEmail)
      .eq("purpose", purpose)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) return null;
    return { createdAt: data[0].created_at };
  }

  async function createEmailOtp({ email, purpose, otpHash, expiresAt }) {
    const normalizedEmail = normalizeEmail(email);
    const { error } = await supabase
      .from("email_otps")
      .insert({ email: normalizedEmail, purpose, otp_hash: otpHash, expires_at: expiresAt });

    if (error) throw error;
  }

  async function getValidEmailOtp({ email, purpose, otpHash }) {
    const normalizedEmail = normalizeEmail(email);
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("email_otps")
      .select("id,expires_at,created_at")
      .eq("email", normalizedEmail)
      .eq("purpose", purpose)
      .eq("otp_hash", otpHash)
      .is("consumed_at", null)
      .gt("expires_at", now)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) return null;
    return { id: data[0].id, expiresAt: data[0].expires_at, createdAt: data[0].created_at };
  }

  async function consumeEmailOtpById(id) {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("email_otps")
      .update({ consumed_at: now })
      .eq("id", id)
      .is("consumed_at", null)
      .gt("expires_at", now)
      .select("id");

    if (error) throw error;
    if (!data || data.length === 0) return null;
    return { id: data[0].id };
  }

  async function consumeEmailOtp({ email, purpose, otpHash }) {
    const normalizedEmail = normalizeEmail(email);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("email_otps")
      .update({ consumed_at: now })
      .eq("email", normalizedEmail)
      .eq("purpose", purpose)
      .eq("otp_hash", otpHash)
      .is("consumed_at", null)
      .gt("expires_at", now)
      .select("id");

    if (error) throw error;
    if (!data || data.length === 0) return null;
    return { id: data[0].id };
  }

  async function addContact(ownerId, contactId) {
    const { error } = await supabase
      .from("contacts")
      .upsert(
        { owner_id: ownerId, contact_id: contactId },
        { onConflict: "owner_id,contact_id", ignoreDuplicates: true }
      );

    if (error) throw error;
  }

  async function getChatClearAt(ownerId, peerId) {
    const { data, error } = await supabase
      .from("contacts")
      .select("cleared_at")
      .eq("owner_id", ownerId)
      .eq("contact_id", peerId)
      .maybeSingle();

    if (error) {
      if (isMissingColumnError(error, "cleared_at")) return null;
      throw error;
    }
    return data?.cleared_at || null;
  }

  async function clearChat(ownerId, peerId) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("contacts")
      .upsert(
        { owner_id: ownerId, contact_id: peerId, cleared_at: now },
        { onConflict: "owner_id,contact_id" }
      );

    if (error) {
      if (isMissingColumnError(error, "cleared_at")) {
        const e = new Error(
          "Database schema missing `contacts.cleared_at`. Run supabase/schema.sql in Supabase Dashboard -> SQL Editor, then restart the server."
        );
        e.code = "db_schema_error";
        throw e;
      }
      throw error;
    }
    return { clearedAt: now };
  }

  async function listContacts(ownerId) {
    const { data: links, error } = await supabase
      .from("contacts")
      .select("contact_id")
      .eq("owner_id", ownerId);

    if (error) throw error;

    const ids = (links || []).map((l) => l.contact_id).filter(Boolean);
    if (ids.length === 0) return [];

    const { data: users, error: e2 } = await supabase
      .from("profiles")
      .select("*")
      .in("id", ids);

    if (e2) throw e2;
    const list = (users || []).map(mapProfile).filter(Boolean);
    return Promise.all(list.map(withAvatarUrl));
  }

  async function listGroupIdsForUser(userId) {
    const { data, error } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", userId);
    if (error) throw error;
    return (data || []).map((r) => r.group_id).filter(Boolean);
  }

  async function isUserGroupMember(userId, groupId) {
    if (!userId || !groupId) return false;
    const { data, error } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data?.group_id);
  }

  async function listGroupMemberIds(groupId) {
    const { data, error } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupId);
    if (error) throw error;
    return (data || []).map((r) => r.user_id).filter(Boolean);
  }

  async function listGroups(userId) {
    const ids = await listGroupIdsForUser(userId);
    if (ids.length === 0) return [];

    const { data: groups, error } = await supabase
      .from("groups")
      .select("id,name,created_by,created_at")
      .in("id", ids);
    if (error) throw error;

    const { data: members, error: mErr } = await supabase
      .from("group_members")
      .select("group_id,user_id")
      .in("group_id", ids);
    if (mErr) throw mErr;

    const counts = {};
    for (const r of members || []) {
      if (!r?.group_id) continue;
      counts[r.group_id] = (counts[r.group_id] || 0) + 1;
    }

    return (groups || [])
      .map((g) => {
        const gg = mapGroup(g);
        if (!gg) return null;
        return { ...gg, memberCount: counts[gg.id] || 0 };
      })
      .filter(Boolean);
  }

  async function createGroup({ userId, name, memberIds } = {}) {
    const cleanName = String(name || "").trim().slice(0, 48);
    if (!cleanName) throw new Error("Group name is required.");

    const unique = Array.from(new Set((memberIds || []).filter((x) => typeof x === "string")));
    const allMembers = Array.from(new Set([userId, ...unique])).filter(Boolean);
    if (allMembers.length < 2) throw new Error("Pick at least 1 member.");
    if (allMembers.length > 64) throw new Error("Too many members.");

    const { data: group, error } = await supabase
      .from("groups")
      .insert({ name: cleanName, created_by: userId })
      .select("id,name,created_by,created_at")
      .single();
    if (error) throw error;

    const rows = allMembers.map((id) => ({
      group_id: group.id,
      user_id: id,
      role: id === userId ? "admin" : "member"
    }));

    const { error: mErr } = await supabase.from("group_members").insert(rows);
    if (mErr) throw mErr;

    return { ...mapGroup(group), memberCount: allMembers.length };
  }

  async function getGroupMemberMeta({ userId, groupId } = {}) {
    const { data, error } = await supabase
      .from("group_members")
      .select("group_id,cleared_at,last_read_at,joined_at")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data || null;
  }

  async function clearGroupChat({ userId, groupId } = {}) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("group_members")
      .update({ cleared_at: now })
      .eq("group_id", groupId)
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true, clearedAt: now };
  }

  async function markGroupRead({ userId, groupId } = {}) {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("group_members")
      .update({ last_read_at: now })
      .eq("group_id", groupId)
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true, readAt: now };
  }

  async function listGroupMessages(userId, groupId, limit = 100, { after } = {}) {
    const meta = await getGroupMemberMeta({ userId, groupId });
    if (!meta) return [];

    const clearedAt = meta.cleared_at || null;
    const cutoff = getMessageCutoffIso();

    const query = supabase
      .from("group_messages")
      .select(
        "id,group_id,from_id,text,created_at,deleted_for_everyone_at,deleted_for_everyone_by,file_bucket,file_path,file_name,file_mime,file_size,file_kind"
      )
      .eq("group_id", groupId)
      .order("created_at", { ascending: true })
      .limit(Math.max(1, Math.min(200, limit)));

    if (cutoff) query.gte("created_at", cutoff);
    if (after) query.gte("created_at", after);
    if (clearedAt) query.gt("created_at", clearedAt);

    const { data: rows, error } = await query;
    if (error) throw error;

    const ids = (rows || []).map((r) => r.id).filter(Boolean);
    let deletedSet = null;
    if (ids.length > 0) {
      try {
        const { data: dels, error: dErr } = await supabase
          .from("group_message_deletes")
          .select("group_message_id")
          .eq("user_id", userId)
          .in("group_message_id", ids);
        if (dErr) throw dErr;
        deletedSet = new Set((dels || []).map((d) => d.group_message_id).filter(Boolean));
      } catch (err) {
        const code = String(err?.code || "");
        const msg = String(err?.message || "").toLowerCase();
        const missing =
          code === "42P01" || msg.includes("group_message_deletes") || msg.includes("does not exist");
        if (!missing) throw err;
      }
    }

    const visibleRows = deletedSet ? (rows || []).filter((r) => !deletedSet.has(r.id)) : rows || [];

    const fromIds = Array.from(new Set((visibleRows || []).map((r) => r.from_id).filter(Boolean)));
    const fromNameById = new Map();
    if (fromIds.length) {
      const { data: profs, error: pErr } = await supabase
        .from("profiles")
        .select("id,name,email")
        .in("id", fromIds);
      if (pErr) throw pErr;
      for (const p of profs || []) {
        const name = p?.name || p?.email || "";
        if (p?.id) fromNameById.set(p.id, name);
      }
    }

    return (visibleRows || []).map((r) => mapGroupMessage(r, { fromNameById })).filter(Boolean);
  }

  async function createGroupMessage({ userId, groupId, text } = {}) {
    const meta = await getGroupMemberMeta({ userId, groupId });
    if (!meta) return null;

    const clean = String(text || "").trim().slice(0, 1000);
    if (!clean) throw new Error("Message text is required.");

    const { data, error } = await supabase
      .from("group_messages")
      .insert({ group_id: groupId, from_id: userId, text: clean })
      .select(
        "id,group_id,from_id,text,created_at,deleted_for_everyone_at,deleted_for_everyone_by,file_bucket,file_path,file_name,file_mime,file_size,file_kind"
      )
      .single();
    if (error) throw error;
    return mapGroupMessage(data);
  }

  async function createGroupFileMessage({ from, groupId, text, file } = {}) {
    const meta = await getGroupMemberMeta({ userId: from, groupId });
    if (!meta) return null;

    const { data, error } = await supabase
      .from("group_messages")
      .insert({
        group_id: groupId,
        from_id: from,
        text: text ?? "",
        file_bucket: file?.bucket || null,
        file_path: file?.path || null,
        file_name: file?.name || null,
        file_mime: file?.mime || null,
        file_size: file?.size ?? null,
        file_kind: file?.kind || null
      })
      .select(
        "id,group_id,from_id,text,created_at,deleted_for_everyone_at,deleted_for_everyone_by,file_bucket,file_path,file_name,file_mime,file_size,file_kind"
      )
      .single();
    if (error) throw error;
    return mapGroupMessage(data);
  }

  async function deleteGroupMessagesForMe({ userId, groupId, messageIds } = {}) {
    const ids = Array.from(new Set((messageIds || []).filter(Boolean)));
    if (ids.length === 0) return { ok: true, deletedIds: [], deletedAt: null };

    const meta = await getGroupMemberMeta({ userId, groupId });
    if (!meta) return { ok: false, notFound: true };

    const { data: rows, error } = await supabase
      .from("group_messages")
      .select("id,group_id")
      .eq("group_id", groupId)
      .in("id", ids);
    if (error) throw error;

    const allowed = (rows || []).map((r) => r.id).filter(Boolean);
    if (allowed.length === 0) return { ok: true, deletedIds: [], deletedAt: null };

    const now = new Date().toISOString();
    const insRows = allowed.map((mid) => ({ group_message_id: mid, user_id: userId, deleted_at: now }));
    const { error: delErr } = await supabase
      .from("group_message_deletes")
      .upsert(insRows, { onConflict: "group_message_id,user_id" });
    if (delErr) throw delErr;

    return { ok: true, deletedIds: allowed, deletedAt: now };
  }

  async function deleteGroupMessagesForEveryone({ userId, groupId, messageIds } = {}) {
    const ids = Array.from(new Set((messageIds || []).filter(Boolean)));
    if (ids.length === 0) return { ok: true, messages: [] };

    const meta = await getGroupMemberMeta({ userId, groupId });
    if (!meta) return { ok: false, notFound: true };

    const now = new Date().toISOString();
    const res = await supabase
      .from("group_messages")
      .update({ deleted_for_everyone_at: now, deleted_for_everyone_by: userId, text: "" })
      .eq("group_id", groupId)
      .eq("from_id", userId)
      .in("id", ids)
      .select(
        "id,group_id,from_id,text,created_at,deleted_for_everyone_at,deleted_for_everyone_by,file_bucket,file_path,file_name,file_mime,file_size,file_kind"
      );

    if (res.error) throw res.error;
    const list = (res.data || []).map(mapGroupMessage).filter(Boolean);
    return { ok: true, messages: list };
  }

  async function listThreads(ownerId, { perDirectionLimit = 2000, unreadLimit = 5000 } = {}) {
    let linksRes = await supabase
      .from("contacts")
      .select("contact_id,cleared_at")
      .eq("owner_id", ownerId);

    if (linksRes.error && isMissingColumnError(linksRes.error, "cleared_at")) {
      linksRes = await supabase.from("contacts").select("contact_id").eq("owner_id", ownerId);
    }

    if (linksRes.error) throw linksRes.error;
    const links = linksRes.data || [];

    const clearedAtById = Object.fromEntries(
      (links || [])
        .filter((l) => l?.contact_id)
        .map((l) => [l.contact_id, l.cleared_at || null])
    );

    const contactIds = Object.keys(clearedAtById);
    if (contactIds.length === 0) return {};

    const threads = {};
    for (const id of contactIds) threads[id] = { unread: 0, lastText: "", lastAt: null };

    const cutoff = getMessageCutoffIso();

    async function run(selectFields) {
      const outgoingQuery = supabase
        .from("messages")
        .select(selectFields)
        .eq("from_id", ownerId)
        .in("to_id", contactIds)
        .order("created_at", { ascending: false })
        .limit(perDirectionLimit);

      const incomingQuery = supabase
        .from("messages")
        .select(selectFields)
        .eq("to_id", ownerId)
        .in("from_id", contactIds)
        .order("created_at", { ascending: false })
        .limit(perDirectionLimit);

      const unreadQuery = supabase
        .from("messages")
        .select("from_id,created_at")
        .eq("to_id", ownerId)
        .in("from_id", contactIds)
        .is("read_at", null)
        .limit(unreadLimit);

      if (cutoff) {
        outgoingQuery.gte("created_at", cutoff);
        incomingQuery.gte("created_at", cutoff);
        unreadQuery.gte("created_at", cutoff);
      }

      const [outgoingRes, incomingRes] = await Promise.all([outgoingQuery, incomingQuery]);

      let unreadRes = await unreadQuery;
      if (unreadRes.error && isMissingColumnError(unreadRes.error, "read_at")) {
        unreadRes = { data: [], error: null };
      }

      return { outgoingRes, incomingRes, unreadRes };
    }

    const selects = [
      "id,from_id,to_id,text,created_at,file_kind,file_name,deleted_for_everyone_at",
      "id,from_id,to_id,text,created_at,file_kind,file_name",
      "id,from_id,to_id,text,created_at,deleted_for_everyone_at",
      "id,from_id,to_id,text,created_at"
    ];

    let results = null;
    let lastErr = null;
    for (const fields of selects) {
      results = await run(fields);
      const outErr = results.outgoingRes.error;
      const inErr = results.incomingRes.error;
      if (!outErr && !inErr) {
        lastErr = null;
        break;
      }
      lastErr = outErr || inErr;
      const expected =
        (outErr && (isMissingMessageFileColumns(outErr) || isMissingMessageDeleteColumns(outErr))) ||
        (inErr && (isMissingMessageFileColumns(inErr) || isMissingMessageDeleteColumns(inErr)));
      if (!expected) break;
    }
    if (lastErr) throw lastErr;

    if (results.outgoingRes.error) throw results.outgoingRes.error;
    if (results.incomingRes.error) throw results.incomingRes.error;
    if (results.unreadRes.error) throw results.unreadRes.error;

    const all = [...(results.outgoingRes.data || []), ...(results.incomingRes.data || [])].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    for (const row of all) {
      const otherId = row.from_id === ownerId ? row.to_id : row.from_id;
      if (!otherId || !threads[otherId]) continue;
      const clearedAt = clearedAtById[otherId];
      if (clearedAt && new Date(row.created_at).getTime() <= new Date(clearedAt).getTime()) continue;
      if (threads[otherId].lastAt) continue;

      const deleted = Boolean(row.deleted_for_everyone_at);
      const fallbackText = deleted
        ? "Message deleted"
        : row.file_kind === "image"
          ? "Photo"
          : row.file_kind === "video"
            ? "Video"
            : row.file_kind === "audio"
              ? "Voice message"
              : row.file_name || (row.file_kind ? "File" : "");

      threads[otherId] = {
        ...threads[otherId],
        lastText: row.text || fallbackText || "",
        lastAt: row.created_at
      };
    }

    for (const row of results.unreadRes.data || []) {
      const otherId = row.from_id;
      if (!otherId || !threads[otherId]) continue;
      const clearedAt = clearedAtById[otherId];
      if (clearedAt && new Date(row.created_at).getTime() <= new Date(clearedAt).getTime()) continue;
      threads[otherId] = { ...threads[otherId], unread: (threads[otherId].unread || 0) + 1 };
    }

    // Optional: Group threads (safe to skip if group tables aren't migrated yet)
    try {
      const gmRes = await supabase
        .from("group_members")
        .select("group_id,cleared_at,last_read_at,joined_at")
        .eq("user_id", ownerId);

      if (!gmRes.error) {
        const links = gmRes.data || [];
        const groupIds = links.map((l) => l.group_id).filter(Boolean);

        if (groupIds.length > 0) {
          const clearedAtByGroup = Object.fromEntries(
            links.filter((l) => l?.group_id).map((l) => [l.group_id, l.cleared_at || null])
          );
          const lastReadByGroup = Object.fromEntries(
            links.filter((l) => l?.group_id).map((l) => [l.group_id, l.last_read_at || null])
          );
          const joinedAtByGroup = Object.fromEntries(
            links.filter((l) => l?.group_id).map((l) => [l.group_id, l.joined_at || null])
          );

          for (const id of groupIds) {
            if (!threads[id]) threads[id] = { unread: 0, lastText: "", lastAt: null };
          }

          const cutoff = getMessageCutoffIso();
          const selects = [
            "id,group_id,from_id,text,created_at,file_kind,file_name,deleted_for_everyone_at",
            "id,group_id,from_id,text,created_at,file_kind,file_name",
            "id,group_id,from_id,text,created_at,deleted_for_everyone_at",
            "id,group_id,from_id,text,created_at"
          ];

          let lastRes = null;
          let lastErr = null;
          for (const fields of selects) {
            const q = supabase
              .from("group_messages")
              .select(fields)
              .in("group_id", groupIds)
              .order("created_at", { ascending: false })
              .limit(perDirectionLimit);
            if (cutoff) q.gte("created_at", cutoff);
            lastRes = await q;
            if (!lastRes.error) {
              lastErr = null;
              break;
            }
            lastErr = lastRes.error;
          }
          if (lastErr) throw lastErr;

          for (const row of lastRes.data || []) {
            const gid = row.group_id;
            if (!gid || !threads[gid]) continue;
            const clearedAt = clearedAtByGroup[gid];
            if (clearedAt && new Date(row.created_at).getTime() <= new Date(clearedAt).getTime()) continue;
            if (threads[gid].lastAt) continue;

            const deleted = Boolean(row.deleted_for_everyone_at);
            const fallbackText = deleted
              ? "Message deleted"
              : row.file_kind === "image"
                ? "Photo"
                : row.file_kind === "video"
                  ? "Video"
                  : row.file_kind === "audio"
                    ? "Voice message"
                    : row.file_name || (row.file_kind ? "File" : "");

            threads[gid] = { ...threads[gid], lastText: row.text || fallbackText || "", lastAt: row.created_at };
          }

          // Unread (approx): count messages newer than user's last_read_at/joined_at and after cleared_at
          const baselineTimes = links
            .map((l) => l?.last_read_at || l?.joined_at || null)
            .filter(Boolean)
            .map((t) => new Date(t).getTime())
            .filter((n) => Number.isFinite(n));
          const minBaseline = baselineTimes.length ? Math.min(...baselineTimes) : null;
          const minBaselineIso = minBaseline ? new Date(minBaseline).toISOString() : null;

          const unreadQ = supabase
            .from("group_messages")
            .select("group_id,from_id,created_at")
            .in("group_id", groupIds)
            .neq("from_id", ownerId)
            .order("created_at", { ascending: false })
            .limit(unreadLimit);
          if (cutoff) unreadQ.gte("created_at", cutoff);
          if (minBaselineIso) unreadQ.gte("created_at", minBaselineIso);

          const unreadRes = await unreadQ;
          if (unreadRes.error) throw unreadRes.error;

          for (const row of unreadRes.data || []) {
            const gid = row.group_id;
            if (!gid || !threads[gid]) continue;
            const clearedAt = clearedAtByGroup[gid];
            if (clearedAt && new Date(row.created_at).getTime() <= new Date(clearedAt).getTime()) continue;

            const baseline = lastReadByGroup[gid] || joinedAtByGroup[gid] || null;
            if (baseline && new Date(row.created_at).getTime() <= new Date(baseline).getTime()) continue;

            threads[gid] = { ...threads[gid], unread: (threads[gid].unread || 0) + 1 };
          }
        }
      }
    } catch (err) {
      const code = String(err?.code || "");
      const msg = String(err?.message || "").toLowerCase();
      const missing =
        code === "42P01" ||
        msg.includes("group_members") ||
        msg.includes("group_messages") ||
        msg.includes("groups");
      if (!missing) throw err;
    }

    return threads;
  }

  async function createMessage({ from, to, text }) {
    // Keep insert response minimal so old schemas (missing status/file columns) still work.
    const { data, error } = await supabase
      .from("messages")
      .insert({ from_id: from, to_id: to, text })
      .select(MESSAGE_MIN_SELECT)
      .single();

    if (error) throw error;
    return mapMessage(data);
  }

  async function createFileMessage({ from, to, text, file } = {}) {
    const { data, error } = await supabase
      .from("messages")
      .insert({
        from_id: from,
        to_id: to,
        text: text ?? "",
        file_bucket: file?.bucket || null,
        file_path: file?.path || null,
        file_name: file?.name || null,
        file_mime: file?.mime || null,
        file_size: file?.size ?? null,
        file_kind: file?.kind || null
      })
      // Avoid selecting status columns here (keeps uploads working even if status columns weren't migrated yet).
      .select(MESSAGE_MIN_SELECT_WITH_FILE)
      .single();

    if (error) throw error;
    return mapMessage(data);
  }

  async function deleteMessageForMe({ userId, messageId } = {}) {
    const { data: msg, error } = await supabase
      .from("messages")
      .select("id,from_id,to_id")
      .eq("id", messageId)
      .maybeSingle();

    if (error) throw error;
    if (!msg) return { ok: false, notFound: true };
    if (msg.from_id !== userId && msg.to_id !== userId) return { ok: false, notFound: true };

    const now = new Date().toISOString();
    const { error: delErr } = await supabase
      .from("message_deletes")
      .upsert(
        { message_id: messageId, user_id: userId, deleted_at: now },
        { onConflict: "message_id,user_id" }
      );

    if (delErr) throw delErr;
    return { ok: true, deletedAt: now };
  }

  async function deleteMessageForEveryone({ userId, messageId } = {}) {
    const now = new Date().toISOString();

    const res = await supabase
      .from("messages")
      .update({ deleted_for_everyone_at: now, deleted_for_everyone_by: userId, text: "" })
      .eq("id", messageId)
      .eq("from_id", userId)
      .select(MESSAGE_MIN_SELECT_WITH_DELETE)
      .maybeSingle();

    if (res.error) throw res.error;
    if (!res.data) return { ok: false, notFound: true };
    return { ok: true, message: mapMessage(res.data) };
  }

  async function deleteMessagesForMe({ userId, messageIds } = {}) {
    const ids = Array.from(new Set((messageIds || []).filter(Boolean)));
    if (ids.length === 0) return { ok: true, deletedIds: [], deletedAt: null };

    const { data: rows, error } = await supabase.from("messages").select("id,from_id,to_id").in("id", ids);
    if (error) throw error;

    const allowed = (rows || [])
      .filter((r) => r?.id && (r.from_id === userId || r.to_id === userId))
      .map((r) => r.id);

    if (allowed.length === 0) return { ok: true, deletedIds: [], deletedAt: null };

    const now = new Date().toISOString();
    const payload = allowed.map((id) => ({ message_id: id, user_id: userId, deleted_at: now }));

    const { error: delErr } = await supabase
      .from("message_deletes")
      .upsert(payload, { onConflict: "message_id,user_id" });

    if (delErr) throw delErr;
    return { ok: true, deletedIds: allowed, deletedAt: now };
  }

  async function deleteMessagesForEveryone({ userId, messageIds } = {}) {
    const ids = Array.from(new Set((messageIds || []).filter(Boolean)));
    if (ids.length === 0) return { ok: true, messages: [], deletedAt: null };

    const now = new Date().toISOString();
    const res = await supabase
      .from("messages")
      .update({ deleted_for_everyone_at: now, deleted_for_everyone_by: userId, text: "" })
      .in("id", ids)
      .eq("from_id", userId)
      .select(MESSAGE_MIN_SELECT_WITH_DELETE);

    if (res.error) throw res.error;
    const list = (res.data || []).map(mapMessage).filter(Boolean);
    return { ok: true, messages: list, deletedAt: now };
  }

  async function forwardMessage({ userId, messageId, to } = {}) {
    const selects = [
      `id,from_id,to_id,text,created_at,${MESSAGE_DELETE_SELECT},${MESSAGE_FILE_SELECT}`,
      `id,from_id,to_id,text,created_at,${MESSAGE_DELETE_SELECT}`,
      "id,from_id,to_id,text,created_at"
    ];

    let res = null;
    let lastErr = null;
    for (const fields of selects) {
      res = await supabase.from("messages").select(fields).eq("id", messageId).maybeSingle();
      if (!res.error) break;
      lastErr = res.error;
      if (!(isMissingMessageFileColumns(res.error) || isMissingMessageDeleteColumns(res.error))) break;
    }

    if (!res || res.error) throw lastErr || res?.error;
    const row = res.data;
    if (!row) return { ok: false, notFound: true };
    if (row.from_id !== userId && row.to_id !== userId) return { ok: false, notFound: true };
    if (row.deleted_for_everyone_at) return { ok: false, deleted: true };

    const hasFile = Boolean(row.file_path);
    if (hasFile) {
      const msg = await createFileMessage({
        from: userId,
        to,
        text: row.text || "",
        file: {
          bucket: row.file_bucket || null,
          path: row.file_path,
          name: row.file_name || "",
          mime: row.file_mime || "",
          size: row.file_size ?? null,
          kind: row.file_kind || "file"
        }
      });
      return { ok: true, message: msg };
    }

    const msg = await createMessage({ from: userId, to, text: row.text || "" });
    return { ok: true, message: msg };
  }

  async function forwardMessages({ userId, messageIds, to } = {}) {
    const ids = Array.from(new Set((messageIds || []).filter(Boolean)));
    if (ids.length === 0) return { ok: true, messages: [] };

    const selects = [
      `id,from_id,to_id,text,created_at,${MESSAGE_DELETE_SELECT},${MESSAGE_FILE_SELECT}`,
      `id,from_id,to_id,text,created_at,${MESSAGE_DELETE_SELECT}`,
      "id,from_id,to_id,text,created_at"
    ];

    let res = null;
    let lastErr = null;
    for (const fields of selects) {
      res = await supabase.from("messages").select(fields).in("id", ids);
      if (!res.error) break;
      lastErr = res.error;
      if (!(isMissingMessageFileColumns(res.error) || isMissingMessageDeleteColumns(res.error))) break;
    }

    if (!res || res.error) throw lastErr || res?.error;

    const allowed = (res.data || []).filter(
      (row) =>
        row?.id &&
        (row.from_id === userId || row.to_id === userId) &&
        !row.deleted_for_everyone_at
    );

    if (allowed.length === 0) return { ok: true, messages: [] };

    // Preserve the user's selection ordering when possible.
    const order = new Map(ids.map((id, i) => [id, i]));
    allowed.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

    const insertRows = allowed.map((row) => ({
      from_id: userId,
      to_id: to,
      text: row.text || "",
      file_bucket: row.file_bucket || null,
      file_path: row.file_path || null,
      file_name: row.file_name || null,
      file_mime: row.file_mime || null,
      file_size: row.file_size ?? null,
      file_kind: row.file_kind || null
    }));

    const ins = await supabase.from("messages").insert(insertRows).select(MESSAGE_MIN_SELECT_WITH_FILE);
    if (ins.error) throw ins.error;
    const list = (ins.data || []).map(mapMessage).filter(Boolean);
    return { ok: true, messages: list };
  }

  async function listMessagesBetween(a, b, limit = 100, { after } = {}) {
    const cutoff = getMessageCutoffIso();

    async function run(selectFields) {
      const query = supabase
        .from("messages")
        .select(selectFields)
        .or(`and(from_id.eq.${a},to_id.eq.${b}),and(from_id.eq.${b},to_id.eq.${a})`);

      if (cutoff) query.gte("created_at", cutoff);
      if (after) query.gt("created_at", after);

      return query.order("created_at", { ascending: false }).limit(limit);
    }

    const selects = [
      MESSAGE_SELECT_WITH_FILE_AND_DELETE,
      MESSAGE_BASE_SELECT_WITH_DELETE,
      MESSAGE_MIN_SELECT_WITH_FILE_AND_DELETE,
      MESSAGE_MIN_SELECT_WITH_DELETE,
      MESSAGE_SELECT_WITH_FILE,
      MESSAGE_BASE_SELECT,
      MESSAGE_MIN_SELECT_WITH_FILE,
      MESSAGE_MIN_SELECT
    ];
    let res = null;
    let lastErr = null;
    for (const fields of selects) {
      res = await run(fields);
      if (!res.error) break;
      lastErr = res.error;
      if (
        !(
          isMissingMessageFileColumns(res.error) ||
          isMissingMessageStatusColumns(res.error) ||
          isMissingMessageDeleteColumns(res.error)
        )
      )
        break;
    }

    if (!res || res.error) throw lastErr || res?.error;

    const list = (res.data || []).reverse().map(mapMessage).filter(Boolean);
    const ids = list.map((m) => m.id).filter(Boolean);
    if (ids.length === 0) return list;

    const delRes = await supabase
      .from("message_deletes")
      .select("message_id")
      .eq("user_id", a)
      .in("message_id", ids);

    if (delRes.error) {
      const code = String(delRes.error?.code || "");
      if (code === "42P01") return list; // table missing (older schema)
      if (
        isMissingColumnError(delRes.error, "message_id") ||
        isMissingColumnError(delRes.error, "user_id")
      )
        return list;
      throw delRes.error;
    }

    const deletedIds = new Set((delRes.data || []).map((r) => r.message_id).filter(Boolean));
    if (deletedIds.size === 0) return list;
    return list.filter((m) => !deletedIds.has(m.id));
  }

  async function markMessageDelivered({ id, recipientId }) {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("messages")
      .update({ delivered_at: now })
      .eq("id", id)
      .eq("to_id", recipientId)
      .is("delivered_at", null)
      .select(MESSAGE_MIN_SELECT);

    if (error) {
      if (isMissingColumnError(error, "delivered_at")) return null;
      // eslint-disable-next-line no-console
      console.error("markMessageDelivered failed:", error);
      return null;
    }
    if (!data || data.length === 0) return null;
    const msg = mapMessage(data[0]);
    return { ...msg, deliveredAt: now };
  }

  async function markMessagesDelivered({ userId, peerId, after } = {}) {
    const now = new Date().toISOString();
    const cutoff = getMessageCutoffIso();

    const query = supabase
      .from("messages")
      .update({ delivered_at: now })
      .eq("to_id", userId)
      .eq("from_id", peerId)
      .is("delivered_at", null);

    if (cutoff) query.gte("created_at", cutoff);
    if (after) query.gt("created_at", after);

    const res = await query.select(MESSAGE_MIN_SELECT);
    if (res.error) {
      if (isMissingColumnError(res.error, "delivered_at")) return [];
      // eslint-disable-next-line no-console
      console.error("markMessagesDelivered failed:", res.error);
      return [];
    }
    return (res.data || []).map((row) => ({ ...mapMessage(row), deliveredAt: now })).filter(Boolean);
  }

  async function markMessagesRead({ userId, peerId, after } = {}) {
    const now = new Date().toISOString();
    const cutoff = getMessageCutoffIso();

    const query = supabase
      .from("messages")
      .update({ read_at: now })
      .eq("to_id", userId)
      .eq("from_id", peerId)
      .is("read_at", null);

    if (cutoff) query.gte("created_at", cutoff);
    if (after) query.gt("created_at", after);

    const res = await query.select(MESSAGE_MIN_SELECT);
    if (res.error) {
      if (isMissingColumnError(res.error, "read_at")) return [];
      // eslint-disable-next-line no-console
      console.error("markMessagesRead failed:", res.error);
      return [];
    }
    return (res.data || []).map((row) => ({ ...mapMessage(row), readAt: now })).filter(Boolean);
  }

  async function deleteExpiredMessages() {
    const cutoff = getMessageCutoffIso();
    if (!cutoff) return { ok: true, skipped: true };
    const batchSize = 200;
    const maxLoops = 6;
    let deleted = 0;
    let filesDeleted = 0;

    for (let i = 0; i < maxLoops; i += 1) {
      // We select first, then delete by ids. This lets us clean up Storage too.
      let res = await supabase
        .from("messages")
        .select("id,file_bucket,file_path")
        .lt("created_at", cutoff)
        .limit(batchSize);

      if (res.error && isMissingMessageFileColumns(res.error)) {
        res = await supabase.from("messages").select("id").lt("created_at", cutoff).limit(batchSize);
      }

      if (res.error) throw res.error;
      const rows = res.data || [];
      if (rows.length === 0) break;

      const ids = rows.map((r) => r.id).filter(Boolean);
      const byBucket = {};
      for (const row of rows) {
        if (!row?.file_path) continue;
        const bucket = row.file_bucket || storageBucket;
        byBucket[bucket] = byBucket[bucket] || [];
        byBucket[bucket].push(row.file_path);
      }

      for (const [bucket, paths] of Object.entries(byBucket)) {
        const unique = Array.from(new Set(paths));
        await removeAttachments({ bucket, paths: unique });
        filesDeleted += unique.length;
      }

      const delRes = await supabase.from("messages").delete().in("id", ids);
      if (delRes.error) throw delRes.error;
      deleted += ids.length;
    }

    return { ok: true, deleted, filesDeleted };
  }

  async function createCallLog({
    fromId,
    toId,
    media = "audio",
    status = "ringing",
    startedAt = null,
    endedAt = null,
    endedBy = null,
    endReason = null
  } = {}) {
    const safeMedia = media === "video" ? "video" : "audio";
    const safeStatus = typeof status === "string" && status ? status : "ringing";

    const insert = {
      from_id: fromId,
      to_id: toId,
      media: safeMedia,
      status: safeStatus,
      ...(startedAt ? { started_at: startedAt } : {}),
      ...(endedAt ? { ended_at: endedAt } : {}),
      ...(endedBy ? { ended_by: endedBy } : {}),
      ...(endReason ? { end_reason: endReason } : {})
    };

    const res = await supabase.from("call_logs").insert(insert).select(CALL_LOG_SELECT).single();
    if (res.error) throw res.error;
    return mapCallLog(res.data);
  }

  async function markCallConnected({ id } = {}) {
    const now = new Date().toISOString();
    const res = await supabase
      .from("call_logs")
      .update({ status: "connected", started_at: now })
      .eq("id", id)
      .select(CALL_LOG_SELECT)
      .maybeSingle();
    if (res.error) throw res.error;
    return mapCallLog(res.data);
  }

  async function endCallLog({ id, status = "ended", endedBy = null, endReason = null } = {}) {
    const now = new Date().toISOString();
    const patch = {
      status: typeof status === "string" && status ? status : "ended",
      ended_at: now,
      ...(endedBy ? { ended_by: endedBy } : {}),
      ...(endReason ? { end_reason: endReason } : {})
    };

    const res = await supabase.from("call_logs").update(patch).eq("id", id).select(CALL_LOG_SELECT).maybeSingle();
    if (res.error) throw res.error;
    return mapCallLog(res.data);
  }

  async function deleteCallLogForMe({ userId, callLogId } = {}) {
    if (!userId || !callLogId) return { ok: true, skipped: true };

    const check = await supabase
      .from("call_logs")
      .select("id")
      .eq("id", callLogId)
      .or(`from_id.eq.${userId},to_id.eq.${userId}`)
      .maybeSingle();

    if (check.error) throw check.error;
    if (!check.data?.id) return { ok: true, notFound: true };

    const now = new Date().toISOString();

    const res = await supabase
      .from("call_log_deletes")
      .upsert(
        { call_log_id: callLogId, user_id: userId, deleted_at: now },
        { onConflict: "call_log_id,user_id" }
      )
      .select("call_log_id")
      .maybeSingle();

    if (res.error) throw res.error;
    return { ok: true, id: res.data?.call_log_id || callLogId };
  }

  async function clearCallLogsForMe(userId, { limit = 5000 } = {}) {
    if (!userId) return { ok: true, deleted: 0 };
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(20000, Math.floor(limit))) : 5000;

    const res = await supabase
      .from("call_logs")
      .select("id")
      .or(`from_id.eq.${userId},to_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(safeLimit);

    if (res.error) throw res.error;
    const ids = (res.data || []).map((r) => r.id).filter(Boolean);
    if (ids.length === 0) return { ok: true, deleted: 0 };

    const now = new Date().toISOString();
    const chunkSize = 500;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize).map((id) => ({
        call_log_id: id,
        user_id: userId,
        deleted_at: now
      }));

      const up = await supabase.from("call_log_deletes").upsert(chunk, { onConflict: "call_log_id,user_id" });
      if (up.error) throw up.error;
    }

    return { ok: true, deleted: ids.length };
  }

  async function listCallLogs(userId, { limit = 200 } = {}) {
    if (!userId) return [];

    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(1000, Math.floor(limit))) : 200;

    let deletedSet = null;
    try {
      const delRes = await supabase
        .from("call_log_deletes")
        .select("call_log_id")
        .eq("user_id", userId);

      if (delRes.error) throw delRes.error;
      deletedSet = new Set((delRes.data || []).map((r) => r.call_log_id).filter(Boolean));
    } catch (err) {
      if (!isMissingTableError(err, "call_log_deletes")) throw err;
      deletedSet = new Set();
    }

    const res = await supabase
      .from("call_logs")
      .select(CALL_LOG_SELECT)
      .or(`from_id.eq.${userId},to_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(safeLimit);

    if (res.error) throw res.error;

    const base = (res.data || [])
      .filter((r) => r?.id && !deletedSet.has(r.id))
      .map(mapCallLog)
      .filter(Boolean);

    const peerIdSet = new Set();
    for (const c of base) {
      const peerId = c.from === userId ? c.to : c.from;
      if (peerId) peerIdSet.add(peerId);
    }

    const peerIds = Array.from(peerIdSet);
    const peersById = {};

    if (peerIds.length > 0) {
      const pRes = await supabase.from("profiles").select("*").in("id", peerIds);
      if (pRes.error) throw pRes.error;

      const profiles = (pRes.data || []).map(mapProfile).filter(Boolean);
      const withUrls = await Promise.all(profiles.map(withAvatarUrl));
      for (const p of withUrls) {
        if (!p?.id) continue;
        peersById[p.id] = p;
      }
    }

    return base.map((c) => {
      const direction = c.from === userId ? "outgoing" : "incoming";
      const peerId = direction === "outgoing" ? c.to : c.from;
      return { ...c, direction, peer: peersById[peerId] || null };
    });
  }

  return {
    getUserById,
    getUserByEmail,
    getUserAuthById,
    getUserAuthByEmail,
    createUser,
    setUserEmailVerified,
    updateUserName,
    updateUserBio,
    updateUserProfile,
    updateUserAvatar,
    setUserPasswordHash,
    getLatestEmailOtp,
    createEmailOtp,
    getValidEmailOtp,
    consumeEmailOtpById,
    consumeEmailOtp,
    addContact,
    getChatClearAt,
    clearChat,
    listContacts,
    listThreads,
    listGroupIdsForUser,
    isUserGroupMember,
    listGroupMemberIds,
    listGroups,
    createGroup,
    clearGroupChat,
    markGroupRead,
    listGroupMessages,
    createGroupMessage,
    createGroupFileMessage,
    deleteGroupMessagesForMe,
    deleteGroupMessagesForEveryone,
    createMessage,
    createFileMessage,
    deleteMessageForMe,
    deleteMessagesForMe,
    deleteMessageForEveryone,
    deleteMessagesForEveryone,
    forwardMessage,
    forwardMessages,
    uploadAttachment,
    createAttachmentSignedUrl,
    removeAttachments,
    markMessageDelivered,
    markMessagesDelivered,
    markMessagesRead,
    listMessagesBetween,
    deleteExpiredMessages,
    createCallLog,
    markCallConnected,
    endCallLog,
    listCallLogs,
    deleteCallLogForMe,
    clearCallLogsForMe
  };
}

module.exports = { createSupabaseStore };
