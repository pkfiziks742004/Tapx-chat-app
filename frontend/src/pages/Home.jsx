import { useEffect, useRef, useState } from "react";
import { api } from "../api/api.js";
import { useSocket } from "../hooks/useSocket.js";
import NavRail from "../components/NavRail.jsx";
import Sidebar from "../components/Sidebar.jsx";
import CallsSidebar from "../components/CallsSidebar.jsx";
import GroupsSidebar from "../components/GroupsSidebar.jsx";
import ContactsSidebar from "../components/ContactsSidebar.jsx";
import ChatBox from "../components/ChatBox.jsx";
import CallsPanel from "../components/CallsPanel.jsx";
import GroupsPanel from "../components/GroupsPanel.jsx";
import AppTopbar from "../components/AppTopbar.jsx";
import InfoPanel from "../components/InfoPanel.jsx";
import WorkspaceSidebar from "../components/WorkspaceSidebar.jsx";
import ProfileWorkspace from "../components/ProfileWorkspace.jsx";
import SettingsWorkspace from "../components/SettingsWorkspace.jsx";
import Avatar from "../components/Avatar.jsx";
import AvatarCropModal from "../components/AvatarCropModal.jsx";
import CallModal from "../components/CallModal.jsx";
import {
  IconCamera,
  IconCameraOff,
  IconMic,
  IconMicOff,
  IconPhone,
  IconPhoneEnd,
  IconSpeaker,
  IconSpeakerOff,
  IconVideo,
  IconX
} from "../components/Icons.jsx";
import {
  startOutgoingRingTone,
  stopOutgoingRingTone,
  startIncomingRingTone,
  stopIncomingRingTone,
  playCallConnected,
  playCallEnded,
  playMessagePop
} from "../lib/soundEffects.js";

const SETTINGS_STORAGE_KEY = "chatapp.settings.v1";
const FAVORITES_STORAGE_KEY = "chatapp.favorites.v1";

const DEFAULT_SETTINGS = {
  theme: "dark",
  wallpaper: "doodles",
  messageSounds: true,
  reduceMotion: false,
  readReceipts: true,
  presenceSharing: true
};

const DOODLES_SVG = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420" viewBox="0 0 420 420">
  <g fill="none" stroke="white" stroke-opacity="0.08" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M64 92a26 26 0 0 1 26-26h64a26 26 0 0 1 26 26v18a26 26 0 0 1-26 26H108l-30 16 10-22a26 26 0 0 1-24-25V92z"/>
    <circle cx="320" cy="86" r="22"/>
    <path d="M308 82h24M320 70v32"/>
    <path d="M260 160l30-18-10 34 26 14-36 2-10 34-14-30-36 2 26-14-14-30 32 6z"/>
    <path d="M74 250l34-18 22 30-34 18-22-30z"/>
    <path d="M126 292c0-16 14-28 30-28 12 0 22 6 26 16 4-10 14-16 26-16 16 0 30 12 30 28 0 26-28 44-56 62-28-18-56-36-56-62z"/>
    <path d="M310 260c10 0 18 8 18 18s-8 18-18 18-18-8-18-18 8-18 18-18z"/>
    <path d="M292 308l36 0"/>
    <path d="M220 84l18 18-18 18-18-18 18-18z"/>
    <path d="M210 330l40-18-10 36 30 16-40 2-10 36-16-32-40 2 30-16-16-32 32 6z"/>
    <path d="M332 180a18 18 0 0 1 18 18v24a18 18 0 0 1-18 18h-28l-18 10 6-14a18 18 0 0 1-12-17v-21a18 18 0 0 1 18-18h34z"/>
  </g>
</svg>
`);
const DOODLES_BG = `url("data:image/svg+xml,${DOODLES_SVG}") repeat`;

const WALLPAPER_PRESETS = {
  default: "rgba(0, 0, 0, 0.08)",
  doodles: `${DOODLES_BG}, rgba(0, 0, 0, 0.08)`,
  solid: "rgba(255, 255, 255, 0.03)"
};

const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:stun.services.mozilla.com" }
  ],
  iceCandidatePoolSize: 10
};

function loadStoredSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...(parsed || {}) };
  } catch (_e) {
    return { ...DEFAULT_SETTINGS };
  }
}

function loadStoredFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (_e) {
    return [];
  }
}

function getTimeMs(value) {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function ProfileModal({ token, me, onUpdated, onClose, canClose = true }) {
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const fileRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [cropFile, setCropFile] = useState(null);

  useEffect(() => {
    setName(me?.name || "");
    setBio(me?.bio || "");
  }, [me]);

  async function save() {
    setError("");
    setLoading(true);
    try {
      const clean = name.trim();
      if (!clean) throw new Error("Name is required.");
      const cleanBio = bio.trim();
      const { user } = await api.updateMe(token, clean, cleanBio);
      onUpdated(user);
      if (canClose) onClose?.();
    } catch (e) {
      setError(e.message || "Could not save.");
    } finally {
      setLoading(false);
    }
  }

  async function onAvatarPicked(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError("");
    setCropFile(file);
  }

  return (
    <>
      <div className="modalOverlay" onMouseDown={canClose ? onClose : undefined} role="presentation">
        <div className="modal" onMouseDown={(e) => e.stopPropagation()} role="presentation">
          <div className="modalTitle">{me?.name ? "Edit profile" : "Set up your profile"}</div>

          <div className="profileRow">
            <Avatar name={name || me?.email || "Me"} url={me?.avatarUrl} size={64} />
            <div className="profileActions">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={onAvatarPicked}
              />
              <button className="btn" type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? "Uploading…" : "Change photo"}
              </button>
            </div>
          </div>

          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </label>
          <label className="field">
            <span>Bio</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="About you"
              rows={3}
              maxLength={160}
            />
          </label>
          {error && <div className="error">{error}</div>}
          <div className="modalActions">
            {canClose && (
              <button className="btn" onClick={onClose} disabled={loading || uploading} type="button">
                Cancel
              </button>
            )}
            <button className="btn primary" onClick={save} disabled={loading || uploading} type="button">
              {loading ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>

      {cropFile && (
        <AvatarCropModal
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onCropped={(cropped) => {
            setCropFile(null);
            setError("");
            setUploading(true);
            api
              .uploadAvatar(token, cropped)
              .then((res) => {
                if (res?.user) onUpdated(res.user);
              })
              .catch((err) => setError(err?.message || "Could not upload avatar."))
              .finally(() => setUploading(false));
          }}
        />
      )}
    </>
  );
}

function SettingsModal({
  me,
  myEmail,
  settings,
  onChange,
  onEditProfile,
  onLogout,
  onClose
}) {
  const [tab, setTab] = useState("account");

  function update(patch) {
    onChange?.({ ...(settings || DEFAULT_SETTINGS), ...(patch || {}) });
  }

  const theme = settings?.theme || "dark";
  const wallpaper = settings?.wallpaper || "default";
  const messageSounds = settings?.messageSounds !== false;
  const reduceMotion = Boolean(settings?.reduceMotion);

  return (
    <div className="modalOverlay" onMouseDown={onClose} role="presentation">
      <div className="modal settingsModal" onMouseDown={(e) => e.stopPropagation()} role="presentation">
        <div className="settingsHeader">
          <div className="modalTitle">Settings</div>
          <button className="btn icon" type="button" onClick={onClose} aria-label="Close settings" title="Close">
            <IconX className="btnSvg" />
          </button>
        </div>

        <div className="settingsGrid">
          <nav className="settingsNav" aria-label="Settings sections">
            <button
              className={tab === "account" ? "settingsNavBtn active" : "settingsNavBtn"}
              type="button"
              onClick={() => setTab("account")}
            >
              Account
            </button>
            <button
              className={tab === "chats" ? "settingsNavBtn active" : "settingsNavBtn"}
              type="button"
              onClick={() => setTab("chats")}
            >
              Chats
            </button>
            <button
              className={tab === "notifications" ? "settingsNavBtn active" : "settingsNavBtn"}
              type="button"
              onClick={() => setTab("notifications")}
            >
              Notifications
            </button>
            <button
              className={tab === "privacy" ? "settingsNavBtn active" : "settingsNavBtn"}
              type="button"
              onClick={() => setTab("privacy")}
            >
              Privacy
            </button>
            <button
              className={tab === "help" ? "settingsNavBtn active" : "settingsNavBtn"}
              type="button"
              onClick={() => setTab("help")}
            >
              Help
            </button>
          </nav>

          <section className="settingsPanel">
            {tab === "account" && (
              <>
                <div className="settingsCard">
                  <div className="settingsCardTitle">Profile</div>
                  <div className="settingsProfileRow">
                    <Avatar name={me?.name || myEmail} url={me?.avatarUrl} size={52} />
                    <div className="settingsProfileText">
                      <div className="settingsProfileName">{me?.name || "No name"}</div>
                      <div className="settingsProfileSub">{myEmail}</div>
                      {String(me?.bio || "").trim() && <div className="settingsProfileBio">{me?.bio}</div>}
                    </div>
                  </div>
                  <div className="settingsActions">
                    <button className="btn" type="button" onClick={onEditProfile}>
                      Edit profile
                    </button>
                  </div>
                </div>

                <div className="settingsCard">
                  <div className="settingsCardTitle">Security</div>
                  <div className="small">
                    Your login/session is secured via JWT (server-side). Supabase keys are never exposed to the client.
                  </div>
                </div>

                <div className="settingsCard">
                  <div className="settingsCardTitle">Account</div>
                  <div className="settingsActions">
                    <button className="btn danger" type="button" onClick={onLogout}>
                      Logout
                    </button>
                  </div>
                </div>
              </>
            )}

            {tab === "chats" && (
              <>
                <div className="settingsCard">
                  <div className="settingsCardTitle">Appearance</div>

                  <label className="settingsRow">
                    <div className="settingsRowText">
                      <div className="settingsRowTitle">Theme</div>
                      <div className="settingsRowSub">System / Dark / Light</div>
                    </div>
                    <select value={theme} onChange={(e) => update({ theme: e.target.value })}>
                      <option value="system">System</option>
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                    </select>
                  </label>

                  <label className="settingsRow">
                    <div className="settingsRowText">
                      <div className="settingsRowTitle">Chat wallpaper</div>
                      <div className="settingsRowSub">Change chat background</div>
                    </div>
                    <select value={wallpaper} onChange={(e) => update({ wallpaper: e.target.value })}>
                      <option value="default">Default</option>
                      <option value="doodles">Doodles</option>
                      <option value="solid">Solid</option>
                    </select>
                  </label>

                  <label className="settingsToggle">
                    <div className="settingsRowText">
                      <div className="settingsRowTitle">Reduce motion</div>
                      <div className="settingsRowSub">Less animations (better on low-end phones)</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={reduceMotion}
                      onChange={(e) => update({ reduceMotion: e.target.checked })}
                    />
                  </label>
                </div>
              </>
            )}

            {tab === "notifications" && (
              <>
                <div className="settingsCard">
                  <div className="settingsCardTitle">Message notifications</div>
                  <label className="settingsToggle">
                    <div className="settingsRowText">
                      <div className="settingsRowTitle">Message sounds</div>
                      <div className="settingsRowSub">Play a short sound for new messages</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={messageSounds}
                      onChange={(e) => update({ messageSounds: e.target.checked })}
                    />
                  </label>
                  <div className="small">Desktop notifications and custom ringtones: coming soon.</div>
                </div>
              </>
            )}

            {tab === "privacy" && (
              <>
                <div className="settingsCard">
                  <div className="settingsCardTitle">Privacy</div>
                  <div className="small">
                    Read receipts, online status, blocking and per-chat privacy controls: coming soon.
                  </div>
                </div>
              </>
            )}

            {tab === "help" && (
              <>
                <div className="settingsCard">
                  <div className="settingsCardTitle">Help</div>
                  <div className="small">
                    Tips:
                    <ul className="settingsList">
                      <li>Right-click (desktop) or long-press (mobile) a message to select it.</li>
                      <li>Select multiple messages to copy, forward or delete.</li>
                      <li>For calls across networks, you may need a TURN server.</li>
                    </ul>
                  </div>
                </div>

                <div className="settingsCard">
                  <div className="settingsCardTitle">About</div>
                  <div className="small">Tapx - Real-time chat &amp; calls - Socket.IO + WebRTC - Supabase Postgres</div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function AddContactModal({ token, onClose, onAdded }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function add() {
    setError("");
    setLoading(true);
    try {
      const clean = email.trim().toLowerCase();
      if (!clean) throw new Error("Email is required.");
      const { contact } = await api.addContact(token, clean);
      onAdded(contact);
      onClose();
    } catch (e) {
      setError(e.message || "Could not add contact.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modalOverlay" onMouseDown={onClose} role="presentation">
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} role="presentation">
        <div className="modalTitle">Add by email</div>
        <label className="field">
          <span>Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="friend@example.com" />
        </label>
        {error && <div className="error">{error}</div>}
        <div className="modalActions">
          <button className="btn" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="btn primary" onClick={add} disabled={loading} type="button">
            {loading ? "Adding…" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddGroupModal({ token, contacts = [], onClose, onCreated }) {
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const filtered = (contacts || []).filter((c) => {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return true;
    return (c.name || "").toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q);
  });

  function toggle(id) {
    if (!id) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function create() {
    setError("");
    setLoading(true);
    try {
      const clean = name.trim();
      if (!clean) throw new Error("Group name is required.");
      const memberIds = Array.from(selectedIds);
      if (memberIds.length === 0) throw new Error("Pick at least 1 member.");

      const { group } = await api.createGroup(token, clean, memberIds);
      onCreated?.(group);
      onClose();
    } catch (e) {
      setError(e.message || "Could not create group.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modalOverlay" onMouseDown={onClose} role="presentation">
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} role="presentation">
        <div className="modalTitle">Create group</div>

        <label className="field">
          <span>Group name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My group" maxLength={48} />
        </label>

        <label className="field">
          <span>Add members</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search contacts…" />
        </label>

        <div className="forwardList">
          {filtered.length === 0 ? (
            <div className="small">No contacts found.</div>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                className={selectedIds.has(c.id) ? "forwardItem active" : "forwardItem"}
                type="button"
                onClick={() => toggle(c.id)}
                disabled={loading}
              >
                <div className="forwardName">{c.name || c.email}</div>
                <div className="forwardEmail">{c.email}</div>
              </button>
            ))
          )}
        </div>

        {error && <div className="error">{error}</div>}

        <div className="modalActions">
          <button className="btn" onClick={onClose} disabled={loading} type="button">
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={create}
            disabled={loading || !name.trim() || selectedIds.size === 0}
            type="button"
          >
            {loading ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  loading = false,
  error = "",
  onConfirm,
  onCancel,
  danger = false
}) {
  return (
    <div className="modalOverlay" onMouseDown={onCancel} role="presentation">
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} role="presentation">
        <div className="modalTitle">{title}</div>
        {description && <div className="small">{description}</div>}
        {error && <div className="error">{error}</div>}
        <div className="modalActions">
          <button className="btn" onClick={onCancel} disabled={loading} type="button">
            {cancelText}
          </button>
          <button className={danger ? "btn danger" : "btn primary"} onClick={onConfirm} disabled={loading} type="button">
            {loading ? "Working…" : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageDeleteModal({
  count = 1,
  canDeleteEveryone = false,
  loading = false,
  error = "",
  onCancel,
  onDeleteForMe,
  onDeleteForEveryone
}) {
  const title = count > 1 ? "Delete messages" : "Delete message";
  const sub =
    count > 1 ? `Choose how you want to delete ${count} messages.` : "Choose how you want to delete this message.";

  return (
    <div className="modalOverlay" onMouseDown={onCancel} role="presentation">
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} role="presentation">
        <div className="modalTitle">{title}</div>
        <div className="small">{sub}</div>
        {error && <div className="error">{error}</div>}
        <div className="modalActions">
          <button className="btn" onClick={onCancel} disabled={loading} type="button">
            Cancel
          </button>
          <button className="btn" onClick={onDeleteForMe} disabled={loading} type="button">
            Delete for me
          </button>
          {canDeleteEveryone && (
            <button className="btn danger" onClick={onDeleteForEveryone} disabled={loading} type="button">
              Delete for everyone
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ForwardMessageModal({
  count = 1,
  contacts = [],
  selectedId = "",
  loading = false,
  error = "",
  onSelect,
  onCancel,
  onForward
}) {
  const title = count > 1 ? "Forward messages" : "Forward message";
  const sub = count > 1 ? `Choose a contact to forward ${count} messages to.` : "Choose a contact to forward to.";

  return (
    <div className="modalOverlay" onMouseDown={onCancel} role="presentation">
      <div className="modal" onMouseDown={(e) => e.stopPropagation()} role="presentation">
        <div className="modalTitle">{title}</div>
        <div className="small">{sub}</div>
        {error && <div className="error">{error}</div>}

        <div className="forwardList">
          {contacts.length === 0 ? (
            <div className="small">No contacts found.</div>
          ) : (
            contacts.map((c) => (
              <button
                key={c.id}
                className={selectedId === c.id ? "forwardItem active" : "forwardItem"}
                type="button"
                onClick={() => onSelect?.(c.id)}
                disabled={loading}
              >
                <div className="forwardName">{c.name || c.email}</div>
                <div className="forwardEmail">{c.email}</div>
              </button>
            ))
          )}
        </div>

        <div className="modalActions">
          <button className="btn" onClick={onCancel} disabled={loading} type="button">
            Cancel
          </button>
          <button className="btn primary" onClick={onForward} disabled={loading || !selectedId} type="button">
            {loading ? "Forwarding…" : "Forward"}
          </button>
        </div>
      </div>
    </div>
  );
}

function previewTextForMessage(msg) {
  if (!msg) return "";
  if (msg.deletedForEveryoneAt) return "Message deleted";
  const t = String(msg.text || "").trim();
  if (t) return t;
  const kind = msg.file?.kind;
  if (kind === "missed_call") return msg.file?.name === "video" ? "📹 Missed video call" : "📞 Missed voice call";
  if (kind === "call") return msg.file?.name === "video" ? "📹 Video call" : "📞 Voice call";
  if (kind === "image") return "Photo";
  if (kind === "video") return "Video";
  if (kind === "audio") return "Voice message";
  if (msg.file?.name) return msg.file.name;
  if (kind) return "File";
  return "";
}

function isAuthError(err) {
  const message = String(err?.message || "").toLowerCase();
  return (
    Number(err?.status || 0) === 401 ||
    message.includes("invalid access token") ||
    message.includes("unauthorized") ||
    message.includes("jwt")
  );
}

export default function Home({ session, onLogout }) {
  const token = session.access_token;
  const myId = session.user.id;
  const myEmail = session.user.email;

  const { socket, connected: socketConnected } = useSocket(token);

  const [me, setMe] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const selectedMessageIdSet = new Set(selectedMessageIds);
  const selectedMessages = selectedMessageIds.length
    ? messages.filter((m) => selectedMessageIdSet.has(m.id))
    : [];
  const selectedCount = selectedMessageIds.length;
  const selectedMessage = selectedCount === 1 ? selectedMessages[0] : null;
  const selectedHasDeleted = selectedMessages.some((m) => m.deletedForEveryoneAt);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [sendError, setSendError] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [threads, setThreads] = useState({}); // { [userId]: { unread, lastText, lastAt } }
  const [syncError, setSyncError] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(() => loadStoredSettings());
  const [chatFilter, setChatFilter] = useState("all");
  const [favoriteIds, setFavoriteIds] = useState(() => loadStoredFavorites());
  const [showAddContact, setShowAddContact] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showClearChat, setShowClearChat] = useState(false);
  const [clearingChat, setClearingChat] = useState(false);
  const [clearChatError, setClearChatError] = useState("");
  const [showDeleteMessage, setShowDeleteMessage] = useState(false);
  const [deletingMessage, setDeletingMessage] = useState(false);
  const [deleteMessageError, setDeleteMessageError] = useState("");
  const [showForwardMessage, setShowForwardMessage] = useState(false);
  const [forwardToId, setForwardToId] = useState("");
  const [forwardingMessage, setForwardingMessage] = useState(false);
  const [forwardMessageError, setForwardMessageError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const toastTimerRef = useRef(null);

  const showToast = (msg) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage("");
    }, 2500);
  };
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width: 768px)").matches);
  const [typingById, setTypingById] = useState({}); // { [userId]: true }
  const [primaryView, setPrimaryView] = useState("chats"); // chats | groups | calls | profile | settings
  const [callLogs, setCallLogs] = useState([]);
  const [loadingCalls, setLoadingCalls] = useState(false);
  const [callsError, setCallsError] = useState("");

  const [call, setCall] = useState({ active: false, peerId: null, status: "", startedAt: null, media: "video" });
  const [speakerOn, setSpeakerOn] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [remoteVideoOn, setRemoteVideoOn] = useState(true);
  const [audioUnlockNeeded, setAudioUnlockNeeded] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [incomingUpgradePrompt, setIncomingUpgradePrompt] = useState(false);
  const [upgradeNotice, setUpgradeNotice] = useState("");
  const screenStreamRef = useRef(null);

  const selectedRef = useRef(null);
  const contactsRef = useRef([]);
  const groupsRef = useRef([]);
  const callActiveRef = useRef(false);
  const readThrottleRef = useRef(0);
  const groupReadThrottleRef = useRef(0);
  const loadSeqRef = useRef(0);
  const refreshInFlightRef = useRef(null);
  const refreshLastRef = useRef(0);
  const subscribedGroupsRef = useRef(new Set());
  const schemaBlockedRef = useRef(false);
  const sendInFlightRef = useRef(false);
  const lastSendAtRef = useRef(0);
  const typingTimersRef = useRef({});
  const typingSelfTimerRef = useRef(null);
  const typingSelfToRef = useRef(null);
  const typingSelfActiveRef = useRef(false);
  const lastTypingEmitRef = useRef(0);
  const messagesWrapRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const pendingOfferRef = useRef(null);
  const pcRef = useRef(null);
  const iceCandidatesQueueRef = useRef([]);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const remoteVideoTrackRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const persistentAudioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const settingsRef = useRef(settings);
  const callsLoadSeqRef = useRef(0);
  const callsRefreshLastRef = useRef(0);
  const deletedCallLogIdsRef = useRef(new Set());
  const desktopAutoOpenedRef = useRef(false);

  function handleAuthError(err) {
    if (!isAuthError(err)) return false;
    onLogout?.();
    return true;
  }

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings || DEFAULT_SETTINGS));
    } catch (_e) {}
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteIds || []));
    } catch (_e) {}
  }, [favoriteIds]);

  useEffect(() => {
    const pref = settings?.theme || "dark";
    if (pref !== "system") {
      document.body.dataset.theme = pref === "light" ? "light" : "dark";
      return;
    }

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.body.dataset.theme = mq.matches ? "dark" : "light";
    };

    apply();

    if (mq.addEventListener) mq.addEventListener("change", apply);
    else mq.addListener(apply);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", apply);
      else mq.removeListener(apply);
    };
  }, [settings?.theme]);

  useEffect(() => {
    const preset = settings?.wallpaper || "default";
    const value = WALLPAPER_PRESETS[preset] || WALLPAPER_PRESETS.default;
    document.body.style.setProperty("--chat-wallpaper", value);
  }, [settings?.wallpaper]);

  useEffect(() => {
    const reduce = Boolean(settings?.reduceMotion);
    document.body.dataset.reduceMotion = reduce ? "1" : "0";
  }, [settings?.reduceMotion]);

  useEffect(() => {
    document.body.dataset.view = primaryView;
    document.documentElement.dataset.view = primaryView;
    return () => {
      delete document.body.dataset.view;
      delete document.documentElement.dataset.view;
    };
  }, [primaryView]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    setSelectedMessageIds([]);
    setShowDeleteMessage(false);
    setDeleteMessageError("");
    setShowForwardMessage(false);
    setForwardToId("");
    setForwardMessageError("");
  }, [selected?.id]);

  useEffect(() => {
    if (selectedMessageIds.length === 0) return;
    const existing = new Set(messages.map((m) => m.id));
    const next = selectedMessageIds.filter((id) => existing.has(id));
    if (next.length !== selectedMessageIds.length) setSelectedMessageIds(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  useEffect(() => {
    contactsRef.current = contacts;
  }, [contacts]);
  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);

  useEffect(() => {
    if (desktopAutoOpenedRef.current) return;
    if (isMobile || primaryView !== "chats" || selected) return;

    const firstContact = contacts?.[0] ? { ...contacts[0], kind: "user" } : null;
    const firstGroup = groups?.[0] ? { ...groups[0], kind: "group" } : null;
    const next = firstContact || firstGroup;
    if (!next?.id) return;

    desktopAutoOpenedRef.current = true;
    selectContact(next);
  }, [isMobile, primaryView, selected, contacts, groups]);

  useEffect(() => {
    if (!socket) return;
    for (const g of groups || []) {
      const id = g?.id;
      if (!id) continue;
      if (subscribedGroupsRef.current.has(id)) continue;
      subscribedGroupsRef.current.add(id);
      try {
        socket.emit("group:subscribe", { groupId: id });
      } catch (_e) {}
    }
  }, [socket, groups]);
  useEffect(() => {
    callActiveRef.current = call.active;
  }, [call.active]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const onChange = (e) => setIsMobile(Boolean(e.matches));
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  async function refresh({ force = false } = {}) {
    const now = Date.now();
    const throttleMs = 1200;

    // If the DB schema is broken (missing columns / old FK constraints), keep the UI stable
    // and stop hammering the API every few seconds until it's fixed.
    if (schemaBlockedRef.current && !force) return Promise.resolve();

    if (!force) {
      if (refreshInFlightRef.current) return refreshInFlightRef.current;
      if (now - refreshLastRef.current < throttleMs) return Promise.resolve();
    }

    refreshLastRef.current = now;
    const p = Promise.allSettled([api.getMe(token), api.listContacts(token), api.listGroups(token), api.listThreads(token)])
      .then((results) => {
        const [meRes, contactsRes, groupsRes, threadsRes] = results;

        const errors = [];
        if (meRes.status === "fulfilled") setMe(meRes.value.user);
        else errors.push(meRes.reason);

        if (contactsRes.status === "fulfilled")
          setContacts((contactsRes.value.contacts || []).map((c) => ({ ...c, kind: "user" })));
        else errors.push(contactsRes.reason);

        if (groupsRes.status === "fulfilled")
          setGroups((groupsRes.value.groups || []).map((g) => ({ ...g, kind: "group" })));
        else errors.push(groupsRes.reason);

        if (threadsRes.status === "fulfilled") {
          const incoming = threadsRes.value.threads || {};
          setThreads((prev) => {
            const activeId = selectedRef.current?.id || null;
            const next = { ...(prev || {}) };
            const allIds = new Set([...Object.keys(next), ...Object.keys(incoming)]);
            for (const id of allIds) {
              const a = next[id] || {};
              const b = incoming[id] || {};

              const aMs = getTimeMs(a.lastAt);
              const bMs = getTimeMs(b.lastAt);
              const useB = bMs >= aMs;

              next[id] = {
                ...(useB ? a : b),
                ...(useB ? b : a),
                unread:
                  activeId && id === activeId
                    ? 0
                    : Math.max(Number(a.unread || 0) || 0, Number(b.unread || 0) || 0),
                lastText: useB ? b.lastText || a.lastText || "" : a.lastText || b.lastText || "",
                lastAt: useB ? b.lastAt || a.lastAt || null : a.lastAt || b.lastAt || null
              };
            }
            return next;
          });
        }
        else errors.push(threadsRes.reason);

        if (errors.length === 0 || socketConnected) {
          setSyncError("");
          schemaBlockedRef.current = false;
          if (errors.length === 0) return;
        }

        const first = errors[0];
        if (handleAuthError(first)) return;
        if (first?.code === "db_schema_error") {
          setSyncError("Database schema mismatch. Run supabase/schema.sql in Supabase, then restart the server.");
          schemaBlockedRef.current = true;
          return;
        }
        if (!socketConnected) {
          setSyncError(first?.message || "Connecting to server...");
        }
      })
      .finally(() => {
        refreshInFlightRef.current = null;
      });

    refreshInFlightRef.current = p;
    return p;
  }

  async function loadCallLogs({ force = false } = {}) {
    const now = Date.now();
    const throttleMs = 1200;

    if (schemaBlockedRef.current && !force) return;

    if (!force && now - callsRefreshLastRef.current < throttleMs) return;
    callsRefreshLastRef.current = now;

    const seq = ++callsLoadSeqRef.current;
    setLoadingCalls(true);
    setCallsError("");
    try {
      const res = await api.listCalls(token, { limit: 200 });
      const list = Array.isArray(res?.calls) ? res.calls : [];
      if (seq !== callsLoadSeqRef.current) return;
      setCallLogs(list);
    } catch (e) {
      if (seq !== callsLoadSeqRef.current) return;
      if (handleAuthError(e)) return;
      setCallsError(e?.message || "Could not load calls.");
    } finally {
      if (seq !== callsLoadSeqRef.current) return;
      setLoadingCalls(false);
    }
  }

  async function loadMessages(withId, { silent = false } = {}) {
    const seq = ++loadSeqRef.current;
    if (!silent) setLoadingMessages(true);
    if (!silent) setLoadError("");
    try {
      const res = await api.listMessagesWith(token, withId);
      const list = res.messages || [];
      if (seq !== loadSeqRef.current) return;
      setLoadError("");
      setMessages(list);

      const last = list.length > 0 ? list[list.length - 1] : null;
      if (last?.createdAt) {
        setThreads((prev) => ({
          ...prev,
          [withId]: {
            unread: prev?.[withId]?.unread || 0,
            lastText: previewTextForMessage(last) || prev?.[withId]?.lastText || "",
            lastAt: last.createdAt
          }
        }));
      }
    } catch (e) {
      if (seq !== loadSeqRef.current) return;
      if (handleAuthError(e)) return;
      setLoadError(e?.message || "Could not load messages.");
    } finally {
      if (seq !== loadSeqRef.current) return;
      if (!silent) setLoadingMessages(false);
    }
  }

  async function loadGroupMessages(groupId, { silent = false } = {}) {
    const seq = ++loadSeqRef.current;
    if (!silent) setLoadingMessages(true);
    if (!silent) setLoadError("");
    try {
      const res = await api.listGroupMessages(token, groupId);
      const list = res.messages || [];
      if (seq !== loadSeqRef.current) return;
      setLoadError("");
      setMessages(list);

      const last = list.length > 0 ? list[list.length - 1] : null;
      if (last?.createdAt) {
        setThreads((prev) => ({
          ...prev,
          [groupId]: {
            ...(prev?.[groupId] || {}),
            unread: prev?.[groupId]?.unread || 0,
            lastText: previewTextForMessage(last) || prev?.[groupId]?.lastText || "",
            lastAt: last.createdAt
          }
        }));
      }
    } catch (e) {
      if (seq !== loadSeqRef.current) return;
      if (handleAuthError(e)) return;
      setLoadError(e?.message || "Could not load messages.");
    } finally {
      if (seq !== loadSeqRef.current) return;
      if (!silent) setLoadingMessages(false);
    }
  }

  async function markThreadRead(peerId) {
    if (!peerId) return;
    if (peerId === myId) return;

    const now = Date.now();
    if (now - readThrottleRef.current < 800) return;
    readThrottleRef.current = now;

    setThreads((prev) => ({
      ...prev,
      [peerId]: {
        ...(prev?.[peerId] || {}),
        unread: 0
      }
    }));

    try {
      socket.emit("message:read", { with: peerId });
    } catch (_e) {}

    try {
      await api.markRead(token, peerId);
    } catch (_e) {}
  }

  async function markGroupRead(groupId) {
    if (!groupId) return;

    const now = Date.now();
    if (now - groupReadThrottleRef.current < 800) return;
    groupReadThrottleRef.current = now;

    setThreads((prev) => ({
      ...prev,
      [groupId]: {
        ...(prev?.[groupId] || {}),
        unread: 0
      }
    }));

    try {
      await api.markGroupRead(token, groupId);
    } catch (_e) {}
  }

  function stopTyping(toId = null) {
    const target = toId || typingSelfToRef.current;
    if (!target) return;

    if (typingSelfTimerRef.current) {
      clearTimeout(typingSelfTimerRef.current);
      typingSelfTimerRef.current = null;
    }

    if (typingSelfActiveRef.current) {
      try {
        socket.emit("typing", { to: target, typing: false });
      } catch (_e) {}
    }

    typingSelfActiveRef.current = false;
    typingSelfToRef.current = null;
    lastTypingEmitRef.current = 0;
  }

  function onComposerTyping(value) {
    const active = selectedRef.current;
    if (!active?.id) return;
    if (active.kind === "group") return;
    const toId = active.id;

    const text = String(value || "");
    const hasText = text.trim().length > 0;
    if (!hasText) return stopTyping(toId);

    typingSelfToRef.current = toId;

    const now = Date.now();
    if (!typingSelfActiveRef.current || now - lastTypingEmitRef.current > 900) {
      try {
        socket.emit("typing", { to: toId, typing: true });
      } catch (_e) {}
      typingSelfActiveRef.current = true;
      lastTypingEmitRef.current = now;
    }

    if (typingSelfTimerRef.current) clearTimeout(typingSelfTimerRef.current);
    typingSelfTimerRef.current = setTimeout(() => stopTyping(toId), 1400);
  }

  function normalizeCallLog(raw) {
    if (!raw?.id) return null;
    const base = { ...raw };

    const direction =
      base.direction === "outgoing" || base.direction === "incoming"
        ? base.direction
        : base.from === myId
          ? "outgoing"
          : "incoming";

    const peerId = direction === "outgoing" ? base.to : base.from;
    const peer =
      base.peer ||
      contactsRef.current?.find?.((c) => c?.id === peerId) ||
      null;

    return { ...base, direction, peer };
  }

  function upsertCallLog(raw) {
    const next = normalizeCallLog(raw);
    if (!next) return;
    if (deletedCallLogIdsRef.current?.has?.(next.id)) return;

    setCallLogs((prev) => {
      const list = Array.isArray(prev) ? prev.filter(Boolean) : [];
      const idx = list.findIndex((c) => c?.id === next.id);

      let merged = next;
      if (idx >= 0) {
        const existing = list[idx] || {};
        merged = { ...existing, ...next, peer: existing.peer || next.peer };
        const copy = list.slice();
        copy[idx] = merged;
        copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return copy;
      }

      const copy = [merged, ...list];
      copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return copy.slice(0, 500);
    });
  }

  async function deleteCallLogEntry(callLogId) {
    const id = typeof callLogId === "string" ? callLogId : "";
    if (!id) return;
    setCallsError("");
    deletedCallLogIdsRef.current.add(id);
    setCallLogs((prev) => (Array.isArray(prev) ? prev.filter((c) => c?.id !== id) : []));
    try {
      await api.deleteCall(token, id);
    } catch (e) {
      setCallsError(e?.message || "Could not delete call.");
      loadCallLogs({ force: true }).catch(() => {});
    }
  }

  async function clearCallHistory() {
    if ((callLogs || []).length === 0) return;
    const ok = window.confirm("Clear your call history?");
    if (!ok) return;
    setCallsError("");
    const prev = callLogs;
    for (const c of prev || []) {
      if (c?.id) deletedCallLogIdsRef.current.add(c.id);
    }
    setCallLogs([]);
    try {
      await api.clearCalls(token);
    } catch (e) {
      setCallsError(e?.message || "Could not clear call log.");
      setCallLogs(prev);
    }
  }

  useEffect(() => {
    refresh().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (socketConnected) {
      setSyncError("");
      refresh({ force: true }).catch(() => {});
    }
  }, [socketConnected]);

  useEffect(() => {
    const intervalMs = socketConnected ? 30000 : 6000;
    const t = setInterval(() => {
      refresh().catch(() => {});
      const active = selectedRef.current;
      if (active?.id && !socketConnected) {
        if (active.kind === "group") loadGroupMessages(active.id, { silent: true }).catch(() => {});
        else loadMessages(active.id, { silent: true }).catch(() => {});
      }
    }, intervalMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketConnected]);

  useEffect(() => {
    return () => {
      try {
        stopTyping();
      } catch (_e) {}
      for (const k of Object.keys(typingTimersRef.current || {})) {
        clearTimeout(typingTimersRef.current[k]);
      }
      typingTimersRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onMessagesScroll() {
    const el = messagesWrapRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distance < 140;
  }

  useEffect(() => {
    if (!selected?.id) return;
    const el = messagesWrapRef.current;
    if (!el) return;
    if (!stickToBottomRef.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, selected?.id]);

  function cleanupCall({ playSound = true } = {}) {
    callActiveRef.current = false;
    stopOutgoingRingTone();
    stopIncomingRingTone();
    if (playSound) playCallEnded();
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    remoteStreamRef.current = null;
    if (remoteVideoTrackRef.current) {
      remoteVideoTrackRef.current.onmute = null;
      remoteVideoTrackRef.current.onunmute = null;
      remoteVideoTrackRef.current.onended = null;
      remoteVideoTrackRef.current = null;
    }
    if (localStreamRef.current) {
      for (const t of localStreamRef.current.getTracks()) t.stop();
      localStreamRef.current = null;
    }
    if (screenStreamRef.current) {
      for (const t of screenStreamRef.current.getTracks()) t.stop();
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);
    setIncomingUpgradePrompt(false);
    setUpgradeNotice("");
    pendingOfferRef.current = null;
    iceCandidatesQueueRef.current = [];
    setCall({ active: false, peerId: null, status: "", startedAt: null, media: "video" });
    setSpeakerOn(false);
    setMicOn(true);
    setCamOn(true);
    setRemoteVideoOn(true);
    setAudioUnlockNeeded(false);
  }

  async function drainIceCandidates(pc) {
    if (!pc || !pc.remoteDescription) return;
    const queued = [...iceCandidatesQueueRef.current];
    iceCandidatesQueueRef.current = [];
    for (const cand of queued) {
      if (!cand) continue;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (_e) {}
    }
  }

  function playMessageBeep() {
    const enabled = settingsRef.current?.messageSounds !== false;
    if (!enabled) return;
    playMessagePop();
  }

  useEffect(() => {
    const onMessageNew = (msg) => {
      if (!msg?.id) return;

      const otherId = msg.from === myId ? msg.to : msg.from;
      const known = contactsRef.current?.some?.((c) => c?.id === otherId);
      if (!known) {
        refresh({ force: true }).catch(() => {});
      }

      const active = selectedRef.current;
      const inThisChat =
        active && ((msg.from === myId && msg.to === active.id) || (msg.from === active.id && msg.to === myId));

      if (msg.to === myId) {
        try {
          socket.emit("message:delivered", { id: msg.id });
        } catch (_e) {}
      }

      if (msg.to === myId && !inThisChat) playMessageBeep();

      const shouldIncrementUnread = msg.to === myId && !inThisChat;
      setThreads((prev) => ({
        ...prev,
        [otherId]: {
          unread: shouldIncrementUnread ? (prev?.[otherId]?.unread || 0) + 1 : prev?.[otherId]?.unread || 0,
          lastText: previewTextForMessage(msg) || prev?.[otherId]?.lastText || "",
          lastAt: msg.createdAt || prev?.[otherId]?.lastAt || null
        }
      }));

      if (inThisChat) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        if (msg.to === myId) markThreadRead(otherId);
      }
    };

    const onMessageUpdate = (msg) => {
      if (!msg?.id) return;
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === msg.id);
        if (idx < 0) return prev;

        const isDeleteUpdate = Boolean(msg.deletedForEveryoneAt);
        const next = prev.map((m) => {
          if (m.id !== msg.id) return m;
          const updated = {
            ...m,
            deliveredAt: msg.deliveredAt ?? m.deliveredAt ?? null,
            readAt: msg.readAt ?? m.readAt ?? null
          };

          if (isDeleteUpdate) {
            updated.deletedForEveryoneAt = msg.deletedForEveryoneAt;
            updated.deletedForEveryoneBy = msg.deletedForEveryoneBy ?? null;
            updated.text = msg.text ?? "";
            updated.file = msg.file ?? null;
          }

          return updated;
        });

        if (idx === next.length - 1) {
          const last = next[idx];
          const otherId = last.from === myId ? last.to : last.from;
          setThreads((tprev) => ({
            ...tprev,
            [otherId]: {
              ...(tprev?.[otherId] || {}),
              unread: tprev?.[otherId]?.unread || 0,
              lastText: previewTextForMessage(last) || "",
              lastAt: last?.createdAt || null
            }
          }));
        }

        return next;
      });
    };

    const onGroupMessageNew = (msg) => {
      if (!msg?.id) return;
      const groupId = msg.groupId || msg.to;
      if (!groupId) return;

      const known = groupsRef.current?.some?.((g) => g?.id === groupId);
      if (!known) {
        refresh({ force: true }).catch(() => {});
      }

      const active = selectedRef.current;
      const inThisChat = active?.kind === "group" && active.id === groupId;
      const shouldIncrementUnread = msg.from !== myId && !inThisChat;

      setThreads((prev) => ({
        ...prev,
        [groupId]: {
          unread: shouldIncrementUnread ? (prev?.[groupId]?.unread || 0) + 1 : prev?.[groupId]?.unread || 0,
          lastText: previewTextForMessage(msg) || prev?.[groupId]?.lastText || "",
          lastAt: msg.createdAt || prev?.[groupId]?.lastAt || null
        }
      }));

      if (inThisChat) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        if (msg.from !== myId) markGroupRead(groupId);
      }
    };

    const onGroupMessageUpdate = (msg) => {
      if (!msg?.id) return;
      const groupId = msg.groupId || msg.to;
      if (!groupId) return;

      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === msg.id);
        if (idx < 0) return prev;

        const next = prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m));
        const active = selectedRef.current;
        if (active?.kind === "group" && active.id === groupId) {
          const last = next[next.length - 1] || null;
          setThreads((tprev) => ({
            ...tprev,
            [groupId]: {
              ...(tprev?.[groupId] || {}),
              unread: tprev?.[groupId]?.unread || 0,
              lastText: previewTextForMessage(last) || "",
              lastAt: last?.createdAt || null
            }
          }));
        } else {
          setThreads((tprev) => {
            const current = tprev?.[groupId];
            if (!current?.lastAt || !msg?.createdAt) return tprev;
            const same = new Date(current.lastAt).getTime() === new Date(msg.createdAt).getTime();
            if (!same) return tprev;
            return {
              ...tprev,
              [groupId]: {
                ...current,
                unread: current.unread || 0,
                lastText: previewTextForMessage(msg) || ""
              }
            };
          });
        }

        return next;
      });
    };

    const setPeerTyping = (peerId, isTyping) => {
      setTypingById((prev) => {
        if (isTyping) return { ...prev, [peerId]: true };
        if (!prev?.[peerId]) return prev;
        const next = { ...prev };
        delete next[peerId];
        return next;
      });
    };

    const onTyping = ({ from, typing } = {}) => {
      if (!from) return;
      const isTyping = Boolean(typing);

      if (typingTimersRef.current[from]) {
        clearTimeout(typingTimersRef.current[from]);
        delete typingTimersRef.current[from];
      }

      setPeerTyping(from, isTyping);

      if (isTyping) {
        typingTimersRef.current[from] = setTimeout(() => {
          setPeerTyping(from, false);
          delete typingTimersRef.current[from];
        }, 3200);
      }
    };

    const onCallOffer = ({ from, sdp, media } = {}) => {
      if (!from || !sdp) return;
      if (callActiveRef.current) {
        socket.emit("call:hangup", { to: from });
        return;
      }
      const safeMedia = media === "audio" ? "audio" : "video";
      pendingOfferRef.current = { from, sdp, media: safeMedia };
      startIncomingRingTone();
      setCall({ active: false, peerId: from, status: "Incoming call…", startedAt: null, media: safeMedia });
    };

    const onCallRinging = ({ to } = {}) => {
      if (!to) return;
      setCall((c) => {
        if (!c.active) return c;
        if (c.peerId !== to) return c;
        return { ...c, status: "Ringing…" };
      });
    };

    const onCallBusy = ({ to } = {}) => {
      if (!to) return;
      setCall((c) => {
        if (!c.active) return c;
        if (c.peerId !== to) return c;
        return { ...c, status: "Busy" };
      });
      setTimeout(() => {
        if (callActiveRef.current) cleanupCall();
      }, 1200);
    };

    const onCallAnswer = async ({ sdp } = {}) => {
      if (!sdp || !pcRef.current) return;
      try {
        stopOutgoingRingTone();
        playCallConnected();
        await pcRef.current.setRemoteDescription(sdp);
        await drainIceCandidates(pcRef.current);
        setCall((c) => ({ ...c, status: "Connected" }));
      } catch (_e) {}
    };

    const onCallIce = async ({ candidate } = {}) => {
      if (!candidate) return;
      const pc = pcRef.current;
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (_e) {}
      } else {
        iceCandidatesQueueRef.current.push(candidate);
      }
    };

    const onCallHangup = () => {
      cleanupCall();
    };

    const onCallLogNew = (log) => upsertCallLog(log);
    const onCallLogUpdate = (log) => upsertCallLog(log);

    socket.on("message:new", onMessageNew);
    socket.on("message:update", onMessageUpdate);
    socket.on("group:message:new", onGroupMessageNew);
    socket.on("group:message:update", onGroupMessageUpdate);
    socket.on("typing", onTyping);
    socket.on("call:offer", onCallOffer);
    socket.on("call:ringing", onCallRinging);
    socket.on("call:busy", onCallBusy);
    socket.on("call:answer", onCallAnswer);
    socket.on("call:ice", onCallIce);
    socket.on("call:hangup", onCallHangup);
    socket.on("calllog:new", onCallLogNew);
    socket.on("calllog:update", onCallLogUpdate);

    const onCallUpgradeRequest = () => {
      setIncomingUpgradePrompt(true);
    };

    const onCallUpgradeAccept = () => {
      setUpgradeNotice("");
      upgradeCallToVideo();
    };

    const onCallUpgradeDecline = () => {
      setUpgradeNotice("Video call request was declined.");
      setTimeout(() => setUpgradeNotice(""), 3500);
    };

    const onCallMediaState = ({ video, audio } = {}) => {
      if (typeof video === "boolean") {
        setRemoteVideoOn(video);
      }
    };

    const onCallRenegotiate = async ({ from, sdp } = {}) => {
      if (!pcRef.current || !sdp) return;
      try {
        await pcRef.current.setRemoteDescription(sdp);
        await drainIceCandidates(pcRef.current);
        if (sdp.type === "offer") {
          const answer = await pcRef.current.createAnswer();
          await pcRef.current.setLocalDescription(answer);
          const targetId = from || call.peerId;
          if (targetId) {
            socket.emit("call:renegotiate_answer", { to: targetId, sdp: pcRef.current.localDescription });
          }
        }
      } catch (err) {
        console.warn("Renegotiate error:", err);
      }
    };

    const onCallRenegotiateAnswer = async ({ sdp } = {}) => {
      if (!pcRef.current || !sdp) return;
      try {
        await pcRef.current.setRemoteDescription(sdp);
        await drainIceCandidates(pcRef.current);
      } catch (err) {
        console.warn("Renegotiate answer error:", err);
      }
    };

    socket.on("call:upgrade_request", onCallUpgradeRequest);
    socket.on("call:upgrade_accept", onCallUpgradeAccept);
    socket.on("call:upgrade_decline", onCallUpgradeDecline);
    socket.on("call:media_state", onCallMediaState);
    socket.on("call:renegotiate", onCallRenegotiate);
    socket.on("call:renegotiate_answer", onCallRenegotiateAnswer);

    return () => {
      socket.off("message:new", onMessageNew);
      socket.off("message:update", onMessageUpdate);
      socket.off("group:message:new", onGroupMessageNew);
      socket.off("group:message:update", onGroupMessageUpdate);
      socket.off("typing", onTyping);
      socket.off("call:offer", onCallOffer);
      socket.off("call:ringing", onCallRinging);
      socket.off("call:busy", onCallBusy);
      socket.off("call:answer", onCallAnswer);
      socket.off("call:ice", onCallIce);
      socket.off("call:hangup", onCallHangup);
      socket.off("call:upgrade_request", onCallUpgradeRequest);
      socket.off("call:upgrade_accept", onCallUpgradeAccept);
      socket.off("call:upgrade_decline", onCallUpgradeDecline);
      socket.off("call:media_state", onCallMediaState);
      socket.off("call:renegotiate", onCallRenegotiate);
      socket.off("call:renegotiate_answer", onCallRenegotiateAnswer);
      socket.off("calllog:new", onCallLogNew);
      socket.off("calllog:update", onCallLogUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, myId, call.peerId]);

  function toggleMic() {
    setMicOn((prev) => {
      const next = !prev;
      const stream = localStreamRef.current;
      if (stream) {
        for (const t of stream.getAudioTracks()) t.enabled = next;
      }
      if (call.active && call.peerId) {
        socket.emit("call:media_state", { to: call.peerId, video: camOn, audio: next, screen: isScreenSharing });
      }
      return next;
    });
  }

  function toggleCam() {
    setCamOn((prev) => {
      const next = !prev;
      const stream = localStreamRef.current;
      if (stream) {
        for (const t of stream.getVideoTracks()) t.enabled = next;
      }
      if (call.active && call.peerId) {
        socket.emit("call:media_state", { to: call.peerId, video: next, audio: micOn, screen: isScreenSharing });
      }
      return next;
    });
  }

  function toggleSpeaker() {
    setSpeakerOn((prev) => {
      const next = !prev;
      const el = remoteAudioRef.current || remoteVideoRef.current;
      try {
        if (el) {
          el.muted = false;
          el.volume = next ? 1 : 0.75;
          if (typeof el.setSinkId === "function") {
            const sink = next ? "default" : "communications";
            el.setSinkId(sink).catch(() => {});
          }
          safePlay(el);
        }
      } catch (_e) {}
      return next;
    });
  }

  async function toggleScreenShare() {
    if (isScreenSharing) {
      stopScreenShare();
      return;
    }

    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        alert("Screen sharing is not supported on this browser.");
        return;
      }

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false
      });

      screenStreamRef.current = displayStream;
      const screenTrack = displayStream.getVideoTracks()?.[0];
      if (!screenTrack) return;

      screenTrack.onended = () => {
        stopScreenShare();
      };

      if (pcRef.current) {
        const senders = pcRef.current.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === "video");
        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        } else {
          pcRef.current.addTrack(screenTrack, displayStream);
          const offer = await pcRef.current.createOffer();
          await pcRef.current.setLocalDescription(offer);
          if (call.peerId) {
            socket.emit("call:renegotiate", { to: call.peerId, sdp: pcRef.current.localDescription });
          }
        }
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = displayStream;
        safePlay(localVideoRef.current);
      }

      if (call.active && call.peerId) {
        socket.emit("call:media_state", { to: call.peerId, video: true, audio: micOn, screen: true });
      }

      setIsScreenSharing(true);
    } catch (err) {
      console.warn("Screen share error / cancelled:", err);
    }
  }

  async function stopScreenShare() {
    try {
      if (screenStreamRef.current) {
        for (const t of screenStreamRef.current.getTracks()) t.stop();
        screenStreamRef.current = null;
      }

      let cameraTrack = localStreamRef.current?.getVideoTracks?.()?.[0] || null;
      if (!cameraTrack || cameraTrack.readyState === "ended") {
        try {
          const newCamStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
          const newTrack = newCamStream.getVideoTracks()[0];
          if (newTrack) {
            if (localStreamRef.current) {
              localStreamRef.current.addTrack(newTrack);
            }
            cameraTrack = newTrack;
          }
        } catch (_e) {}
      }

      if (cameraTrack) {
        cameraTrack.enabled = camOn;
      }

      if (pcRef.current) {
        const senders = pcRef.current.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === "video");
        if (videoSender && cameraTrack) {
          await videoSender.replaceTrack(cameraTrack);
        }
      }

      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
        safePlay(localVideoRef.current);
      }

      if (call.active && call.peerId) {
        socket.emit("call:media_state", {
          to: call.peerId,
          video: camOn,
          audio: micOn,
          screen: false
        });
      }
    } catch (_e) {}
    setIsScreenSharing(false);
  }

  function requestUpgradeToVideo() {
    if (!call.active || !call.peerId) return;
    setUpgradeNotice("Requesting video call switch…");
    socket.emit("call:upgrade_request", { to: call.peerId });
  }

  function acceptUpgradeToVideo() {
    setIncomingUpgradePrompt(false);
    if (!call.active || !call.peerId) return;
    socket.emit("call:upgrade_accept", { to: call.peerId });
    upgradeCallToVideo();
  }

  function declineUpgradeToVideo() {
    setIncomingUpgradePrompt(false);
    if (!call.active || !call.peerId) return;
    socket.emit("call:upgrade_decline", { to: call.peerId });
  }

  async function upgradeCallToVideo() {
    try {
      setCall((c) => ({ ...c, media: "video" }));
      setCamOn(true);
      setRemoteVideoOn(true);

      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });

      const videoTrack = videoStream.getVideoTracks()?.[0];
      if (!videoTrack) return;

      if (localStreamRef.current) {
        const oldVideo = localStreamRef.current.getVideoTracks()?.[0];
        if (oldVideo) {
          oldVideo.stop();
          localStreamRef.current.removeTrack(oldVideo);
        }
        localStreamRef.current.addTrack(videoTrack);
      } else {
        localStreamRef.current = videoStream;
      }

      if (pcRef.current) {
        const senders = pcRef.current.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === "video");
        if (videoSender) {
          await videoSender.replaceTrack(videoTrack);
        } else {
          pcRef.current.addTrack(videoTrack, localStreamRef.current);
          const offer = await pcRef.current.createOffer();
          await pcRef.current.setLocalDescription(offer);
          if (call.peerId) {
            socket.emit("call:renegotiate", { to: call.peerId, sdp: pcRef.current.localDescription });
          }
        }
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
        safePlay(localVideoRef.current);
      }

      if (call.active && call.peerId) {
        socket.emit("call:media_state", { to: call.peerId, video: true, audio: micOn, screen: false });
      }
    } catch (err) {
      console.warn("Could not upgrade to video:", err);
    }
  }

  function safePlay(el) {
    if (!el || typeof el.play !== "function") return;
    try {
      const p = el.play();
      if (p && typeof p.catch === "function") {
        p.catch((err) => {
          if (el !== remoteAudioRef.current) return;
          const name = String(err?.name || "");
          if (name === "NotAllowedError") setAudioUnlockNeeded(true);
        });
      }
    } catch (_e) {}
  }

  async function unlockCallAudio() {
    const el = remoteAudioRef.current;
    if (!el || typeof el.play !== "function") return;
    setAudioUnlockNeeded(false);
    try {
      el.muted = false;
      el.volume = speakerOn ? 1 : 0.75;
      const p = el.play();
      if (p && typeof p.then === "function") await p;
    } catch (_e) {
      setAudioUnlockNeeded(true);
    }
  }

  function attachStream(el, stream) {
    if (!el) return false;
    if (!stream) return false;
    if (el.srcObject === stream) return true;
    try {
      el.srcObject = stream;
      safePlay(el);
      return true;
    } catch (_e) {
      return false;
    }
  }

  function attachStreamRetry(getEl, stream, tries = 24) {
    let remaining = Number.isFinite(tries) ? Math.max(1, Math.floor(tries)) : 24;

    const tick = () => {
      if (!callActiveRef.current) return;
      const el = typeof getEl === "function" ? getEl() : null;
      if (attachStream(el, stream)) return;
      remaining -= 1;
      if (remaining <= 0) return;
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }

  function optimizeSdpAudio(sdpDesc) {
    if (!sdpDesc || !sdpDesc.sdp) return sdpDesc;
    let sdp = sdpDesc.sdp;
    // Inject Opus voice parameters: stereo=0, usedtx=1 (silence suppression to remove background noise)
    if (sdp.includes("opus/48000")) {
      sdp = sdp.replace(/a=fmtp:(\d+)(.*)/g, (match, pt, params) => {
        if (sdp.includes(`a=rtpmap:${pt} opus/48000`)) {
          let p = params || "";
          if (!p.includes("stereo=")) p += ";stereo=0;sprop-stereo=0";
          if (!p.includes("useinbandfec=")) p += ";useinbandfec=1";
          if (!p.includes("usedtx=")) p += ";usedtx=1";
          if (!p.includes("maxaveragebitrate=")) p += ";maxaveragebitrate=32000";
          return `a=fmtp:${pt}${p}`;
        }
        return match;
      });
    }
    return new RTCSessionDescription({ type: sdpDesc.type, sdp });
  }

  async function ensureLocalStream(media = "video") {
    if (localStreamRef.current) return localStreamRef.current;
    const wantsVideo = media !== "audio";
    const audioConstraints = {
      echoCancellation: { ideal: true },
      noiseSuppression: { ideal: true },
      autoGainControl: { ideal: true },
      googEchoCancellation: { ideal: true },
      googAutoGainControl: { ideal: true },
      googNoiseSuppression: { ideal: true },
      googHighpassFilter: { ideal: true },
      googTypingNoiseDetection: { ideal: true },
      channelCount: { ideal: 1 },
      sampleRate: { ideal: 48000 }
    };

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: wantsVideo ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
        audio: audioConstraints
      });
    } catch (_e) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: wantsVideo,
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        });
      } catch (_e2) {
        stream = await navigator.mediaDevices.getUserMedia({ video: wantsVideo, audio: true });
      }
    }

    for (const t of stream.getAudioTracks()) {
      t.enabled = micOn;
      try {
        if (typeof t.applyConstraints === "function") {
          t.applyConstraints(audioConstraints).catch(() => {});
        }
      } catch (_e) {}
    }
    for (const t of stream.getVideoTracks()) t.enabled = wantsVideo && camOn;
    localStreamRef.current = stream;
    if (wantsVideo) {
      attachStreamRetry(() => localVideoRef.current, stream);
    }
    return stream;
  }

  async function createPeerConnection(peerId, media = "video") {
    const pc = new RTCPeerConnection(RTC_CONFIG);

    pc.onicecandidate = (event) => {
      if (event.candidate) socket.emit("call:ice", { to: peerId, candidate: event.candidate });
    };
    pc.ontrack = (event) => {
      const track = event?.track;
      if (!track) return;

      const incomingStream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([track]);
      remoteStreamRef.current = incomingStream;

      // Play on persistent audio element immediately for 100% reliable voice reception
      const persistentEl = persistentAudioRef.current;
      if (persistentEl) {
        if (persistentEl.srcObject !== incomingStream) {
          persistentEl.srcObject = incomingStream;
        }
        persistentEl.muted = false;
        persistentEl.volume = 1.0;
        safePlay(persistentEl);
      }

      attachStreamRetry(() => remoteAudioRef.current, incomingStream);
      if (media !== "audio") attachStreamRetry(() => remoteVideoRef.current, incomingStream);

      if (media === "audio") return;

      const videoTrack = incomingStream.getVideoTracks?.()?.[0] || null;
      if (!videoTrack) {
        setRemoteVideoOn(false);
        return;
      }

      if (remoteVideoTrackRef.current && remoteVideoTrackRef.current !== videoTrack) {
        remoteVideoTrackRef.current.onmute = null;
        remoteVideoTrackRef.current.onunmute = null;
        remoteVideoTrackRef.current.onended = null;
      }

      if (remoteVideoTrackRef.current !== videoTrack) {
        remoteVideoTrackRef.current = videoTrack;
        const update = () => setRemoteVideoOn(!videoTrack.muted && videoTrack.readyState === "live");
        videoTrack.onmute = update;
        videoTrack.onunmute = update;
        videoTrack.onended = update;
        update();
      }
    };

    const stream = await ensureLocalStream(media);
    for (const track of stream.getTracks()) pc.addTrack(track, stream);

    pcRef.current = pc;
    return pc;
  }

  function callErrorText(err, media = "video") {
    const wantsVideo = media !== "audio";
    const name = String(err?.name || "");
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return wantsVideo ? "Allow camera + microphone access" : "Allow microphone access";
    }
    if (name === "NotFoundError" || name === "DevicesNotFoundError") {
      return wantsVideo ? "No camera/microphone found" : "No microphone found";
    }
    if (name === "NotReadableError" || name === "TrackStartError") {
      return "Microphone/camera is busy in another app";
    }
    if (!navigator?.mediaDevices?.getUserMedia) return "Your browser doesn't support calls";
    return "Could not start call";
  }

  useEffect(() => {
    if (!call.active) return;
    const desiredMedia = call.media === "audio" ? "audio" : "video";

    // Attach local stream if it was created before the CallOverlay mounted.
    if (desiredMedia !== "audio" && localStreamRef.current && localVideoRef.current) {
      attachStream(localVideoRef.current, localStreamRef.current);
    }

    // Attach remote stream if ontrack fired before the CallOverlay mounted.
    if (remoteStreamRef.current) {
      if (persistentAudioRef.current) {
        persistentAudioRef.current.srcObject = remoteStreamRef.current;
        safePlay(persistentAudioRef.current);
      }
      attachStream(remoteAudioRef.current, remoteStreamRef.current);
      if (desiredMedia !== "audio") attachStream(remoteVideoRef.current, remoteStreamRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call.active, call.media]);

  async function startCall(targetOrMedia = "video", maybeMedia = null) {
    let target = selected;
    let media = "video";
    if (typeof targetOrMedia === "object" && targetOrMedia !== null) {
      target = targetOrMedia;
      media = maybeMedia === "audio" ? "audio" : "video";
    } else if (typeof targetOrMedia === "string") {
      media = targetOrMedia === "audio" ? "audio" : "video";
    }

    if (!target || target.kind === "group") return;
    const peerId = target.id;
    const safeMedia = media;
    try {
      if (safeMedia === "audio") {
        setCamOn(false);
        setRemoteVideoOn(false);
      } else {
        setCamOn(true);
        setRemoteVideoOn(true);
      }
      callActiveRef.current = true;
      startOutgoingRingTone();

      // Synchronously unlock persistent audio on user click
      const persistentEl = persistentAudioRef.current;
      if (persistentEl) {
        try {
          persistentEl.muted = false;
          persistentEl.volume = 1.0;
          persistentEl.play().catch(() => {});
        } catch (_e) {}
      }

      const startedAt = Date.now();
      setCall({
        active: true,
        peerId,
        status: socket?.connected ? "Calling…" : "Connecting…",
        startedAt,
        media: safeMedia
      });

      if (socket && !socket.connected) {
        const ok = await new Promise((resolve) => {
          let settled = false;
          let timer = null;
          const onConnect = () => {
            if (settled) return;
            settled = true;
            socket.off("connect", onConnect);
            if (timer) clearTimeout(timer);
            resolve(true);
          };
          timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            socket.off("connect", onConnect);
            resolve(false);
          }, 8000);
          socket.on("connect", onConnect);
        });

        if (!ok) {
          stopOutgoingRingTone();
          setCall((c) => ({ ...c, status: "Offline" }));
          setTimeout(() => cleanupCall(), 900);
          return;
        }
        setCall((c) => ({ ...c, status: "Calling…" }));
      }

      const pc = await createPeerConnection(peerId, safeMedia);
      const rawOffer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: safeMedia !== "audio"
      });
      const offer = optimizeSdpAudio(rawOffer);
      await pc.setLocalDescription(offer);
      socket.emit("call:offer", { to: peerId, sdp: pc.localDescription, media: safeMedia });
    } catch (err) {
      stopOutgoingRingTone();
      setCall((c) => (c?.active ? { ...c, status: callErrorText(err, safeMedia) } : c));
      setTimeout(() => cleanupCall(), 2200);
    }
  }

  async function acceptIncomingCall() {
    const offer = pendingOfferRef.current;
    if (!offer) return;
    try {
      stopIncomingRingTone();
      playCallConnected();
      const peerId = offer.from;
      const safeMedia = offer.media === "audio" ? "audio" : "video";
      if (safeMedia === "audio") setCamOn(false);
      callActiveRef.current = true;
      setCall({ active: true, peerId, status: "Connecting…", startedAt: Date.now(), media: safeMedia });

      // Synchronously unlock persistent audio element on user click
      const persistentEl = persistentAudioRef.current;
      if (persistentEl) {
        try {
          persistentEl.muted = false;
          persistentEl.volume = 1.0;
          persistentEl.play().catch(() => {});
        } catch (_e) {}
      }

      const pc = await createPeerConnection(peerId, safeMedia);
      await pc.setRemoteDescription(new RTCSessionDescription(offer.sdp));
      await drainIceCandidates(pc);
      const rawAnswer = await pc.createAnswer();
      const answer = optimizeSdpAudio(rawAnswer);
      await pc.setLocalDescription(answer);
      socket.emit("call:answer", { to: peerId, sdp: pc.localDescription, media: safeMedia });
      setCall((c) => ({ ...c, status: "Connected" }));
      pendingOfferRef.current = null;
    } catch (_e) {
      cleanupCall();
    }
  }

  function declineIncomingCall() {
    stopIncomingRingTone();
    playCallEnded();
    const offer = pendingOfferRef.current;
    if (offer?.from) socket.emit("call:hangup", { to: offer.from });
    cleanupCall();
  }

  function toggleSelectMessage(msg) {
    const id = msg?.id;
    if (!id) return;
    setSelectedMessageIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  }

  async function copySelectedMessage(targetMsg) {
    const msg = targetMsg || selectedMessage;
    if (!msg) return;
    if (msg.deletedForEveryoneAt) return;

    let value = String(msg.text || "").trim();
    if (!value && msg.file?.name) {
      value = msg.file.name;
    }
    if (!value && msg.file?.kind === "missed_call") {
      value = msg.file?.name === "video" ? "Missed video call" : "Missed voice call";
    }
    if (!value && msg.file?.kind === "call") {
      value = msg.file?.name === "video" ? "Video call" : "Voice call";
    }
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      showToast("Copied to clipboard");
    } catch (_e) {
      try {
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        showToast("Copied to clipboard");
      } catch (_e2) {}
    }
  }

  function downloadSelectedMessage(targetMsg) {
    const msg = targetMsg || selectedMessage;
    const url = msg?.file?.url;
    if (!url) return;
    if (msg?.deletedForEveryoneAt) return;

    const name = msg?.file?.name || "download";
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.target = "_blank";
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function updateReactions(prev, emoji) {
    const list = Array.isArray(prev) ? prev.filter((r) => r && typeof r.emoji === "string") : [];
    const map = new Map();

    for (const r of list) {
      const key = String(r.emoji || "").trim();
      if (!key) continue;
      const count = Number(r.count || 0) || 0;
      if (count <= 0) continue;
      map.set(key, { emoji: key, count, me: Boolean(r.me) });
    }

    let currentMeEmoji = null;
    for (const v of map.values()) {
      if (v.me) currentMeEmoji = v.emoji;
      v.me = false;
    }

    if (currentMeEmoji) {
      const existing = map.get(currentMeEmoji);
      if (existing) {
        existing.count = Math.max(0, existing.count - 1);
        if (existing.count === 0) map.delete(currentMeEmoji);
      }
    }

    if (currentMeEmoji !== emoji) {
      const next = map.get(emoji) || { emoji, count: 0, me: false };
      next.count += 1;
      next.me = true;
      map.set(emoji, next);
    }

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }

  function reactSelectedMessage(emoji) {
    if (!selectedMessage?.id) return;
    if (selectedMessage?.deletedForEveryoneAt) return;
    const safeEmoji = String(emoji || "").trim().slice(0, 12);
    if (!safeEmoji) return;

    const id = selectedMessage.id;
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, reactions: updateReactions(m.reactions, safeEmoji) } : m))
    );
    setSelectedMessageIds([]);
  }

  function openForwardModal(targetMsg) {
    let ids = [];
    if (targetMsg?.id) {
      ids = [targetMsg.id];
      setSelectedMessageIds(ids);
    } else if (selectedMessageIds.length > 0) {
      ids = selectedMessageIds;
    }
    if (ids.length === 0) return;
    setForwardMessageError("");
    setShowForwardMessage(true);
    setForwardToId((prev) => prev || contacts?.[0]?.id || "");
  }

  function openDeleteModal(targetMsg) {
    let ids = [];
    if (targetMsg?.id) {
      ids = [targetMsg.id];
      setSelectedMessageIds(ids);
    } else if (selectedMessageIds.length > 0) {
      ids = selectedMessageIds;
    }
    if (ids.length === 0) return;
    setDeleteMessageError("");
    setShowDeleteMessage(true);
  }

  async function forwardSelectedMessage() {
    if (selectedMessageIds.length === 0) return;
    if (!forwardToId) return;

    setForwardMessageError("");
    setForwardingMessage(true);

    try {
      const res = await api.forwardMessages(token, selectedMessageIds, forwardToId);
      const list = res?.messages || [];

      if (list.length > 0) {
        const last = list[list.length - 1];
        const active = selectedRef.current;
        const inThisChat = active?.id && active.id === forwardToId;

        setThreads((prev) => ({
          ...prev,
          [forwardToId]: {
            ...(prev?.[forwardToId] || {}),
            unread: prev?.[forwardToId]?.unread || 0,
            lastText: previewTextForMessage(last) || prev?.[forwardToId]?.lastText || "",
            lastAt: last.createdAt || prev?.[forwardToId]?.lastAt || null
          }
        }));

        if (inThisChat) {
          setMessages((prev) => {
            const existing = new Set(prev.map((m) => m.id));
            const merged = [...prev];
            for (const msg of list) {
              if (!msg?.id || existing.has(msg.id)) continue;
              existing.add(msg.id);
              merged.push(msg);
            }
            return merged;
          });
        }
      }

      setShowForwardMessage(false);
      const count = selectedMessageIds.length;
      setSelectedMessageIds([]);
      setForwardToId("");
      showToast(count > 1 ? "Messages forwarded" : "Message forwarded");
    } catch (e) {
      setForwardMessageError(e?.message || "Could not forward message.");
    } finally {
      setForwardingMessage(false);
    }
  }

  async function deleteSelectedMessage(scope) {
    if (selectedMessageIds.length === 0 || !selected?.id) return;
    setDeleteMessageError("");
    setDeletingMessage(true);

    try {
      const isGroup = selected.kind === "group";
      if (scope === "everyone") {
        const res = isGroup
          ? await api.deleteGroupMessages(token, selected.id, selectedMessageIds, scope)
          : await api.deleteMessages(token, selectedMessageIds, scope);
        const updates = res?.messages || (res?.message ? [res.message] : []);
        const byId = new Map(updates.filter((m) => m?.id).map((m) => [m.id, m]));
        setMessages((prev) => {
          const next = prev.map((m) => (byId.has(m.id) ? { ...m, ...byId.get(m.id) } : m));
          const last = next[next.length - 1] || null;
          setThreads((tprev) => ({
            ...tprev,
            [selected.id]: {
              ...(tprev?.[selected.id] || {}),
              unread: tprev?.[selected.id]?.unread || 0,
              lastText: previewTextForMessage(last) || "",
              lastAt: last?.createdAt || null
            }
          }));
          return next;
        });
        showToast(selectedMessageIds.length > 1 ? "Messages deleted for everyone" : "Message deleted for everyone");
      } else {
        const res = isGroup
          ? await api.deleteGroupMessages(token, selected.id, selectedMessageIds, scope)
          : await api.deleteMessages(token, selectedMessageIds, scope);
        const deleted = new Set((res?.deletedIds || (res?.ok ? selectedMessageIds : [])).filter(Boolean));
        if (deleted.size === 0) {
          setShowDeleteMessage(false);
          setSelectedMessageIds([]);
          return;
        }
        setMessages((prev) => {
          const next = prev.filter((m) => !deleted.has(m.id));
          const last = next[next.length - 1] || null;
          setThreads((tprev) => ({
            ...tprev,
            [selected.id]: {
              ...(tprev?.[selected.id] || {}),
              unread: tprev?.[selected.id]?.unread || 0,
              lastText: previewTextForMessage(last) || "",
              lastAt: last?.createdAt || null
            }
          }));
          return next;
        });
        showToast(selectedMessageIds.length > 1 ? "Messages deleted for you" : "Message deleted for you");
      }

      setShowDeleteMessage(false);
      setSelectedMessageIds([]);
    } catch (e) {
      setDeleteMessageError(e?.message || "Could not delete message.");
    } finally {
      setDeletingMessage(false);
    }
  }

  async function sendMessage(text) {
    if (!selected) return false;
    if (selected.kind !== "group") stopTyping(selected.id);
    const now = Date.now();
    if (sendInFlightRef.current) return false;
    if (now - lastSendAtRef.current < 350) return false;
    lastSendAtRef.current = now;
    sendInFlightRef.current = true;
    setSendingMessage(true);
    setSendError("");
    try {
      const res =
        selected.kind === "group"
          ? await api.sendGroupMessage(token, selected.id, text)
          : await api.sendMessage(token, selected.id, text);
      const msg = res?.message;
      if (msg) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        setThreads((prev) => ({
          ...prev,
          [selected.id]: {
            ...(prev?.[selected.id] || {}),
            unread: 0,
            lastText: previewTextForMessage(msg) || prev?.[selected.id]?.lastText || "",
            lastAt: msg.createdAt || prev?.[selected.id]?.lastAt || null
          }
        }));
      }
      return true;
    } catch (e) {
      setSendError(e?.message || "Could not send message.");
      return false;
    } finally {
      sendInFlightRef.current = false;
      setSendingMessage(false);
    }
  }

  async function sendFile(file, caption = "") {
    if (!selected) return false;
    if (selected.kind !== "group") stopTyping(selected.id);
    const now = Date.now();
    if (sendInFlightRef.current) return false;
    if (now - lastSendAtRef.current < 350) return false;
    lastSendAtRef.current = now;
    sendInFlightRef.current = true;
    setSendingMessage(true);
    setSendError("");
    try {
      const res =
        selected.kind === "group"
          ? await api.sendGroupFile(token, selected.id, file, caption)
          : await api.sendFile(token, selected.id, file, caption);
      const msg = res?.message;
      if (msg) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        setThreads((prev) => ({
          ...prev,
          [selected.id]: {
            ...(prev?.[selected.id] || {}),
            unread: 0,
            lastText: previewTextForMessage(msg) || prev?.[selected.id]?.lastText || "",
            lastAt: msg.createdAt || prev?.[selected.id]?.lastAt || null
          }
        }));
      }
      return true;
    } catch (e) {
      setSendError(e?.message || "Could not send file.");
      return false;
    } finally {
      sendInFlightRef.current = false;
      setSendingMessage(false);
    }
  }

  async function clearSelectedChat() {
    if (!selected) return;
    setClearChatError("");
    setClearingChat(true);
    try {
      if (selected.kind === "group") await api.clearGroupChat(token, selected.id);
      else await api.clearChat(token, selected.id);
      setMessages([]);
      setLoadError("");
      setThreads((prev) => ({
        ...prev,
        [selected.id]: {
          ...(prev?.[selected.id] || {}),
          unread: 0,
          lastText: "",
          lastAt: null
        }
      }));
      setShowClearChat(false);
      refresh({ force: true }).catch(() => {});
    } catch (e) {
      setClearChatError(e?.message || "Could not delete chat.");
    } finally {
      setClearingChat(false);
    }
  }

  async function deleteMultipleChats(chatIds) {

    if (!Array.isArray(chatIds) || chatIds.length === 0) return;
    const count = chatIds.length;
    try {
      for (const id of chatIds) {
        const isGroup = groups.some((g) => g.id === id);
        if (isGroup) {
          await api.clearGroupChat(token, id).catch(() => {});
        } else {
          await api.clearChat(token, id).catch(() => {});
        }
      }

      setThreads((prev) => {
        const next = { ...prev };
        for (const id of chatIds) {
          if (next[id]) {
            next[id] = {
              ...next[id],
              unread: 0,
              lastText: "",
              lastAt: null
            };
          }
        }
        return next;
      });

      if (selected?.id && chatIds.includes(selected.id)) {
        setMessages([]);
      }

      showToast(count > 1 ? `${count} chats deleted` : "Chat deleted");
      refresh({ force: true }).catch(() => {});
    } catch {
      showToast("Could not delete selected chats.");
    }
  }

  function selectAllMessages() {
    if (messages.length === 0) return;
    if (selectedMessageIds.length === messages.length) {
      setSelectedMessageIds([]);
    } else {
      setSelectedMessageIds(messages.map((m) => m.id));
    }
  }

  function selectContact(c) {
    setSendError("");
    stopTyping();
    setSelected(c);
    setMessages([]);
    stickToBottomRef.current = true;
    if (c?.kind === "group") {
      loadGroupMessages(c.id).catch(() => {});
      markGroupRead(c.id);
    } else {
      loadMessages(c.id).catch(() => {});
      markThreadRead(c.id);
    }
  }

  function openChatFromCall(callItem) {
    const raw = callItem || null;
    const direction = raw?.direction || (raw?.from === myId ? "outgoing" : "incoming");
    const peerId = raw?.peer?.id || (direction === "outgoing" ? raw?.to : raw?.from);
    if (!peerId) return;

    const existing = contactsRef.current?.find?.((c) => c?.id === peerId) || null;
    const peer = raw?.peer || existing || null;
    const item = peer ? { ...peer, kind: "user" } : { id: peerId, kind: "user", email: "", name: "" };

    setContacts((prev) => (prev.some((c) => c.id === item.id) ? prev : [item, ...prev]));
    setPrimaryView("chats");
    selectContact(item);
  }

  function toggleFavoriteChat(id) {
    const safeId = typeof id === "string" ? id : "";
    if (!safeId) return;
    setFavoriteIds((prev) => {
      const list = Array.isArray(prev) ? prev.filter(Boolean) : [];
      if (list.includes(safeId)) return list.filter((x) => x !== safeId);
      return [safeId, ...list].slice(0, 200);
    });
  }

  const callPeer = call.peerId
    ? contacts.find((c) => c.id === call.peerId) ||
      callLogs.find((l) => l.peer?.id === call.peerId)?.peer ||
      (selected?.id === call.peerId ? selected : null)
    : null;
  const callTitle = callPeer ? callPeer.name || callPeer.email : call.media === "audio" ? "Voice call" : "Video call";
  const unreadTotal = Object.values(threads || {}).reduce((sum, t) => sum + (t?.unread || 0), 0);
  const selectedThreadMeta = selected?.id ? threads?.[selected.id] || null : null;
  const selectedIsFavorite = Boolean(selected?.id && favoriteIds.includes(selected.id));
  const showDesktopInfoPanel = !isMobile && showInfoPanel && Boolean(selected);
  const showMobileRail =
    isMobile &&
    !((primaryView === "chats" && selected) || (primaryView === "groups" && selected?.kind === "group"));

  const appBodyClass = isMobile
    ? "appBody appBodyMobile"
    : showDesktopInfoPanel
      ? "appBody"
      : "appBody appBodyExpanded";

  function openChatsView() {
    setPrimaryView("chats");
    if (selectedCount > 0) setSelectedMessageIds([]);
    stopTyping();
    if (isMobile) {
      setSelected(null);
      return;
    }

    const current = selectedRef.current;
    if (current?.id) return;

    const firstContact = contactsRef.current?.[0] ? { ...contactsRef.current[0], kind: "user" } : null;
    const firstGroup = groupsRef.current?.[0] ? { ...groupsRef.current[0], kind: "group" } : null;
    if (firstContact || firstGroup) {
      selectContact(firstContact || firstGroup);
      return;
    }

    setSelected(null);
  }

  function openGroupsView() {
    setPrimaryView("groups");
    if (selectedCount > 0) setSelectedMessageIds([]);
    stopTyping();
    if (isMobile) {
      setSelected(null);
      return;
    }

    const current = selectedRef.current;
    if (current?.kind === "group" && current?.id) return;

    const firstGroup = groupsRef.current?.[0] ? { ...groupsRef.current[0], kind: "group" } : null;
    if (firstGroup) {
      selectContact(firstGroup);
      return;
    }

    setSelected(null);
  }

  function openContactsView() {
    setPrimaryView("contacts");
    if (selectedCount > 0) setSelectedMessageIds([]);
    stopTyping();
    if (isMobile) {
      setSelected(null);
    }
  }

  function openCallsView() {
    setPrimaryView("calls");
    if (selectedCount > 0) setSelectedMessageIds([]);
    stopTyping();
    setSelected(null);
    loadCallLogs().catch(() => {});
  }

  function openProfileView() {
    setPrimaryView("profile");
    if (selectedCount > 0) setSelectedMessageIds([]);
    stopTyping();
    setSelected(null);
  }

  function openSettingsView() {
    setPrimaryView("settings");
    if (selectedCount > 0) setSelectedMessageIds([]);
    stopTyping();
    setSelected(null);
  }

  function toggleTopbarTheme() {
    setSettings((current) => {
      const safe = current || DEFAULT_SETTINGS;
      return {
        ...safe,
        theme: safe.theme === "light" ? "dark" : "light"
      };
    });
  }

  function openSelectedGroupChat() {
    if (selected?.kind !== "group") return;
    setPrimaryView("chats");
  }

  const appFrame = (
    <div className={isMobile ? "app appMobile" : "app appDesktopWindow"} data-view={primaryView}>
      {/* 1. Leftmost Navigation Rail */}
      {!isMobile && (
        <NavRail
          className="rail railDesktop"
          active={primaryView}
          unreadTotal={unreadTotal}
          theme={settings?.theme || "light"}
          me={me}
          myEmail={myEmail}
          onSelectChats={openChatsView}
          onOpenCalls={openCallsView}
          onOpenGroups={openGroupsView}
          onOpenContacts={openContactsView}
          onOpenSettings={openSettingsView}
          onOpenProfile={openProfileView}
          onToggleTheme={toggleTopbarTheme}
        />
      )}

      <div className={appBodyClass}>
        {/* 2. Middle Sidebar Panel */}
        {primaryView === "calls" ? (
          <CallsSidebar
            className={isMobile && selected ? "sidebar mobileHidden" : "sidebar"}
            isMobile={isMobile}
            socketConnected={socketConnected}
            calls={callLogs}
            loading={loadingCalls}
            error={callsError}
            onRefresh={() => loadCallLogs({ force: true }).catch(() => {})}
            onClear={clearCallHistory}
            onDelete={deleteCallLogEntry}
            onOpenChat={openChatFromCall}
            onStartCall={startCall}
          />
        ) : primaryView === "groups" ? (
          <GroupsSidebar
            className={isMobile && selected ? "sidebar mobileHidden" : "sidebar"}
            isMobile={isMobile}
            socketConnected={socketConnected}
            groups={groups}
            threads={threads}
            selectedId={selected?.kind === "group" ? selected.id : ""}
            onSelect={(group) => {
              setPrimaryView("chats");
              selectContact(group);
            }}
            onAddGroup={() => setShowAddGroup(true)}
            dockUnreadTotal={unreadTotal}
            onDockChats={openChatsView}
            onDockGroups={openGroupsView}
            onDockCalls={openCallsView}
            onDockSettings={openSettingsView}
          />
        ) : primaryView === "contacts" ? (
          <ContactsSidebar
            className={isMobile && selected ? "sidebar mobileHidden" : "sidebar"}
            isMobile={isMobile}
            socketConnected={socketConnected}
            contacts={contacts}
            selectedId={selected?.kind === "user" ? selected.id : ""}
            onSelect={(contact) => {
              setPrimaryView("chats");
              selectContact(contact);
            }}
            onAddContact={() => setShowAddContact(true)}
          />
        ) : primaryView === "settings" || primaryView === "profile" ? (
          <WorkspaceSidebar
            className={isMobile && selected ? "sidebar mobileHidden" : "sidebar"}
            mode={primaryView}
            token={token}
            me={me}
            myEmail={myEmail}
            settings={settings}
            onChangeSettings={setSettings}
            onUpdatedMe={setMe}
            onEditProfile={() => setShowProfile(true)}
            onLogout={onLogout}
            showToast={showToast}
          />
        ) : (
          <Sidebar
            className={isMobile && selected ? "sidebar mobileHidden" : "sidebar"}
            isMobile={isMobile}
            socketConnected={socketConnected}
            syncError={syncError}
            searchInput={searchInput}
            filterText={search}
            onSearchChange={setSearchInput}
            chatFilter={chatFilter}
            onFilterChange={setChatFilter}
            favoriteIds={favoriteIds}
            onToggleFavorite={toggleFavoriteChat}
            contacts={contacts}
            groups={groups}
            threads={threads}
            typingById={typingById}
            selectedId={selected?.id || null}
            onSelect={selectContact}
            onAddContact={() => setShowAddContact(true)}
            onAddGroup={() => setShowAddGroup(true)}
            onEditProfile={() => setShowProfile(true)}
            onLogout={onLogout}
            onDeleteChats={deleteMultipleChats}
            dockActive="chats"
            dockUnreadTotal={unreadTotal}
            onDockChats={openChatsView}
            onDockGroups={openGroupsView}
            onDockCalls={openCallsView}
            onDockSettings={openSettingsView}
          />
        )}

        {/* 3. Right Chat Box */}
        <ChatBox
          className={isMobile && !selected ? "chat mobileHidden" : "chat"}
          selected={selected}
          selectedCount={selectedCount}
          selectedMessage={selectedMessage}
          selectedMessageIds={selectedMessageIds}
          selectedHasDeleted={selectedHasDeleted}
          isMobile={isMobile}
          socketConnected={socketConnected}
          onBack={() => {
            if (selectedCount > 0) {
              setSelectedMessageIds([]);
              return;
            }
            stopTyping();
            setSelected(null);
          }}
          onStartCall={startCall}
          onDeleteChat={() => {
            setClearChatError("");
            setShowClearChat(true);
          }}
          onSelectMessage={toggleSelectMessage}
          onSelectAllMessages={selectAllMessages}
          onClearSelectedMessage={() => setSelectedMessageIds([])}
          onCopySelectedMessage={copySelectedMessage}
          onDeleteSelectedMessage={openDeleteModal}
          onForwardSelectedMessage={openForwardModal}
          onDownloadSelectedMessage={downloadSelectedMessage}
          onReactSelectedMessage={reactSelectedMessage}
          onToggleInfoPanel={() => setShowInfoPanel((prev) => !prev)}
          isPeerTyping={selected?.id ? Boolean(typingById?.[selected.id]) : false}
          myId={myId}
          me={me}
          messages={messages}
          loadingMessages={loadingMessages && messages.length === 0}
          loadError={loadError}
          sendError={sendError}
          messagesWrapRef={messagesWrapRef}
          onMessagesScroll={onMessagesScroll}
          onSend={sendMessage}
          onSendFile={sendFile}
          onTyping={onComposerTyping}
          sending={sendingMessage}
          onEmptySendDoc={() => setShowAddContact(true)}
          onEmptyAddContact={() => setShowAddContact(true)}
        />


        {((!isMobile && showDesktopInfoPanel) || (isMobile && showInfoPanel && Boolean(selected))) && (
          <InfoPanel
            className={isMobile ? "infoPanel infoPanelMobile" : "infoPanel"}
            mode={primaryView}
            selected={selected}
            me={me}
            myEmail={myEmail}
            messages={messages}
            threadMeta={selectedThreadMeta}
            isFavorite={selectedIsFavorite}
            onToggleFavorite={toggleFavoriteChat}
            onStartCall={startCall}
            onOpenSettings={openSettingsView}
            onClose={() => setShowInfoPanel(false)}
            socketConnected={socketConnected}
          />
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      {showMobileRail && (
        <NavRail
          className="rail railMobile"
          isMobile
          active={primaryView}
          unreadTotal={unreadTotal}
          theme={settings?.theme || "light"}
          me={me}
          myEmail={myEmail}
          onSelectChats={openChatsView}
          onOpenCalls={openCallsView}
          onOpenGroups={openGroupsView}
          onOpenContacts={() => setShowAddContact(true)}
          onOpenSettings={openSettingsView}
          onOpenProfile={openProfileView}
          onToggleTheme={toggleTopbarTheme}
        />
      )}
    </div>
  );

  return (
    <div className={isMobile ? "homeRoot mobile" : "homeRoot"}>
      {me && !me?.name && <ProfileModal token={token} me={me} onUpdated={setMe} canClose={false} />}
      {showProfile && (
        <ProfileModal
          token={token}
          me={me}
          onUpdated={setMe}
          onClose={() => setShowProfile(false)}
          canClose
        />
      )}
      {showSettings && (
        <SettingsModal
          me={me}
          myEmail={myEmail}
          settings={settings}
          onChange={setSettings}
          onEditProfile={() => {
            setShowSettings(false);
            setShowProfile(true);
          }}
          onLogout={onLogout}
          onClose={() => setShowSettings(false)}
        />
      )}
      {appFrame}

      {showAddContact && (
        <AddContactModal
          token={token}
          onClose={() => setShowAddContact(false)}
          onAdded={(c) => {
            const contact = c?.id ? { ...c, kind: "user" } : c;
            setContacts((prev) => (prev.some((x) => x.id === contact.id) ? prev : [contact, ...prev]));
          }}
        />
      )}

      {showAddGroup && (
        <AddGroupModal
          token={token}
          contacts={contacts}
          onClose={() => setShowAddGroup(false)}
          onCreated={(g) => {
            if (!g?.id) return;
            const group = { ...g, kind: "group" };
            setGroups((prev) => (prev.some((x) => x.id === group.id) ? prev : [group, ...prev]));
            setThreads((prev) => ({
              ...prev,
              [group.id]: prev?.[group.id] || { unread: 0, lastText: "", lastAt: null }
            }));
            try {
              socket.emit("group:subscribe", { groupId: group.id });
            } catch (_e) {}
          }}
        />
      )}

      {showClearChat && selected && (
        <ConfirmModal
          title={selected.kind === "group" ? "Clear group chat" : "Delete chat"}
          description={
            selected.kind === "group"
              ? "This will clear this group chat for you (like WhatsApp). Other members will still see messages."
              : "This will clear this chat for you (like WhatsApp). Messages may still exist for the other person until they expire."
          }
          confirmText={selected.kind === "group" ? "Clear" : "Delete"}
          loading={clearingChat}
          error={clearChatError}
          danger
          onCancel={() => setShowClearChat(false)}
          onConfirm={clearSelectedChat}
        />
      )}

      {showDeleteMessage && selectedCount > 0 && (
        <MessageDeleteModal
          count={selectedCount}
          canDeleteEveryone={
            selectedMessages.length > 0 &&
            selectedMessages.every((m) => m?.from === myId && !m?.deletedForEveryoneAt)
          }
          loading={deletingMessage}
          error={deleteMessageError}
          onCancel={() => {
            setShowDeleteMessage(false);
            setDeleteMessageError("");
          }}
          onDeleteForMe={() => deleteSelectedMessage("me")}
          onDeleteForEveryone={() => deleteSelectedMessage("everyone")}
        />
      )}

      {showForwardMessage && (
        <ForwardMessageModal
          count={selectedCount}
          contacts={contacts}
          selectedId={forwardToId}
          loading={forwardingMessage}
          error={forwardMessageError}
          onSelect={setForwardToId}
          onCancel={() => {
            setShowForwardMessage(false);
            setForwardMessageError("");
          }}
          onForward={forwardSelectedMessage}
        />
      )}

      {!call.active && pendingOfferRef.current && (
        <div className="modalOverlay incomingCallOverlay">
          <div className="incomingCallCard">
            <div className="incomingCallAvatarWrap">
              <div className="callAvatarPulseRing">
                <Avatar
                  name={callPeer?.name || callPeer?.email || "Caller"}
                  url={callPeer?.avatarUrl}
                  size={88}
                />
              </div>
            </div>
            <div className="incomingCallInfo">
              <h3 className="incomingCallName">{callPeer?.name || callPeer?.email || "Unknown Caller"}</h3>
              <p className="incomingCallSubtitle">
                {pendingOfferRef.current?.media === "audio" ? "Incoming Voice Call..." : "Incoming Video Call..."}
              </p>
            </div>
            <div className="incomingCallActions">
              <button className="incomingCallBtn decline" onClick={declineIncomingCall} type="button" aria-label="Decline">
                <IconPhoneEnd size={22} />
                <span>Decline</span>
              </button>
              <button className="incomingCallBtn accept" onClick={acceptIncomingCall} type="button" aria-label="Accept">
                {pendingOfferRef.current?.media === "audio" ? <IconPhone size={22} /> : <IconVideo size={22} />}
                <span>Accept</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {incomingUpgradePrompt && (
        <div className="modalOverlay incomingCallOverlay">
          <div className="incomingCallCard">
            <div className="incomingCallAvatarWrap">
              <div className="callAvatarPulseRing">
                <Avatar
                  name={callPeer?.name || callPeer?.email || "Caller"}
                  url={callPeer?.avatarUrl}
                  size={76}
                />
              </div>
            </div>
            <div className="incomingCallInfo">
              <h3 className="incomingCallName">{callPeer?.name || callPeer?.email || "Caller"}</h3>
              <p className="incomingCallSubtitle">Wants to switch to Video Call</p>
            </div>
            <div className="incomingCallActions">
              <button className="incomingCallBtn decline" onClick={declineUpgradeToVideo} type="button" aria-label="Decline">
                <IconPhoneEnd size={20} />
                <span>Decline</span>
              </button>
              <button className="incomingCallBtn accept" onClick={acceptUpgradeToVideo} type="button" aria-label="Accept">
                <IconVideo size={20} />
                <span>Switch to Video</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {call.active && (
        <CallModal
          title={callTitle}
          media={call.media}
          avatarUrl={callPeer?.avatarUrl}
          remoteVideoOn={remoteVideoOn}
          status={call.status}
          startedAt={call.startedAt}
          speakerOn={speakerOn}
          micOn={micOn}
          camOn={camOn}
          isScreenSharing={isScreenSharing}
          audioUnlockNeeded={audioUnlockNeeded}
          upgradeNotice={upgradeNotice}
          onToggleSpeaker={toggleSpeaker}
          onToggleMic={toggleMic}
          onToggleCam={toggleCam}
          onToggleScreenShare={toggleScreenShare}
          onUpgradeToVideo={requestUpgradeToVideo}
          onUnlockAudio={() => unlockCallAudio().catch(() => {})}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          remoteAudioRef={remoteAudioRef}
          onHangup={() => {
            if (call.peerId) socket.emit("call:hangup", { to: call.peerId });
            cleanupCall();
          }}
        />
      )}

      {/* Persistent Hidden Audio element for guaranteed voice playback */}
      <audio ref={persistentAudioRef} autoPlay playsInline style={{ display: "none" }} />

      {toastMessage && (
        <div className="toastNotification">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
