import Avatar from "./Avatar.jsx";
import {
  IconBack,
  IconCamera,
  IconChat,
  IconEmoji,
  IconMore,
  IconPaperclip,
  IconPhone,
  IconSearch,
  IconSend,
  IconSettings,
  IconUsers,
  IconVideo
} from "./Icons.jsx";

function formatClock(iso) {
  if (!iso) return "Now";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Now";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function PhoneListMock({ items = [], selectedId = "", threadMap = {} }) {
  return (
    <div className="phoneMockup">
      <div className="phoneNotch" />
      <div className="phoneScreen">
        <div className="phoneStatusBar">
          <strong>9:41</strong>
          <div className="phoneStatusIcons">
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="phoneTopbar">
          <div className="phoneBrand">
            <img src="/fev.png" alt="AeroChat" />
            <span>AeroChat</span>
          </div>
          <div className="phoneTopIcons">
            <IconCamera className="btnSvg" size={15} />
            <IconMore className="btnSvg" size={15} />
          </div>
        </div>
        <div className="phoneSearch">
          <IconSearch className="btnSvg" size={14} />
          <span>Search chats</span>
        </div>
        <div className="phoneFilters">
          <span className="active">All</span>
          <span>Unread</span>
          <span>Groups</span>
        </div>
        <div className="phoneList">
          {items.map((item) => {
            const meta = threadMap?.[item.id] || {};
            const unread = meta.unread || 0;
            const title = item.name || item.email || "Unknown";
            return (
              <div key={item.id} className={selectedId === item.id ? "phoneListItem active" : "phoneListItem"}>
                <div className="avatarWithPresence">
                  <Avatar name={title} url={item.avatarUrl} size={40} />
                </div>
                <div className="phoneListText">
                  <div className="phoneListTop">
                    <strong>{title}</strong>
                    <span>{formatClock(meta.lastAt)}</span>
                  </div>
                  <div className="phoneListBottom">
                    <span>{meta.lastText || item.email || "Start chatting"}</span>
                    {unread > 0 && <b>{unread > 9 ? "9+" : unread}</b>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="phoneDock">
          <button className="active" type="button">
            <IconChat className="btnSvg" size={18} />
            <span>Chats</span>
          </button>
          <button type="button">
            <IconPhone className="btnSvg" size={18} />
            <span>Calls</span>
          </button>
          <button type="button">
            <IconUsers className="btnSvg" size={18} />
            <span>Contacts</span>
          </button>
          <button type="button">
            <IconSettings className="btnSvg" size={18} />
            <span>Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function PhoneChatMock({ selected = null, messages = [] }) {
  const title = selected?.name || selected?.email || "Preview";
  return (
    <div className="phoneMockup tall">
      <div className="phoneNotch" />
      <div className="phoneScreen">
        <div className="phoneStatusBar">
          <strong>9:41</strong>
          <div className="phoneStatusIcons">
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="phoneChatHeader">
          <button className="phoneIconBtn" type="button" aria-label="Back">
            <IconBack className="btnSvg" size={16} />
          </button>
          <div className="phoneChatIdentity">
            <div className="avatarWithPresence">
              <Avatar name={title} url={selected?.avatarUrl} size={32} />
            </div>
            <div className="phoneChatHeaderText">
              <strong>{title}</strong>
              <span>Online</span>
            </div>
          </div>
          <div className="phoneHeaderActions">
            <IconPhone className="btnSvg" size={14} />
            <IconVideo className="btnSvg" size={14} />
            <IconMore className="btnSvg" size={14} />
          </div>
        </div>
        <div className="phoneChatBody">
          <div className="phoneDayPill">Today</div>
          {messages.map((m) => (
            <div
              key={m.id || `${m.from}-${m.createdAt}`}
              className={m.from === "me" ? "phoneBubbleRow me" : "phoneBubbleRow"}
            >
              <div className={m.from === "me" ? "phoneBubble me" : "phoneBubble"}>
                <div>{m.text || "Message"}</div>
                <small>{formatClock(m.createdAt)}</small>
              </div>
            </div>
          ))}
        </div>
        <div className="phoneComposer">
          <IconEmoji className="btnSvg" size={15} />
          <IconPaperclip className="btnSvg" size={15} />
          <span className="phoneComposerText">Type a message...</span>
          <button type="button" aria-label="Send">
            <IconSend className="btnSvg" size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ShowcasePhoneColumn({ contacts = [], selected = null, messages = [], threads = {}, myId = "" }) {
  const previewItems = contacts.slice(0, 6);
  const previewMessages = (messages || [])
    .filter((m) => String(m?.text || "").trim())
    .slice(-4)
    .map((m) => ({ ...m, from: m.from === myId ? "me" : "them" }));

  return (
    <div className="showcasePhones">
      <PhoneListMock items={previewItems} selectedId={selected?.id || ""} threadMap={threads} />
      <PhoneChatMock selected={selected} messages={previewMessages} />
    </div>
  );
}
