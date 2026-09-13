import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import Avatar from "./Avatar.jsx";
import { IconDoc, IconImage, IconMic, IconMore, IconPhone, IconSearch, IconSettings, IconVideo, IconX } from "./Icons.jsx";

function PanelRow({ label, value, accent = false }) {
  return (
    <div className="infoPanelRow">
      <span>{label}</span>
      <strong className={accent ? "accent" : ""}>{value}</strong>
    </div>
  );
}

function PanelLinkRow({ label, value = "", danger = false }) {
  return (
    <div className={danger ? "infoPanelLinkRow danger" : "infoPanelLinkRow"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SharedMediaCard({ item }) {
  const label = item.name || (item.kind === "image" ? "Photo" : item.kind === "video" ? "Video" : "Shared file");
  const href = item.url || undefined;
  const CardTag = href ? "a" : "div";
  const cardProps = href ? { href, target: "_blank", rel: "noreferrer" } : {};

  if (item.kind === "image" && item.url) {
    return (
      <CardTag className="infoPanelMediaCard visual" {...cardProps}>
        <img src={item.url} alt={label} loading="lazy" />
        <span className="infoPanelMediaBadge">
          <IconImage className="btnSvg" size={12} />
          Photo
        </span>
      </CardTag>
    );
  }

  if (item.kind === "video" && item.url) {
    return (
      <CardTag className="infoPanelMediaCard visual" {...cardProps}>
        <video src={item.url} muted playsInline preload="metadata" />
        <span className="infoPanelMediaBadge">
          <IconVideo className="btnSvg" size={12} />
          Video
        </span>
      </CardTag>
    );
  }

  return (
    <CardTag className="infoPanelMediaCard file" {...cardProps}>
      <span className="infoPanelMediaIcon" aria-hidden="true">
        {item.kind === "audio" ? <IconMic className="btnSvg" size={16} /> : <IconDoc className="btnSvg" size={16} />}
      </span>
      <span className="infoPanelMediaText">
        <strong>{label}</strong>
        <small>{item.kind === "audio" ? "Voice note" : "Document"}</small>
      </span>
    </CardTag>
  );
}

export default function InfoPanel({
  className = "infoPanel",
  mode = "chats",
  selected = null,
  me = null,
  myEmail = "",
  messages = [],
  threadMeta = null,
  isFavorite = false,
  onStartCall,
  onOpenSettings,
  onClose,
  socketConnected
}) {
  const [muted, setMuted] = useState(false);
  const isGroup = selected?.kind === "group";

  const fileCount = useMemo(
    () => (messages || []).filter((m) => m?.file?.path || m?.file?.name).length,
    [messages]
  );

  const sharedMedia = useMemo(() => {
    return [...(messages || [])]
      .filter((m) => !m?.deletedForEveryoneAt && m?.file && (m.file.url || m.file.name))
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 4)
      .map((m, index) => ({
        id: m.id || `${m.file?.name || "media"}-${index}`,
        kind: m.file?.kind || "file",
        name: m.file?.name || "",
        url: m.file?.url || "",
        createdAt: m.createdAt || null
      }));
  }, [messages]);

  const sharedMediaLabel = useMemo(() => {
    if (fileCount <= 0) return "Nothing shared yet";
    if (fileCount === 1) return "1 shared item";
    return `${fileCount} shared items`;
  }, [fileCount]);

  const heroMetrics = useMemo(() => {
    if (!selected) return [];
    return [
      { label: isGroup ? "Members" : "Presence", value: isGroup ? String(selected.memberCount || 0) : socketConnected ? "Live" : "Idle" },
      { label: "Unread", value: String(threadMeta?.unread || 0) },
      { label: "Shared", value: String(fileCount || 0) }
    ];
  }, [fileCount, isGroup, selected, socketConnected, threadMeta?.unread]);

  const panelMotion = {
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] }
  };

  if (mode === "calls" || !selected) {
    return (
      <aside className={className}>
        <motion.div className="infoPanelCard infoPanelCardProfile" {...panelMotion}>
          <div className="infoPanelSectionTitle">Your Profile</div>
          <div className="infoPanelIdentity">
            <div className="avatarWithPresence">
              <Avatar name={me?.name || myEmail || "Me"} url={me?.avatarUrl} size={72} />
            </div>
            <div className="infoPanelIdentityText">
              <div className="infoPanelName">{me?.name || "Your profile"}</div>
              <div className={socketConnected ? "infoPanelStatus online" : "infoPanelStatus"}>
                {socketConnected ? "Online" : "Offline"}
              </div>
              <div className="infoPanelAbout">{me?.bio || "Open a conversation to view shared media, profile details, and quick actions."}</div>
            </div>
          </div>
          <div className="infoPanelHeroMetrics compact">
            <div className="infoPanelHeroMetric">
              <span>Status</span>
              <strong>{socketConnected ? "Synced" : "Paused"}</strong>
            </div>
            <div className="infoPanelHeroMetric">
              <span>Sections</span>
              <strong>5 views</strong>
            </div>
            <div className="infoPanelHeroMetric">
              <span>Identity</span>
              <strong>Live</strong>
            </div>
          </div>
          <div className="infoPanelActionGrid compact">
            <button className="infoPanelAction" type="button" onClick={onOpenSettings}>
              <IconSettings className="btnSvg" size={18} />
              <span>Settings</span>
            </button>
            <button className="infoPanelAction" type="button" onClick={onOpenSettings}>
              <IconSearch className="btnSvg" size={18} />
              <span>Explore</span>
            </button>
          </div>
        </motion.div>

        <motion.div className="infoPanelCard infoPanelCardWorkspace" {...panelMotion} transition={{ ...panelMotion.transition, delay: 0.04 }}>
          <div className="infoPanelSectionTitle">Workspace</div>
          <PanelRow label="Chats" value="Select one" accent />
          <PanelRow label="Calls" value="Audio + video" />
          <PanelRow label="Sync" value={socketConnected ? "Live" : "Paused"} />
        </motion.div>
      </aside>
    );
  }

  return (
    <aside className={className}>
      <motion.div className="infoPanelCard infoPanelCardHero" {...panelMotion}>
        <div className="infoPanelTopbar">
          <div className="infoPanelSectionTitle">Contact Info</div>
          <button className="infoPanelClose" type="button" onClick={onClose || onOpenSettings} aria-label="Close info panel">
            <IconX className="btnSvg" size={18} />
          </button>
        </div>
        <div className="infoPanelIdentity large">
          <div className={isGroup ? "avatarWithPresence group large" : "avatarWithPresence large"}>
            <Avatar name={selected.name || selected.email} url={!isGroup ? selected.avatarUrl : ""} size={96} />
          </div>
          <div className="infoPanelIdentityText centered">
            <div className="infoPanelName">{selected.name || selected.email}</div>
            <div className={socketConnected && !isGroup ? "infoPanelStatus online" : "infoPanelStatus"}>
              {isGroup ? `${selected.memberCount || 0} members` : socketConnected ? "Online" : "Available"}
            </div>
          </div>
        </div>

        <div className="infoPanelHeroMetrics">
          {heroMetrics.map((item) => (
            <div key={item.label} className="infoPanelHeroMetric">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>

        <div className="infoPanelActionGrid infoPanelActionGridHero">
          <button
            className="infoPanelAction infoPanelActionHero toneAccent"
            type="button"
            onClick={() => onStartCall?.("audio")}
            disabled={isGroup}
            aria-label="Audio"
            title="Audio"
          >
            <span className="infoPanelActionGlyph" aria-hidden="true">
              <IconPhone className="btnSvg" size={20} />
            </span>
            <span className="infoPanelActionLabel">Audio</span>
          </button>
          <button
            className="infoPanelAction infoPanelActionHero toneAccent"
            type="button"
            onClick={() => onStartCall?.("video")}
            disabled={isGroup}
            aria-label="Video"
            title="Video"
          >
            <span className="infoPanelActionGlyph" aria-hidden="true">
              <IconVideo className="btnSvg" size={20} />
            </span>
            <span className="infoPanelActionLabel">Video</span>
          </button>
          <button
            className="infoPanelAction infoPanelActionHero"
            type="button"
            onClick={onOpenSettings}
            aria-label="Search"
            title="Search"
          >
            <span className="infoPanelActionGlyph" aria-hidden="true">
              <IconSearch className="btnSvg" size={20} />
            </span>
            <span className="infoPanelActionLabel">Search</span>
          </button>
          <button
            className="infoPanelAction infoPanelActionHero"
            type="button"
            onClick={onOpenSettings}
            aria-label="More"
            title="More"
          >
            <span className="infoPanelActionGlyph" aria-hidden="true">
              <IconMore className="btnSvg" size={20} />
            </span>
            <span className="infoPanelActionLabel">More</span>
          </button>
        </div>
      </motion.div>

      <motion.div className="infoPanelCard infoPanelCardDetails" {...panelMotion} transition={{ ...panelMotion.transition, delay: 0.04 }}>
        <div className="infoPanelSectionTitle">About</div>
        <div className="infoPanelAbout">
          {selected.bio || (isGroup ? "Shared updates, files, and important conversations live here." : "Available for messages, calls, and shared files.")}
        </div>
        <div className="infoPanelRows">
          <PanelLinkRow label="Media, links and docs" value={String(fileCount || 0)} />
          <PanelLinkRow label="Unread messages" value={String(threadMeta?.unread || 0)} />
          <PanelLinkRow label="Conversation tier" value={isFavorite ? "Priority" : "Standard"} />
        </div>
      </motion.div>

      <motion.div className="infoPanelCard infoPanelCardMedia" {...panelMotion} transition={{ ...panelMotion.transition, delay: 0.08 }}>
        <div className="infoPanelSectionTitle">Shared media</div>
        {sharedMedia.length > 0 ? (
          <>
            <div className="infoPanelMediaGrid">
              {sharedMedia.map((item) => (
                <SharedMediaCard key={item.id} item={item} />
              ))}
            </div>
            <div className="infoPanelMediaMeta">
              <span>{sharedMediaLabel}</span>
              <strong>{sharedMedia[0]?.kind === "image" ? "Latest photo" : "Recent uploads"}</strong>
            </div>
          </>
        ) : (
          <div className="infoPanelMediaEmpty">Photos, videos, voice notes, and files from this chat will appear here.</div>
        )}
      </motion.div>

      <motion.div className="infoPanelCard infoPanelCardPrefs" {...panelMotion} transition={{ ...panelMotion.transition, delay: 0.12 }}>
        <div className="infoPanelToggleRow">
          <div>
            <div className="infoPanelToggleTitle">Mute notifications</div>
            <div className="infoPanelToggleSub">Keep this conversation quieter when you need focus.</div>
          </div>
          <button
            className={muted ? "infoPanelSwitch active" : "infoPanelSwitch"}
            type="button"
            onClick={() => setMuted((v) => !v)}
            aria-pressed={muted}
          >
            <span />
          </button>
        </div>
        <div className="infoPanelFooterStack">
          <PanelLinkRow label="Custom notifications" />
          <PanelLinkRow label="Media visibility" />
          <PanelLinkRow label="Disappearing messages" value="Off" />
          <PanelLinkRow label="Block contact" danger />
        </div>
      </motion.div>
    </aside>
  );
}
