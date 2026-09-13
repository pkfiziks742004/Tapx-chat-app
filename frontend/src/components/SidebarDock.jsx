import { IconChat, IconPhone, IconSettings, IconUsers } from "./Icons.jsx";

function DockBtn({ active = false, label, badge = 0, onClick, children }) {
  return (
    <button className={active ? "sidebarDockBtn active" : "sidebarDockBtn"} type="button" onClick={onClick} title={label}>
      <span className="sidebarDockIconWrap">
        {children}
        {badge > 0 && <span className="sidebarDockBadge">{badge > 99 ? "99+" : badge}</span>}
      </span>
      <span className="sidebarDockLabel">{label}</span>
    </button>
  );
}

export default function SidebarDock({
  active = "chats",
  unreadTotal = 0,
  onSelectChats,
  onOpenGroups,
  onOpenCalls,
  onOpenSettings
}) {
  return (
    <div className="sidebarDock" aria-label="Primary navigation">
      <DockBtn active={active === "chats"} label="Chats" badge={unreadTotal} onClick={onSelectChats}>
        <IconChat className="btnSvg" size={18} />
      </DockBtn>
      <DockBtn active={active === "groups"} label="Groups" onClick={onOpenGroups}>
        <IconUsers className="btnSvg" size={18} />
      </DockBtn>
      <DockBtn active={active === "calls"} label="Calls" onClick={onOpenCalls}>
        <IconPhone className="btnSvg" size={18} />
      </DockBtn>
      <DockBtn active={active === "settings"} label="Settings" onClick={onOpenSettings}>
        <IconSettings className="btnSvg" size={18} />
      </DockBtn>
    </div>
  );
}
