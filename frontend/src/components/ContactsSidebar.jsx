import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import Avatar from "./Avatar.jsx";
import { IconChat, IconPlus, IconSearch } from "./Icons.jsx";

export default function ContactsSidebar({
  className = "sidebar",
  isMobile = false,
  socketConnected,
  contacts = [],
  selectedId = "",
  onSelect,
  onAddContact
}) {
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    const list = Array.isArray(contacts) ? contacts.filter((c) => c && c.id) : [];

    const filtered = list.filter((c) => {
      if (!q) return true;
      const name = String(c?.name || "").toLowerCase();
      const email = String(c?.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });

    filtered.sort((a, b) => {
      const na = String(a.name || a.email || "");
      const nb = String(b.name || b.email || "");
      return na.localeCompare(nb);
    });

    const map = {};
    for (const item of filtered) {
      const name = String(item.name || item.email || "Unknown").trim();
      const firstChar = (name[0] || "#").toUpperCase();
      const key = /[A-Z]/.test(firstChar) ? firstChar : "#";
      if (!map[key]) map[key] = [];
      map[key].push(item);
    }

    return Object.entries(map).sort(([a], [b]) => {
      if (a === "#") return 1;
      if (b === "#") return -1;
      return a.localeCompare(b);
    });
  }, [contacts, query]);

  return (
    <aside className={className}>
      <div className="sidebarHeader">
        <div className="sidebarTitleWrap">
          <h1 className="sidebarTitle">Contacts</h1>
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
            placeholder="Search contacts..."
            autoComplete="off"
          />
        </div>
      </div>

      <div className="sidebarList contactsList">
        {grouped.length === 0 ? (
          <div className="sidebarEmpty">No contacts found. Click + to add a contact.</div>
        ) : (
          grouped.map(([letter, items]) => (
            <div key={letter} className="contactsGroup">
              <div className="contactsGroupLetter">{letter}</div>
              {items.map((contact) => {
                const isSelected = selectedId === contact.id;
                const name = contact.name || contact.email?.split("@")[0] || "User";

                return (
                  <motion.div
                    key={contact.id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                    className={`contactItem ${isSelected ? "active" : ""}`}
                  >
                    <button
                      className="contactItemMain"
                      type="button"
                      onClick={() => onSelect?.({ ...contact, kind: "user" })}
                    >
                      <div className="contactItemAvatar">
                        <Avatar name={name} url={contact.avatarUrl} size={40} />
                      </div>
                      <div className="contactItemInfo">
                        <span className="contactItemName">{name}</span>
                        {contact.email && <span className="contactItemEmail">{contact.email}</span>}
                      </div>
                      <div className="contactItemAction">
                        <IconChat size={16} />
                      </div>
                    </button>
                  </motion.div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
