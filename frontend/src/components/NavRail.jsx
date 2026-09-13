import Avatar from "./Avatar.jsx";
import {
  IconChat,
  IconChatLogo,
  IconMoon,
  IconPhone,
  IconSettings,
  IconSun,
  IconUser,
  IconUserPlus,
  IconUsers
} from "./Icons.jsx";

export default function NavRail({
  className = "rail",
  isMobile = false,
  active = "chats",
  unreadTotal = 0,
  theme = "light",
  me,
  myEmail,
  onSelectChats,
  onOpenCalls,
  onOpenGroups,
  onOpenContacts,
  onOpenSettings,
  onOpenProfile,
  onToggleTheme
}) {
  const badge = Math.max(0, Number(unreadTotal || 0) || 0);
  const isDark = theme === "dark";

  if (isMobile) {
    return (
      <nav className={className} aria-label="Primary navigation">
        <button
          className={active === "profile" ? "railBtn active" : "railBtn"}
          type="button"
          onClick={onOpenProfile}
          aria-label="Profile"
          title="Profile"
        >
          <IconUser className="railIcon" size={22} />
          <span className="railLabel">Profile</span>
        </button>

        <button
          className={active === "chats" ? "railBtn active" : "railBtn"}
          type="button"
          onClick={onSelectChats}
          aria-label="Chats"
          title="Chats"
        >
          <IconChat className="railIcon" size={22} />
          {badge > 0 && <span className="railBadge">{badge > 99 ? "99+" : badge}</span>}
          <span className="railLabel">Chats</span>
        </button>

        <button
          className={active === "calls" ? "railBtn active" : "railBtn"}
          type="button"
          onClick={onOpenCalls}
          aria-label="Calls"
          title="Calls"
        >
          <IconPhone className="railIcon" size={22} />
          <span className="railLabel">Calls</span>
        </button>

        <button
          className={active === "groups" ? "railBtn active" : "railBtn"}
          type="button"
          onClick={onOpenGroups}
          aria-label="Groups"
          title="Groups"
        >
          <IconUsers className="railIcon" size={22} />
          <span className="railLabel">Groups</span>
        </button>

        <button
          className={active === "contacts" ? "railBtn active" : "railBtn"}
          type="button"
          onClick={onOpenContacts || onSelectChats}
          aria-label="Contacts"
          title="Contacts"
        >
          <IconUserPlus className="railIcon" size={22} />
          <span className="railLabel">Contacts</span>
        </button>

        <button
          className={active === "settings" ? "railBtn active" : "railBtn"}
          type="button"
          onClick={onOpenSettings}
          aria-label="Settings"
          title="Settings"
        >
          <IconSettings className="railIcon" size={22} />
          <span className="railLabel">Settings</span>
        </button>
      </nav>
    );
  }

  return (
    <nav className={className} aria-label="Primary navigation">
      <div className="railTop">
        <div className="railLogo" aria-label="Logo" onClick={onSelectChats} role="button" tabIndex={0}>
          <img className="railLogoImg" src="/fev.png" alt="Logo" />
        </div>

        <button
          className={active === "profile" ? "railBtn active" : "railBtn"}
          type="button"
          onClick={onOpenProfile}
          aria-label="Profile"
          title="Profile"
        >
          <IconUser className="railIcon" size={22} />
        </button>

        <button
          className={active === "chats" ? "railBtn active" : "railBtn"}
          type="button"
          onClick={onSelectChats}
          aria-label="Chats"
          title="Chats"
        >
          <IconChat className="railIcon" size={22} />
          {badge > 0 && <span className="railBadge">{badge > 99 ? "99+" : badge}</span>}
        </button>

        <button
          className={active === "calls" ? "railBtn active" : "railBtn"}
          type="button"
          onClick={onOpenCalls}
          aria-label="Calls"
          title="Calls"
        >
          <IconPhone className="railIcon" size={22} />
        </button>

        <button
          className={active === "groups" ? "railBtn active" : "railBtn"}
          type="button"
          onClick={onOpenGroups}
          aria-label="Groups"
          title="Groups"
        >
          <IconUsers className="railIcon" size={22} />
        </button>

        <button
          className={active === "contacts" ? "railBtn active" : "railBtn"}
          type="button"
          onClick={onOpenContacts || onSelectChats}
          aria-label="Contacts"
          title="Contacts"
        >
          <IconUserPlus className="railIcon" size={22} />
        </button>

        <button
          className={active === "settings" ? "railBtn active" : "railBtn"}
          type="button"
          onClick={onOpenSettings}
          aria-label="Settings"
          title="Settings"
        >
          <IconSettings className="railIcon" size={22} />
        </button>
      </div>

      <div className="railBottom">
        {onToggleTheme && (
          <button
            className="railThemeBtn"
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <IconSun className="railIcon" size={20} /> : <IconMoon className="railIcon" size={20} />}
          </button>
        )}

        <button
          className="railAvatarBtn"
          type="button"
          onClick={onOpenProfile}
          aria-label="Your profile"
          title={me?.name || myEmail || "Profile"}
        >
          <div className="railAvatarWrap">
            <Avatar name={me?.name || myEmail || "Me"} url={me?.avatarUrl} size={36} />
            <span className="railOnlineDot" aria-label="Online" />
          </div>
        </button>
      </div>
    </nav>
  );
}
