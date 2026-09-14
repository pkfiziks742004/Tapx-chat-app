import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import Avatar from "./Avatar.jsx";
import { IconPhone, IconRefresh, IconSearch, IconTrash, IconVideo } from "./Icons.jsx";

function formatClock(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(startIso, endIso) {
  if (!startIso || !endIso) return "";
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "";
  const total = Math.max(0, Math.floor((end - start) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function callLabel(call) {
  const status = String(call?.status || "").toLowerCase();
  const dir = String(call?.direction || "").toLowerCase();

  if (status === "busy") return "Busy";
  if (status === "ringing") return dir === "outgoing" ? "Calling…" : "Ringing…";
  if (status === "connected") return "Connected";

  if (status === "cancelled") return dir === "outgoing" ? "Cancelled" : "Missed";
  if (status === "declined") return dir === "outgoing" ? "Declined" : "Declined";
  if (status === "missed") return dir === "outgoing" ? "No answer" : "Missed";
  if (status === "ended") return dir === "outgoing" ? "Outgoing" : "Incoming";
  return dir === "outgoing" ? "Outgoing" : "Incoming";
}

function isMissed(call) {
  const status = String(call?.status || "").toLowerCase();
  const dir = String(call?.direction || "").toLowerCase();
  if (status === "missed") return true;
  if (status === "cancelled" && dir !== "outgoing") return true;
  return false;
}

export default function CallsSidebar({
  className = "sidebar",
  isMobile = false,
  socketConnected,
  calls = [],
  loading,
  error,
  onRefresh,
  onClear,
  onDelete,
  onOpenChat,
  onStartCall
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    const list = Array.isArray(calls) ? calls.filter(Boolean) : [];
    if (!q) return list;
    return list.filter((c) => {
      const p = c.peer || null;
      const name = String(p?.name || "").toLowerCase();
      const email = String(p?.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [calls, query]);

  return (
    <aside className={className}>
      <div className="sidebarHeader">
        <div className="sidebarTitleWrap">
          <h1 className="sidebarTitle">Calls</h1>
          {!socketConnected && <span className="sidebarOfflineBadge">Offline</span>}
        </div>
        <div className="sidebarHeaderActions">
          <button
            className="sidebarHeaderActionBtn"
            type="button"
            onClick={() => onRefresh?.()}
            aria-label="Refresh calls"
            title="Refresh"
          >
            <IconRefresh size={18} />
          </button>
          <button
            className="sidebarHeaderActionBtn danger"
            type="button"
            onClick={() => onClear?.()}
            aria-label="Clear all calls"
            title="Clear call log"
          >
            <IconTrash size={18} />
          </button>
        </div>
      </div>

      {!socketConnected && error && <div className="syncBanner">{error}</div>}

      <div className="sidebarSearch">
        <div className="sidebarSearchField">
          <span className="sidebarSearchIcon" aria-hidden="true">
            <IconSearch size={16} />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search calls"
            autoComplete="off"
          />
        </div>
      </div>

      <div className="sidebarSectionLabel">Call History</div>

      <div className="sidebarList">
        {loading && filtered.length === 0 ? (
          <div className="sidebarEmpty">Loading call history…</div>
        ) : filtered.length === 0 ? (
          <div className="sidebarEmpty">No calls yet. Start a call from any chat.</div>
        ) : (
          filtered.map((c) => {
            const peer = c.peer || null;
            const title = peer?.name || peer?.email?.split("@")[0] || "User";
            const subtitle = callLabel(c);
            const time = formatClock(c.createdAt);
            const duration = formatDuration(c.startedAt, c.endedAt);
            const missed = isMissed(c);
            const isVideo = c.media === "video";

            return (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="callItem"
              >
                <button
                  className="callItemMain"
                  type="button"
                  onClick={() => onOpenChat?.(c)}
                  title={`Chat with ${title}`}
                >
                  <div className="callItemAvatarWrap">
                    <Avatar name={title} url={peer?.avatarUrl} size={44} />
                  </div>

                  <div className="callItemContent">
                    <div className="callItemRowTop">
                      <span className="callItemName">{title}</span>
                      {time && <span className="callItemTime">{time}</span>}
                    </div>

                    <div className="callItemRowBottom">
                      <div className={`callItemSub ${missed ? "missed" : ""}`}>
                        <span className={`callMediaIcon ${missed ? "missed" : ""}`} aria-hidden="true">
                          {isVideo ? <IconVideo size={13} /> : <IconPhone size={13} />}
                        </span>
                        <span>{subtitle}</span>
                        {duration && <span className="callItemDur">· {duration}</span>}
                      </div>
                    </div>
                  </div>
                </button>

                <div className="callItemActions">
                  {onStartCall && peer && (
                    <button
                      className="callItemActionBtn"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartCall?.(peer, isVideo ? "video" : "audio");
                      }}
                      aria-label={`Call ${title}`}
                      title={isVideo ? "Video call" : "Voice call"}
                    >
                      {isVideo ? <IconVideo size={16} /> : <IconPhone size={16} />}
                    </button>
                  )}
                  <button
                    className="callItemDeleteBtn"
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete?.(c.id);
                    }}
                    aria-label="Delete call log"
                    title="Delete"
                  >
                    <IconTrash size={16} />
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </aside>
  );
}
