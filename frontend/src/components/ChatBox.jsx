import { useState, useMemo, useRef, useEffect } from "react";
import Avatar from "./Avatar.jsx";
import Message, { formatMessageWithReply } from "./Message.jsx";
import Composer from "./Composer.jsx";
import MediaViewerModal from "./MediaViewerModal.jsx";
import {
  IconBack,
  IconChat,
  IconCopy,
  IconDoc,
  IconDownload,
  IconForward,
  IconListCheck,
  IconMoreVertical,
  IconPhone,
  IconSearch,
  IconTrash,
  IconUser,
  IconUserPlus,
  IconVideo,
  IconX
} from "./Icons.jsx";

export default function ChatBox({
  className = "chat",
  selected,
  selectedCount = 0,
  selectedMessage = null,
  selectedMessageIds = [],
  selectedHasDeleted = false,
  isMobile,
  socketConnected,
  onBack,
  onStartCall,
  onDeleteChat,
  onSelectMessage,
  onSelectAllMessages,
  onClearSelectedMessage,
  onCopySelectedMessage,
  onDeleteSelectedMessage,
  onForwardSelectedMessage,
  onDownloadSelectedMessage,
  onReactSelectedMessage,
  onToggleInfoPanel,
  isPeerTyping,
  myId,
  me,
  messages,
  loadingMessages,
  loadError,
  sendError,
  messagesWrapRef,
  onMessagesScroll,
  onSend,
  onSendFile,
  onTyping,
  sending,
  onEmptySendDoc,
  onEmptyAddContact
}) {
  const [chatMenuOpen, setChatMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeMedia, setActiveMedia] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const chatMenuBtnRef = useRef(null);
  const chatMenuRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    setReplyingTo(null);
  }, [selected?.id]);

  const handleSendMessage = (text) => {
    const payload = formatMessageWithReply(text, replyingTo);
    setReplyingTo(null);
    return onSend?.(payload);
  };

  const handleSendFile = (file, caption = "") => {
    const payloadCaption = formatMessageWithReply(caption, replyingTo);
    setReplyingTo(null);
    return onSendFile?.(file, payloadCaption);
  };

  useEffect(() => {
    if (!searchOpen && !chatMenuOpen) return;
    const onDown = (e) => {
      const el = e.target;
      if (chatMenuBtnRef.current?.contains?.(el)) return;
      if (chatMenuRef.current?.contains?.(el)) return;
      if (searchRef.current?.contains?.(el)) return;
      setChatMenuOpen(false);
      setSearchOpen(false);
      setSearchQuery("");
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [searchOpen, chatMenuOpen]);

  const filteredMessages = useMemo(() => {
    const q = String(searchQuery || "").trim().toLowerCase();
    if (!q) return messages || [];
    return (messages || []).filter((m) => {
      if (!m) return false;
      if (String(m.text || "").toLowerCase().includes(q)) return true;
      if (String(m.file?.name || "").toLowerCase().includes(q)) return true;
      return false;
    });
  }, [messages, searchQuery]);

  if (!selected) {
    return (
      <main className={`${className} chatEmptyView`}>
        <div className="chatEmptyBox">
          <div className="chatEmptyIconWrap">
            <div className="chatEmptyLogoCircle">
              <IconChat size={34} />
            </div>
          </div>
          <h2 className="chatEmptyTitle">Select a chat to start messaging</h2>
          <p className="chatEmptySub">
            Choose a contact or group from the left sidebar to view conversation history, send messages, and share media.
          </p>
          <div className="chatEmptyActions">
            <button className="chatEmptyBtn" type="button" onClick={onEmptyAddContact}>
              <IconUserPlus size={18} />
              <span>New Conversation</span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  const selectionMode = selectedCount > 0;
  const isGroupChat = selected?.kind === "group";
  const peerTitle = selected.name || selected.email?.split("@")[0] || "User";
  const myName = me?.name || "You";

  return (
    <main className={className}>
      {/* Top Chat Header / Selection Header */}
      {selectionMode ? (
        <header className="chatTopHeader chatSelectionHeader">
          <div className="chatSelectionLeft">
            <button
              className="chatTopIconBtn"
              type="button"
              onClick={onClearSelectedMessage}
              title="Clear selection"
              aria-label="Clear selection"
            >
              <IconX size={18} />
            </button>
            <span className="chatSelectionCount">{selectedCount} selected</span>
          </div>
          <div className="chatSelectionRight">
            <button
              className="chatTopSelectAllBtn"
              type="button"
              onClick={onSelectAllMessages}
              title={selectedCount === (messages?.length || 0) ? "Unselect all" : "Select all"}
            >
              {selectedCount === (messages?.length || 0) ? "Unselect all" : "Select all"}
            </button>
            <button
              className="chatTopIconBtn"
              type="button"
              onClick={onCopySelectedMessage}
              title="Copy"
              aria-label="Copy"
            >
              <IconCopy size={18} />
            </button>
            {!selectedHasDeleted && (
              <button
                className="chatTopIconBtn"
                type="button"
                onClick={onForwardSelectedMessage}
                title="Forward"
                aria-label="Forward"
              >
                <IconForward size={18} />
              </button>
            )}
            <button
              className="chatTopIconBtn danger"
              type="button"
              onClick={onDeleteSelectedMessage}
              title="Delete"
              aria-label="Delete"
            >
              <IconTrash size={18} />
            </button>
          </div>
        </header>

      ) : (
        <header className="chatTopHeader">
          <div className="chatTopHeaderLeft">
            {isMobile && (
              <button className="chatTopBackBtn" type="button" onClick={onBack} aria-label="Back">
                <IconBack size={20} />
              </button>
            )}

            <div
              className="chatTopAvatarWrap"
              onClick={onToggleInfoPanel}
              role="button"
              tabIndex={0}
              title="View contact info"
              style={{ cursor: "pointer" }}
            >
              <Avatar name={peerTitle} url={!isGroupChat ? selected.avatarUrl : ""} size={38} />
              {!isGroupChat && <span className="chatTopOnlineDot" />}
            </div>

            <div
              className="chatTopInfo"
              onClick={onToggleInfoPanel}
              role="button"
              tabIndex={0}
              title="View contact info"
              style={{ cursor: "pointer" }}
            >
              <div className="chatTopNameRow">
                <span className="chatTopName">{peerTitle}</span>
                {!isGroupChat && <span className="chatTopStatusBadge" />}
              </div>
              {isPeerTyping ? (
                <span className="chatTopTypingText">typing...</span>
              ) : (
                <span className="chatTopSub">
                  {!isGroupChat ? "Online" : `${selected.members?.length || 0} members`}
                </span>
              )}
            </div>
          </div>

          {/* Right action buttons: Call, Video, Search, More menu */}
          <div className="chatTopHeaderRight">
            {searchOpen ? (
              <div className="chatTopSearchWrap" ref={searchRef}>
                <input
                  type="search"
                  className="chatTopSearchInput"
                  placeholder="Search messages..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                <button
                  className="chatTopIconBtn"
                  type="button"
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery("");
                  }}
                  title="Close search"
                >
                  <IconX size={16} />
                </button>
              </div>
            ) : (
              !isMobile && (
                <button
                  className="chatTopIconBtn"
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  title="Search messages"
                  aria-label="Search messages"
                >
                  <IconSearch size={18} />
                </button>
              )
            )}

            {!isGroupChat && onStartCall && (
              <button
                className="chatTopIconBtn"
                type="button"
                onClick={() => onStartCall?.("video")}
                title="Video Call"
                aria-label="Video Call"
              >
                <IconVideo size={18} />
              </button>
            )}

            {!isGroupChat && onStartCall && (
              <button
                className="chatTopIconBtn"
                type="button"
                onClick={() => onStartCall?.("audio")}
                title="Voice Call"
                aria-label="Voice Call"
              >
                <IconPhone size={18} />
              </button>
            )}

            {!isMobile && (
              <button
                className="chatTopIconBtn"
                type="button"
                onClick={onToggleInfoPanel}
                title="Contact Info"
                aria-label="Contact Info"
              >
                <IconUser size={18} />
              </button>
            )}

            <div className="chatTopMoreWrap">
              <button
                ref={chatMenuBtnRef}
                className="chatTopIconBtn"
                type="button"
                onClick={() => setChatMenuOpen(!chatMenuOpen)}
                title="More options"
                aria-label="More options"
              >
                <IconMoreVertical size={18} />
              </button>

              {chatMenuOpen && (
                <div className="chatTopDropdownMenu" ref={chatMenuRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setChatMenuOpen(false);
                      onToggleInfoPanel?.();
                    }}
                  >
                    <IconUser size={16} />
                    <span>{isGroupChat ? "Group info" : "Contact info / Profile"}</span>
                  </button>

                  {!isGroupChat && onStartCall && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setChatMenuOpen(false);
                          onStartCall?.("audio");
                        }}
                      >
                        <IconPhone size={16} />
                        <span>Voice call</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setChatMenuOpen(false);
                          onStartCall?.("video");
                        }}
                      >
                        <IconVideo size={16} />
                        <span>Video call</span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setChatMenuOpen(false);
                      setSearchOpen(true);
                    }}
                  >
                    <IconSearch size={16} />
                    <span>Search messages</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setChatMenuOpen(false);
                      if (messages && messages.length > 0) {
                        onSelectMessage?.(messages[messages.length - 1]);
                      }
                    }}
                  >
                    <IconListCheck size={16} />
                    <span>Select messages</span>
                  </button>

                  <div className="chatTopDropdownDivider" />


                  <button
                    type="button"
                    onClick={() => {
                      setChatMenuOpen(false);
                      onDeleteChat?.();
                    }}
                    className="danger"
                  >
                    <IconTrash size={16} />
                    <span>Clear Chat</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      {/* Messages Scroll View */}
      <div className="chatMessagesContainer" ref={messagesWrapRef} onScroll={onMessagesScroll}>
        {/* Date Divider Pill */}
        <div className="chatDateDivider">
          <span className="chatDatePill">Today</span>
        </div>

        {loadingMessages ? (
          <div className="chatLoadingText">Loading messages...</div>
        ) : loadError ? (
          <div className="chatErrorBanner">{loadError}</div>
        ) : filteredMessages.length === 0 ? (
          <div className="chatNoMessagesYet">No messages yet. Send a message to get started!</div>
        ) : (
          filteredMessages.map((msg) => (
            <Message
              key={msg.id}
              message={msg}
              myId={myId}
              peerName={peerTitle}
              peerAvatarUrl={selected.avatarUrl}
              myName={myName}
              myAvatarUrl={me?.avatarUrl}
              selected={selectedMessageIds.includes(msg.id)}
              selectionMode={selectionMode}
              onStartCall={onStartCall}
              onSelect={onSelectMessage}
              onReply={setReplyingTo}
              onCopy={onCopySelectedMessage}
              onDelete={onDeleteSelectedMessage}
              onForward={onForwardSelectedMessage}
              onDownload={onDownloadSelectedMessage}
              onOpenMedia={setActiveMedia}
            />
          ))
        )}

        {/* Real-time Purple Typing Bubble */}
        {isPeerTyping && (
          <div className="messageRow incoming typingRow">
            <div className="messageAvatarCol">
              <Avatar name={peerTitle} url={selected.avatarUrl} size={32} />
            </div>
            <div className="messageBodyCol">
              <div className="messageBubble bubbleIncoming typingBubble">
                <span>typing <span className="typingDots">•••</span></span>
              </div>
              <div className="messageSenderLabel">{peerTitle}</div>
            </div>
          </div>
        )}
      </div>

      {sendError && <div className="chatSendError">{sendError}</div>}

      {/* Bottom Composer */}
      <footer className="chatFooter">
        <Composer
          onSend={handleSendMessage}
          onSendFile={handleSendFile}
          onTyping={onTyping}
          sending={sending}
          disabled={selectionMode}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
        />
      </footer>


      {/* WhatsApp Fullscreen Media Lightbox Modal */}
      {activeMedia && (
        <MediaViewerModal
          media={activeMedia}
          onClose={() => setActiveMedia(null)}
          onForward={onForwardSelectedMessage}
          onDownload={onDownloadSelectedMessage}
        />
      )}
    </main>
  );
}
