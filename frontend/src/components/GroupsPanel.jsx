import { useMemo } from "react";
import { motion } from "framer-motion";
import Avatar from "./Avatar.jsx";
import { IconBack, IconImage, IconPlus, IconSparkles, IconUsers, IconVideo } from "./Icons.jsx";

function formatClock(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function mediaFromMessages(messages) {
  return [...(messages || [])]
    .filter((item) => !item?.deletedForEveryoneAt && item?.file && (item.file.url || item.file.name))
    .slice(-6)
    .reverse()
    .map((item, index) => ({
      id: item.id || `${item.file?.name || "media"}-${index}`,
      kind: item.file?.kind || "file",
      label: item.file?.name || (item.file?.kind === "image" ? "Photo" : item.file?.kind === "video" ? "Video" : "Document"),
      url: item.file?.url || "",
      at: item.createdAt || null
    }));
}

export default function GroupsPanel({
  className = "chat",
  group = null,
  threadMeta = null,
  messages = [],
  isMobile = false,
  onBack,
  onAddGroup,
  onOpenChat
}) {
  const media = useMemo(() => mediaFromMessages(messages), [messages]);
  const recentActivity = useMemo(() => {
    return [...(messages || [])]
      .filter(Boolean)
      .slice(-5)
      .reverse()
      .map((item, index) => ({
        id: item.id || `activity-${index}`,
        name: item.fromName || (item.from === group?.id ? group?.name : "Member"),
        text: String(item.text || "").trim() || item.file?.name || (item.file?.kind === "image" ? "Shared a photo" : "Shared an update"),
        at: item.createdAt || null
      }));
  }, [group?.id, group?.name, messages]);

  if (!group) {
    return (
      <main className={className}>
        <div className="sectionWorkspace groupsWorkspace">
          <div className="sectionBlankState">
            <div className="sectionBlankEyebrow">Groups</div>
            <div className="sectionBlankTitle">Pick a community space to explore</div>
            <div className="sectionBlankSub">
              Member activity, shared media, and project discussions will appear here once you open a group.
            </div>
            <button className="sectionPrimaryAction" type="button" onClick={onAddGroup}>
              <IconPlus className="btnSvg" size={16} />
              <span>Create group</span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  const cards = [
    { label: "Members", value: String(group.memberCount || 0) },
    { label: "Unread", value: String(threadMeta?.unread || 0) },
    { label: "Media", value: String(media.length) }
  ];

  return (
    <main className={className}>
      <div className="sectionWorkspace groupsWorkspace">
        <motion.section
          className="sectionHero groupPageHero"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="sectionHeroBackdrop groupPageBackdrop" aria-hidden="true" />
          <div className="sectionHeroTop">
            {isMobile && (
              <button className="sectionBackBtn" type="button" onClick={onBack} aria-label="Back to groups">
                <IconBack className="btnSvg" />
              </button>
            )}
            <span className="sectionHeroTag">Community</span>
          </div>
          <div className="sectionHeroMain">
            <div className="sectionHeroIdentity">
              <Avatar name={group.name || "Group"} url="" size={64} />
              <div>
                <div className="sectionHeroTitle">{group.name || "Untitled group"}</div>
                <div className="sectionHeroSub">{group.memberCount || 0} members active across chat, media, and updates</div>
              </div>
            </div>
            <div className="sectionHeroActions">
              <button className="sectionPrimaryAction" type="button" onClick={onOpenChat}>
                <IconSparkles className="btnSvg" size={16} />
                <span>Open conversation</span>
              </button>
              <button className="sectionSecondaryAction" type="button" onClick={onAddGroup}>
                <IconPlus className="btnSvg" size={16} />
                <span>New group</span>
              </button>
            </div>
          </div>
        </motion.section>

        <section className="sectionMetricGrid">
          {cards.map((card) => (
            <motion.div
              key={card.label}
              className="sectionMetricCard"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </motion.div>
          ))}
        </section>

        <section className="sectionContentGrid">
          <motion.article
            className="sectionCard communityActivityCard"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: 0.03 }}
          >
            <div className="sectionCardHeader">
              <div>
                <span className="sectionCardEyebrow">Member activity</span>
                <h3>Recent moments</h3>
              </div>
              <span className="sectionHeaderMeta">{messages.length} updates</span>
            </div>
            <div className="communityActivityList">
              {recentActivity.length > 0 ? (
                recentActivity.map((item) => (
                  <div key={item.id} className="communityActivityItem">
                    <div className="communityActivityAvatar">{item.name?.slice?.(0, 1) || "M"}</div>
                    <div className="communityActivityText">
                      <strong>{item.name}</strong>
                      <span>{item.text}</span>
                    </div>
                    <div className="communityActivityTime">{formatClock(item.at)}</div>
                  </div>
                ))
              ) : (
                <div className="communityActivityEmpty">Messages and member highlights will show up here as your group gets moving.</div>
              )}
            </div>
          </motion.article>

          <motion.article
            className="sectionCard communityMediaCard"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: 0.06 }}
          >
            <div className="sectionCardHeader">
              <div>
                <span className="sectionCardEyebrow">Media previews</span>
                <h3>Shared recently</h3>
              </div>
              <span className="sectionHeaderMeta">{media.length} files</span>
            </div>
            <div className="communityMediaGrid">
              {media.length > 0 ? (
                media.map((item) => (
                  <a key={item.id} className="communityMediaTile" href={item.url || "#"} target="_blank" rel="noreferrer">
                    <span className="communityMediaGlyph" aria-hidden="true">
                      {item.kind === "video" ? <IconVideo className="btnSvg" size={16} /> : <IconImage className="btnSvg" size={16} />}
                    </span>
                    <strong>{item.label}</strong>
                    <small>{formatClock(item.at) || "Recently shared"}</small>
                  </a>
                ))
              ) : (
                <div className="communityMediaEmpty">
                  Images, docs, and video clips from this group will surface here once members start sharing.
                </div>
              )}
            </div>
          </motion.article>
        </section>

        <motion.section
          className="sectionCard communityHighlightsCard"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: 0.09 }}
        >
          <div className="sectionCardHeader">
            <div>
              <span className="sectionCardEyebrow">Community cards</span>
              <h3>What makes this space active</h3>
            </div>
          </div>
          <div className="communityHighlightGrid">
            <div className="communityHighlightItem">
              <span className="communityHighlightIcon">
                <IconUsers className="btnSvg" size={16} />
              </span>
              <div>
                <strong>Shared participation</strong>
                <span>Keep quick discussions, files, and decision making in one room.</span>
              </div>
            </div>
            <div className="communityHighlightItem">
              <span className="communityHighlightIcon">
                <IconSparkles className="btnSvg" size={16} />
              </span>
              <div>
                <strong>Fast updates</strong>
                <span>Unread badges and recent activity make it easy to rejoin the flow.</span>
              </div>
            </div>
          </div>
        </motion.section>
      </div>
    </main>
  );
}
