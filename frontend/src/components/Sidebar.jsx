import { useMemo } from "react";
import { motion } from "framer-motion";
import Avatar from "./Avatar.jsx";
import { IconEdit, IconSearch, IconUserPlus } from "./Icons.jsx";

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

function getFirstName(fullName) {
  if (!fullName) return "";
  return fullName.trim().split(/\s+/)[0];
}

export default function Sidebar({
  className = "sidebar",
  isMobile = false,
  socketConnected,
  syncError,
  searchInput,
  filterText,
  onSearchChange,
  chatFilter = "all",
  onFilterChange,
  favoriteIds = [],
  contacts = [],
  groups = [],
  threads,
  typingById,
  selectedId,
  onSelect,
  onAddContact,
  onAddGroup
}) {
  const q = String(filterText ?? searchInput ?? "").trim().toLowerCase();
  const favSet = useMemo(() => new Set((favoriteIds || []).filter(Boolean)), [favoriteIds]);

  const allChats = useMemo(() => {
    const list = [
      ...(groups || []).map((g) => ({ ...g, kind: "group" })),
      ...(contacts || []).map((c) => ({ ...c, kind: "user" }))
    ];

    const filtered = list.filter((item) => {
      const id = item?.id;
      if (!id) return false;

      const meta = threads?.[id] || {};
      const unread = meta.unread || 0;

      if (chatFilter === "unread" && unread <= 0) return false;
      if (chatFilter === "favorites" && !favSet.has(id)) return false;
      if (chatFilter === "groups" && item.kind !== "group") return false;

      if (!q) return true;
      const name = String(item?.name || "").toLowerCase();
      const email = String(item?.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });

    filtered.sort((a, b) => {
      const ta = threads?.[a.id]?.lastAt ? new Date(threads[a.id].lastAt).getTime() : 0;
      const tb = threads?.[b.id]?.lastAt ? new Date(threads[b.id].lastAt).getTime() : 0;
      if (ta !== tb) return tb - ta;
      const na = String(a.name || a.email || "");
      const nb = String(b.name || b.email || "");
      return na.localeCompare(nb);
    });

    return filtered;
  }, [groups, contacts, threads, chatFilter, favSet, q]);

  // Stories / Active users for the top horizontal carousel
  const activeStories = useMemo(() => {
    const userContacts = (contacts || []).filter((c) => c && c.id);
    if (userContacts.length > 0) return userContacts;
    // Fallback if no contacts yet: return list of all chats
    return allChats.filter((item) => item.kind === "user");
  }, [contacts, allChats]);

  return (
    <aside className={className}>
      <div className="sidebarHeader">
        <div className="sidebarTitleWrap">
          <h1 className="sidebarTitle">Chats</h1>
          {!socketConnected && <span className="sidebarOfflineBadge">Offline</span>}
        </div>
        <div className="sidebarHeaderActions">
          <button
            className="sidebarHeaderActionBtn"
            type="button"
            onClick={onAddContact}
            aria-label="Add Contact"
            title="Add Contact"
          >
            <IconUserPlus size={19} />
          </button>
        </div>
      </div>

      {syncError && <div className="syncBanner">{syncError}</div>}

      <div className="sidebarSearch">
        <div className="sidebarSearchField">
          <span className="sidebarSearchIcon" aria-hidden="true">
            <IconSearch size={16} />
          </span>
          <input
            value={searchInput || ""}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Search messages or users"
            autoComplete="off"
          />
        </div>
      </div>

      {/* Active Contacts / Stories Carousel */}
      {activeStories.length > 0 && (
        <div className="sidebarStoriesSection" aria-label="Active users">
          <div className="sidebarStoriesTrack">
            {activeStories.map((contact) => {
              const name = contact.name || contact.email?.split("@")[0] || "User";
              const firstName = getFirstName(name);
              const isSelected = selectedId === contact.id;

              return (
                <button
                  key={contact.id}
                  className={`storyItem ${isSelected ? "selected" : ""}`}
                  type="button"
                  onClick={() => onSelect?.(contact)}
                  title={name}
                >
                  <div className="storyAvatarWrap">
                    <Avatar name={name} url={contact.avatarUrl} size={46} />
                    <span className="storyOnlineBadge" />
                  </div>
                  <span className="storyName">{firstName}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="sidebarSectionLabel">Recent</div>

      <div className="sidebarList">
        {allChats.length === 0 ? (
          <div className="sidebarEmpty">No chats found. Click + to start a new chat.</div>
        ) : (
          allChats.map((item) => {
            const id = item.id;
            const meta = threads?.[id] || {};
            const unread = Number(meta.unread || 0);
            const time = meta.lastAt ? formatTimeDisplay(meta.lastAt) : "";
            const isFav = favSet.has(id);
            const isSelected = selectedId === id;
            const title = item.kind === "group" ? item.name : item.name || item.email?.split("@")[0] || "User";

            let sub = "";
            if (item.kind === "user" && typingById?.[id]) {
              sub = "typing...";
            } else if (meta.lastText) {
              sub = meta.lastText;
            } else if (item.kind === "group") {
              sub = `${item.memberCount || 0} members`;
            } else {
              sub = item.email || "Available";
            }

            return (
              <motion.div
                key={id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className={`chatItem ${isSelected ? "active" : ""}`}
              >
                <button className="chatItemMain" onClick={() => onSelect?.(item)} type="button">
                  <div className="chatItemAvatarWrap">
                    <Avatar name={title} url={item.kind === "user" ? item.avatarUrl : ""} size={44} />
                    {item.kind === "user" && <span className="chatItemOnlineDot" />}
                  </div>

                  <div className="chatItemContent">
                    <div className="chatItemRowTop">
                      <span className="chatItemName">{title}</span>
                      {time && <span className="chatItemTime">{time}</span>}
                    </div>
                    <div className="chatItemRowBottom">
                      <span className={`chatItemSub ${typingById?.[id] ? "typing" : ""} ${String(sub).includes("Missed") ? "missedCall" : ""}`}>{sub}</span>
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
