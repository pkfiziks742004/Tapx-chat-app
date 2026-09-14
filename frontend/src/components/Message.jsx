import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import Avatar from "./Avatar.jsx";
import {
  IconCopy,
  IconDoc,
  IconDownload,
  IconForward,
  IconListCheck,
  IconMaximize,
  IconMoreVertical,
  IconPhone,
  IconPhoneMissed,
  IconPhoneOutgoing,
  IconPhoneIncoming,
  IconReply,
  IconTickDouble,
  IconTickSingle,
  IconTrash,
  IconVideo
} from "./Icons.jsx";
import VoiceNote from "./VoiceNote.jsx";

export function parseMessageReply(rawText) {
  if (typeof rawText !== "string") return { text: rawText || "", replyTo: null };
  const match = rawText.match(/^\[reply:([^\]]+)\]([\s\S]*)$/);
  if (!match) return { text: rawText, replyTo: null };
  try {
    const replyData = JSON.parse(decodeURIComponent(match[1]));
    return { text: match[2], replyTo: replyData };
  } catch (_e) {
    return { text: rawText, replyTo: null };
  }
}

export function formatMessageWithReply(text, replyTo) {
  if (!replyTo) return text;
  const snippet = {
    id: replyTo.id,
    senderName: replyTo.senderName || "User",
    text: String(replyTo.text || replyTo.file?.name || "Media attachment").slice(0, 120),
    kind: replyTo.file?.kind || "text"
  };
  return `[reply:${encodeURIComponent(JSON.stringify(snippet))}]${text}`;
}

function formatClock(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatBytes(bytes) {
  const b = Number(bytes || 0);
  if (!Number.isFinite(b) || b <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let n = b;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  const value = i === 0 ? String(Math.round(n)) : n.toFixed(n >= 10 ? 1 : 1);
  return `${value} ${units[i]}`;
}

function renderParsedText(rawText) {
  if (!rawText) return null;
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(rawText)) !== null) {
    if (match.index > lastIndex) {
      parts.push(rawText.substring(lastIndex, match.index));
    }
    const rawUrl = match[0];
    const href = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
    parts.push(
      <a
        key={match.index}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="messageLink"
        onClick={(e) => e.stopPropagation()}
      >
        {rawUrl}
      </a>
    );
    lastIndex = urlRegex.lastIndex;
  }

  if (lastIndex < rawText.length) {
    parts.push(rawText.substring(lastIndex));
  }

  return parts;
}

export default function Message({
  message,
  myId,
  peerName = "",
  peerAvatarUrl = "",
  myName = "",
  myAvatarUrl = "",
  selected = false,
  selectionMode = false,
  showTicks = true,
  onStartCall,
  onSelect,
  onReply,
  onCopy,
  onDelete,
  onForward,
  onDownload,
  onOpenMedia
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const m = message;

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  if (!m) return null;

  const isMe = m.from === myId;
  const status = m.readAt ? "read" : m.deliveredAt ? "delivered" : "sent";
  const TickIcon = status === "sent" ? IconTickSingle : IconTickDouble;
  const deleted = Boolean(m.deletedForEveryoneAt);
  const fileHref = !deleted && m.file?.url ? m.file.url : "";

  const senderName = isMe ? myName || "You" : m.fromName || peerName || "User";
  const senderAvatar = isMe ? myAvatarUrl : peerAvatarUrl;

  const parsed = parseMessageReply(m.text);
  const displayReply = m.replyTo || parsed.replyTo;
  const displayText = parsed.text;

  const isMissedCall = m.file?.kind === "missed_call" || String(displayText || "").toLowerCase().includes("missed");
  const isCallEvent = m.file?.kind === "call" || isMissedCall || String(displayText || "").toLowerCase().includes("call");
  const isVideoCall = m.file?.name === "video" || String(displayText || "").toLowerCase().includes("video");

  const isImageAttachment = !isCallEvent && (m.file?.kind === "image" || (m.file?.mime && m.file.mime.startsWith("image/")));
  const isVideoAttachment = !isCallEvent && (m.file?.kind === "video" || (m.file?.mime && m.file.mime.startsWith("video/")));
  const isAudioAttachment = !isCallEvent && (m.file?.kind === "audio" || (m.file?.mime && m.file.mime.startsWith("audio/")));
  const isDocAttachment = !isCallEvent && m.file && !isImageAttachment && !isVideoAttachment && !isAudioAttachment;

  const handleCopy = (e) => {
    e?.stopPropagation?.();
    setMenuOpen(false);
    onCopy?.({ ...m, text: displayText });
  };

  const handleReply = (e) => {
    e?.stopPropagation?.();
    setMenuOpen(false);
    onReply?.({ ...m, text: displayText, senderName });
  };

  const handleForward = (e) => {
    e?.stopPropagation?.();
    setMenuOpen(false);
    onForward?.(m);
  };

  const handleDelete = (e) => {
    e?.stopPropagation?.();
    setMenuOpen(false);
    onDelete?.(m);
  };

  const handleDownload = (e) => {
    e?.stopPropagation?.();
    setMenuOpen(false);
    onDownload?.(m);
  };

  const handleToggleSelect = (e) => {
    e?.stopPropagation?.();
    setMenuOpen(false);
    onSelect?.(m);
  };

  return (
    <motion.div
      id={`msg-${m.id}`}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={`messageRow ${isMe ? "outgoing" : "incoming"} ${selected ? "selected" : ""} ${isCallEvent ? "callRow" : ""} ${selectionMode ? "inSelectionMode" : ""}`}
      onClick={selectionMode ? handleToggleSelect : undefined}
      style={{ cursor: selectionMode ? "pointer" : "default" }}
    >
      {/* WhatsApp-style Selection Checkbox */}
      {selectionMode && (
        <div
          className="messageSelectCheckboxCol"
          onClick={handleToggleSelect}
        >
          <div className={`messageCheckboxCircle ${selected ? "checked" : ""}`}>
            {selected && <IconTickSingle size={14} className="messageCheckIcon" />}
          </div>
        </div>
      )}

      {/* Avatar on side */}
      <div className="messageAvatarCol">
        <Avatar name={senderName} url={senderAvatar} size={32} />
      </div>

      <div className="messageBodyCol">
        <div
          className={`messageBubble ${isMe ? "bubbleOutgoing" : "bubbleIncoming"} ${isCallEvent ? "callEventBubble" : ""}`}
          onDoubleClick={!deleted && !isCallEvent && !selectionMode ? handleReply : undefined}
        >
          {/* Top-right 3-dots context button */}
          <div className="messageDropdownWrap" ref={menuRef}>
            <button
              className="messageOptionsBtn"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              title="Message options"
              aria-label="Message options"
            >
              <IconMoreVertical size={15} />
            </button>

            {menuOpen && (
              <div className="messageDropdownMenu">
                {!deleted && (
                  <button type="button" onClick={handleReply}>
                    <IconReply size={15} />
                    <span>Reply</span>
                  </button>
                )}
                <button type="button" onClick={handleToggleSelect}>
                  <IconListCheck size={15} />
                  <span>Select</span>
                </button>
                {displayText && (
                  <button type="button" onClick={handleCopy}>
                    <IconCopy size={15} />
                    <span>Copy</span>
                  </button>
                )}
                {!deleted && (
                  <button type="button" onClick={handleForward}>
                    <IconForward size={15} />
                    <span>Forward</span>
                  </button>
                )}
                {fileHref && (
                  <button type="button" onClick={handleDownload}>
                    <IconDownload size={15} />
                    <span>Download</span>
                  </button>
                )}
                <div className="messageDropdownDivider" />
                <button className="danger" type="button" onClick={handleDelete}>
                  <IconTrash size={15} />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>

          {/* WhatsApp-style Quoted Reply Preview */}
          {displayReply && !deleted && (
            <div
              className="messageQuotedReply"
              onClick={(e) => {
                e.stopPropagation();
                const target = document.getElementById(`msg-${displayReply.id}`);
                if (target) {
                  target.scrollIntoView({ behavior: "smooth", block: "center" });
                  target.classList.add("messageHighlightPulse");
                  setTimeout(() => target.classList.remove("messageHighlightPulse"), 1600);
                }
              }}
              role="button"
              tabIndex={0}
              title="Click to jump to original message"
            >
              <div className="messageQuotedAccent" />
              <div className="messageQuotedContent">
                <span className="messageQuotedSender">{displayReply.senderName || "User"}</span>
                <span className="messageQuotedSnippet">{displayReply.text || "Attachment"}</span>
              </div>
            </div>
          )}



          {deleted ? (
            <div className="messageDeleted">🚫 This message was deleted</div>
          ) : isCallEvent ? (
            <div
              className={`messageCallCard ${isMissedCall && !isMe ? "missed" : "normal"} ${isMe ? "outgoing" : "incoming"}`}
              onClick={() => onStartCall?.(isVideoCall ? "video" : "audio")}
              role="button"
              tabIndex={0}
              title="Click to call back"
            >
              <div className={`messageCallIconWrap ${isMissedCall && !isMe ? "missed" : isMe ? "outgoing" : "incoming"}`}>
                {isVideoCall ? (
                  <IconVideo size={20} />
                ) : isMissedCall ? (
                  isMe ? <IconPhoneOutgoing size={20} /> : <IconPhoneMissed size={20} />
                ) : isMe ? (
                  <IconPhoneOutgoing size={20} />
                ) : (
                  <IconPhoneIncoming size={20} />
                )}
              </div>
              <div className="messageCallInfo">
                <div className="messageCallTitle">
                  {isMissedCall
                    ? isMe
                      ? (isVideoCall ? "Outgoing video call" : "Outgoing voice call")
                      : (isVideoCall ? "Missed video call" : "Missed voice call")
                    : (isVideoCall ? "Video call" : "Voice call")}
                </div>
                <div className="messageCallSub">
                  {isMissedCall ? (isMe ? "No answer" : "Click to call back") : (m.file?.mime || "Call ended")}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Media: Image Attachment */}
              {isImageAttachment && m.file?.url && (
                <div className="messageMediaGallery">
                  <div
                    className="messageImageCard"
                    onClick={() =>
                      onOpenMedia?.({
                        url: m.file.url,
                        kind: "image",
                        name: m.file.name,
                        mime: m.file.mime,
                        senderName,
                        senderAvatar,
                        timestamp: formatClock(m.createdAt),
                        caption: m.text
                      })
                    }
                    role="button"
                    tabIndex={0}
                    title="Click to view full photo"
                  >
                    <img className="messageImage" src={m.file.url} alt={m.file.name || "Attachment"} loading="lazy" />
                    <a
                      className="messageImageDownloadBtn"
                      href={m.file.url}
                      download={m.file.name || "download"}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title="Download image"
                    >
                      <IconDownload size={15} />
                    </a>
                  </div>
                </div>
              )}

              {/* Media: Video Attachment */}
              {isVideoAttachment && m.file?.url && (
                <div
                  className="messageVideoWrap"
                  onClick={() =>
                    onOpenMedia?.({
                      url: m.file.url,
                      kind: "video",
                      name: m.file.name,
                      mime: m.file.mime,
                      senderName,
                      senderAvatar,
                      timestamp: formatClock(m.createdAt),
                      caption: m.text
                    })
                  }
                  role="button"
                  tabIndex={0}
                  title="Click to view video"
                >
                  <video src={m.file.url} controls preload="metadata" className="messageVideo" />
                  <button
                    type="button"
                    className="messageVideoFullscreenBtn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenMedia?.({
                        url: m.file.url,
                        kind: "video",
                        name: m.file.name,
                        mime: m.file.mime,
                        senderName,
                        senderAvatar,
                        timestamp: formatClock(m.createdAt),
                        caption: m.text
                      });
                    }}
                    title="Open in WhatsApp viewer"
                  >
                    <IconMaximize size={15} />
                  </button>
                </div>
              )}

              {/* Media: Audio / Voice note */}
              {isAudioAttachment && m.file?.url && (
                <div className="messageAudioWrap">
                  <VoiceNote url={m.file.url} isMe={isMe} />
                </div>
              )}

              {/* Media: Document Card */}
              {isDocAttachment && (
                <div className="messageDocCard">
                  <div className="messageDocIcon">
                    <IconDoc size={20} />
                  </div>
                  <div className="messageDocMeta">
                    <span className="messageDocTitle">{m.file.name || "Document"}</span>
                    <span className="messageDocSize">{formatBytes(m.file.size) || "File"}</span>
                  </div>
                  {m.file.url && (
                    <a
                      className="messageDocDownload"
                      href={m.file.url}
                      download={m.file.name || "document"}
                      target="_blank"
                      rel="noreferrer"
                      title="Download document"
                    >
                      <IconDownload size={16} />
                    </a>
                  )}
                </div>
              )}

              {/* Message text with clickable links */}
              {String(displayText || "").trim() && (
                <div className="messageText">{renderParsedText(displayText)}</div>
              )}
            </>
          )}


          {/* Timestamp and ticks inside bubble */}
          <div className="messageMeta">
            <span className="messageClock">{formatClock(m.createdAt)}</span>
            {isMe && showTicks && !deleted && (
              <span className={`messageTicks ${status}`}>
                <TickIcon size={14} />
              </span>
            )}
          </div>
        </div>

        {/* Sender Name below the bubble */}
        <div className="messageSenderLabel">{senderName}</div>
      </div>
    </motion.div>
  );
}
