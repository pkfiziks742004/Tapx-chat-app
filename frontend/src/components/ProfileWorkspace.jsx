import { useMemo } from "react";
import { motion } from "framer-motion";
import Avatar from "./Avatar.jsx";
import { IconEdit, IconImage, IconSettings, IconSparkles, IconUsers } from "./Icons.jsx";

function buildGallery(messages = [], avatarUrl = "") {
  const fromMessages = [...messages]
    .filter((item) => !item?.deletedForEveryoneAt && item?.file && (item.file.url || item.file.name))
    .slice(-4)
    .reverse()
    .map((item, index) => ({
      id: item.id || `media-${index}`,
      title: item.file?.name || "Shared media",
      subtitle: item.file?.kind === "video" ? "Video clip" : item.file?.kind === "image" ? "Image preview" : "Document",
      url: item.file?.url || avatarUrl || "",
      kind: item.file?.kind || "file"
    }));

  if (fromMessages.length > 0) return fromMessages;

  return [
    {
      id: "fallback-1",
      title: "Profile moments",
      subtitle: "Recent uploads",
      url: avatarUrl,
      kind: "image"
    },
    {
      id: "fallback-2",
      title: "Pinned docs",
      subtitle: "Shared references",
      url: avatarUrl,
      kind: "file"
    }
  ];
}

export default function ProfileWorkspace({
  className = "chat",
  me,
  myEmail,
  contacts = [],
  groups = [],
  favoriteIds = [],
  threads = {},
  messages = [],
  onEditProfile,
  onOpenSettings
}) {
  const unreadTotal = Object.values(threads || {}).reduce((sum, item) => sum + (item?.unread || 0), 0);
  const gallery = useMemo(() => buildGallery(messages, me?.avatarUrl || ""), [messages, me?.avatarUrl]);

  const stats = [
    { label: "Contacts", value: String(contacts.length) },
    { label: "Groups", value: String(groups.length) },
    { label: "Favorites", value: String(favoriteIds.length) },
    { label: "Unread", value: String(unreadTotal) }
  ];

  return (
    <main className={className}>
      <div className="sectionWorkspace profileWorkspace">
        <motion.section
          className="sectionHero profilePageHero"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            className="sectionHeroBackdrop profilePageBackdrop"
            style={me?.avatarUrl ? { backgroundImage: `url(${me.avatarUrl})` } : undefined}
            aria-hidden="true"
          />
          <div className="profileHeroOverlay" />
          <div className="sectionHeroMain profileHeroMain">
            <div className="profileIdentityBlock">
              <Avatar name={me?.name || myEmail || "You"} url={me?.avatarUrl} size={72} />
              <div>
                <span className="sectionHeroTag">Your profile</span>
                <div className="sectionHeroTitle">{me?.name || "Complete your profile"}</div>
                <div className="sectionHeroSub">{me?.bio || myEmail || "Add a short intro, organize your media, and keep your workspace identity polished."}</div>
              </div>
            </div>
            <div className="sectionHeroActions">
              <button className="sectionPrimaryAction" type="button" onClick={onEditProfile}>
                <IconEdit className="btnSvg" size={16} />
                <span>Edit profile</span>
              </button>
              <button className="sectionSecondaryAction" type="button" onClick={onOpenSettings}>
                <IconSettings className="btnSvg" size={16} />
                <span>Open settings</span>
              </button>
            </div>
          </div>
        </motion.section>

        <section className="sectionMetricGrid">
          {stats.map((item) => (
            <motion.div
              key={item.label}
              className="sectionMetricCard"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </motion.div>
          ))}
        </section>

        <section className="sectionContentGrid profileContentGrid">
          <motion.article
            className="sectionCard profileSummaryCard"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: 0.03 }}
          >
            <div className="sectionCardHeader">
              <div>
                <span className="sectionCardEyebrow">About</span>
                <h3>Account summary</h3>
              </div>
            </div>
            <div className="profileSummaryList">
              <div className="profileSummaryRow">
                <span>Email</span>
                <strong>{myEmail || "Not available"}</strong>
              </div>
              <div className="profileSummaryRow">
                <span>Status</span>
                <strong>Realtime connected</strong>
              </div>
              <div className="profileSummaryRow">
                <span>Community reach</span>
                <strong>{groups.length} active spaces</strong>
              </div>
            </div>
          </motion.article>

          <motion.article
            className="sectionCard profileGalleryCard"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: 0.06 }}
          >
            <div className="sectionCardHeader">
              <div>
                <span className="sectionCardEyebrow">Media gallery</span>
                <h3>Recent visual assets</h3>
              </div>
            </div>
            <div className="profileGalleryGrid">
              {gallery.map((item) => (
                <a key={item.id} className="profileGalleryTile" href={item.url || "#"} target="_blank" rel="noreferrer">
                  <div
                    className="profileGalleryPreview"
                    style={item.url ? { backgroundImage: `url(${item.url})` } : undefined}
                    aria-hidden="true"
                  >
                    <span className="profileGalleryIcon">
                      <IconImage className="btnSvg" size={16} />
                    </span>
                  </div>
                  <strong>{item.title}</strong>
                  <small>{item.subtitle}</small>
                </a>
              ))}
            </div>
          </motion.article>
        </section>

        <motion.section
          className="sectionCard profileHighlightsCard"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: 0.09 }}
        >
          <div className="sectionCardHeader">
            <div>
              <span className="sectionCardEyebrow">Workspace identity</span>
              <h3>Keep your presence polished</h3>
            </div>
          </div>
          <div className="communityHighlightGrid">
            <div className="communityHighlightItem">
              <span className="communityHighlightIcon">
                <IconSparkles className="btnSvg" size={16} />
              </span>
              <div>
                <strong>Signature look</strong>
                <span>Use a banner, avatar, and short intro that feel consistent across chats and groups.</span>
              </div>
            </div>
            <div className="communityHighlightItem">
              <span className="communityHighlightIcon">
                <IconUsers className="btnSvg" size={16} />
              </span>
              <div>
                <strong>Visible to collaborators</strong>
                <span>Your profile makes conversations feel personal and professional from the first message.</span>
              </div>
            </div>
          </div>
        </motion.section>
      </div>
    </main>
  );
}
