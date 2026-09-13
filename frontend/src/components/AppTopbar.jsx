import Avatar from "./Avatar.jsx";
import { IconBell, IconChevronDown, IconMoon, IconSearch, IconSparkles, IconSun } from "./Icons.jsx";

export default function AppTopbar({
  mode = "chats",
  me,
  myEmail,
  theme = "dark",
  searchValue = "",
  onSearchChange,
  unreadTotal = 0,
  onToggleTheme,
  onOpenProfile,
  onOpenSettings
}) {
  const badge = Math.max(0, Number(unreadTotal || 0) || 0);
  const usingLightTheme = theme === "light";
  const nextThemeLabel = usingLightTheme ? "dark" : "light";
  const viewMeta =
    mode === "calls"
      ? {
          label: "Calls",
          detail: "Audio, video, and recent activity",
          placeholder: "Search call history, people, and recents"
        }
      : mode === "groups"
        ? {
            label: "Groups",
            detail: "Community spaces, media, and members",
            placeholder: "Search groups, members, and shared media"
          }
        : mode === "profile"
          ? {
              label: "Profile",
              detail: "Identity, banner, and shared media",
              placeholder: "Search profile media, files, and notes"
            }
          : mode === "settings"
            ? {
                label: "Settings",
                detail: "Appearance, privacy, and controls",
                placeholder: "Search settings, privacy, and preferences"
              }
            : {
                label: "Inbox",
                detail: "Realtime messages, files, and collaboration",
                placeholder: "Search chats, people, and files"
              };

  return (
    <header className="appTopbar">
      <div className="appBrand">
        <div className="appBrandGlow" aria-hidden="true" />
        <img className="appBrandLogo" src="/fev.png" alt="AeroChat" />
        <div className="appBrandText">
          <span className="appBrandEyebrow">Premium realtime workspace</span>
          <div className="appBrandHeading">
            <strong>AeroChat</strong>
            <span className="appViewChip">{viewMeta.label}</span>
          </div>
          <div className="appBrandMetaRow">
            <span>{viewMeta.detail}</span>
            <span className="appBrandStatus">
              <IconSparkles className="btnSvg" size={12} />
              Live sync
            </span>
          </div>
        </div>
      </div>

      <label className="appTopbarSearch" aria-label="Search conversations">
        <span className="appTopbarSearchIcon" aria-hidden="true">
          <IconSearch className="btnSvg" size={16} />
        </span>
        <input
          type="search"
          value={searchValue}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder={viewMeta.placeholder}
          autoComplete="off"
        />
        <span className="appTopbarShortcut" aria-hidden="true">
          Ctrl K
        </span>
      </label>

      <div className="appTopbarActions">
        <button
          className="topbarIconBtn topbarThemeBtn"
          type="button"
          onClick={onToggleTheme}
          aria-label={`Switch to ${nextThemeLabel} mode`}
          title={`Switch to ${nextThemeLabel} mode`}
        >
          {usingLightTheme ? <IconMoon className="btnSvg" size={16} /> : <IconSun className="btnSvg" size={16} />}
        </button>
        <button className="topbarIconBtn topbarNotify" type="button" onClick={onOpenSettings} aria-label="Notifications">
          <IconBell className="btnSvg" size={16} />
          {badge > 0 && <span className="topbarNotifyBadge">{badge > 99 ? "99+" : badge}</span>}
        </button>
        <button className="appProfileBtn" type="button" onClick={onOpenProfile}>
          <Avatar name={me?.name || myEmail || "Me"} url={me?.avatarUrl} size={26} />
          <div className="appProfileText">
            <strong>{me?.name || "Your profile"}</strong>
            <span>{myEmail || "Online"}</span>
          </div>
          <IconChevronDown className="btnSvg" size={14} />
        </button>
        {/* <div className="appWindowControls" aria-hidden="true">
          <span className="appWindowControl minimize" />
          <span className="appWindowControl maximize" />
          <span className="appWindowControl close" />
        </div> */}
      </div>
    </header>
  );
}
