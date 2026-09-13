import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import Avatar from "./Avatar.jsx";
import { IconPlus, IconSearch } from "./Icons.jsx";

function formatTimeDisplay(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));

  if (diffMin >= 0 && diffMin < 60) {
    return `${String(diffMin).padStart(2, "0")} min`;
  }
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function GroupsSidebar({
  className = "sidebar",
  isMobile = false,
  socketConnected,
  groups = [],
  threads = {},
  selectedId = "",
  onSelect,
  onAddGroup
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    const list = Array.isArray(groups) ? groups.filter(Boolean) : [];
    const next = list.filter((group) => {
      if (!q) return true;
      const name = String(group?.name || "").toLowerCase();
      return name.includes(q);
    });

    next.sort((a, b) => {
      const ta = threads?.[a.id]?.lastAt ? new Date(threads[a.id].lastAt).getTime() : 0;
      const tb = threads?.[b.id]?.lastAt ? new Date(threads[b.id].lastAt).getTime() : 0;
      if (ta !== tb) return tb - ta;
      return String(a?.name || "").localeCompare(String(b?.name || ""));
    });

    return next;
  }, [groups, query, threads]);

  return (
    <aside className={className}>
      <div className="sidebarHeader">
        <div className="sidebarTitleWrap">
          <h1 className="sidebarTitle">Groups</h1>
          {!socketConnected && <span className="sidebarOfflineBadge">Offline</span>}
        </div>
        <div className="sidebarHeaderActions">
          <button
            className="sidebarHeaderActionBtn"
            type="button"
            onClick={onAddGroup}
            aria-label="Create Group"
            title="Create Group"
          >
            <IconPlus size={18} />
          </button>
        </div>
      </div>

      <div className="sidebarSearch">
        <div className="sidebarSearchField">
          <span className="sidebarSearchIcon" aria-hidden="true">
            <IconSearch size={16} />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search groups..."
            autoComplete="off"
          />
        </div>
      </div>

      <div className="sidebarSectionLabel">All Groups</div>

      <div className="sidebarList">
        {filtered.length === 0 ? (
          <div className="sidebarEmpty">No groups yet. Click + to create a new group.</div>
        ) : (
          filtered.map((group) => {
            const id = group.id;
            const meta = threads?.[id] || {};
            const unread = Number(meta.unread || 0);
            const time = meta.lastAt ? formatTimeDisplay(meta.lastAt) : "";
            const isSelected = selectedId === id;
            const sub = meta.lastText || `${group.memberCount || 0} members`;

            return (
              <motion.div
                key={id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className={`chatItem ${isSelected ? "active" : ""}`}
              >
                <button
                  className="chatItemMain"
                  onClick={() => onSelect?.({ ...group, kind: "group" })}
                  type="button"
                >
                  <div className="chatItemAvatarWrap">
                    <Avatar name={group.name} size={44} />
                  </div>

                  <div className="chatItemContent">
                    <div className="chatItemRowTop">
                      <span className="chatItemName">{group.name}</span>
                      {time && <span className="chatItemTime">{time}</span>}
                    </div>
                    <div className="chatItemRowBottom">
                      <span className="chatItemSub">{sub}</span>
                      {unread > 0 && <span className="chatItemUnreadBadge">{unread > 99 ? "99+" : unread}</span>}
                    </div>
                  </div>
                </button>
              </motion.div>
            );
          })
        )}
      </div>
    </aside>
  );
}
