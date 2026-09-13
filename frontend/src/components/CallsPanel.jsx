import { motion } from "framer-motion";
import Avatar from "./Avatar.jsx";
import { IconPhone, IconRefresh, IconSparkles, IconVideo } from "./Icons.jsx";

function formatClock(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function statusLabel(call) {
  const status = String(call?.status || "").toLowerCase();
  const direction = String(call?.direction || "").toLowerCase();
  if (status === "missed") return "Missed";
  if (status === "busy") return "Busy";
  if (status === "ringing") return direction === "outgoing" ? "Calling" : "Incoming ring";
  if (status === "connected") return "Connected";
  return direction === "outgoing" ? "Outgoing" : "Incoming";
}

export default function CallsPanel({
  className = "chat",
  calls = [],
  loading = false,
  onRefresh,
  onOpenChat,
  onOpenChats
}) {
  const list = Array.isArray(calls) ? calls.filter(Boolean) : [];
  const stats = [
    { label: "Audio", value: String(list.filter((call) => call?.media !== "video").length) },
    { label: "Video", value: String(list.filter((call) => call?.media === "video").length) },
    { label: "Missed", value: String(list.filter((call) => String(call?.status || "").toLowerCase() === "missed").length) }
  ];

  return (
    <main className={className}>
      <div className="sectionWorkspace callsWorkspace">
        <motion.section
          className="sectionHero callsPageHero"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="sectionHeroBackdrop callsPageBackdrop" aria-hidden="true" />
          <div className="sectionHeroMain">
            <div>
              <span className="sectionHeroTag">Voice + video</span>
              <div className="sectionHeroTitle">Call history that feels alive</div>
              <div className="sectionHeroSub">
                Review recent audio and video sessions, then jump straight back into the conversation when needed.
              </div>
            </div>
            <div className="sectionHeroActions">
              <button className="sectionPrimaryAction" type="button" onClick={onOpenChats}>
                <IconSparkles className="btnSvg" size={16} />
                <span>Open chats</span>
              </button>
              <button className="sectionSecondaryAction" type="button" onClick={() => onRefresh?.()}>
                <IconRefresh className="btnSvg" size={16} />
                <span>Refresh history</span>
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

        <motion.section
          className="sectionCard callsHistoryCard"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: 0.03 }}
        >
          <div className="sectionCardHeader">
            <div>
              <span className="sectionCardEyebrow">Recent calls</span>
              <h3>Continue where the conversation left off</h3>
            </div>
          </div>

          <div className="callsHistoryList">
            {loading && list.length === 0 ? (
              <div className="empty">Loading recent calls...</div>
            ) : list.length === 0 ? (
              <div className="empty">No call history yet. Start from any chat to build up your recents.</div>
            ) : (
              list.slice(0, 8).map((call) => {
                const peer = call.peer || {};
                const title = peer?.name || peer?.email || "Unknown";
                const media = call.media === "video" ? "video" : "audio";
                return (
                  <button key={call.id} className="callsHistoryRow" type="button" onClick={() => onOpenChat?.(call)}>
                    <Avatar name={title} url={peer?.avatarUrl} size={42} />
                    <div className="callsHistoryText">
                      <strong>{title}</strong>
                      <span>{statusLabel(call)}</span>
                    </div>
                    <div className="callsHistoryMeta">
                      <span className="callsHistoryBadge">
                        {media === "video" ? <IconVideo className="btnSvg" size={14} /> : <IconPhone className="btnSvg" size={14} />}
                        <span>{media === "video" ? "Video" : "Audio"}</span>
                      </span>
                      <small>{formatClock(call.createdAt)}</small>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </motion.section>

        <div className="floatingActionDock">
          <button className="floatingActionBtn primary" type="button" onClick={onOpenChats}>
            <IconPhone className="btnSvg" size={16} />
            <span>Start call</span>
          </button>
          <button className="floatingActionBtn" type="button" onClick={() => onRefresh?.()}>
            <IconRefresh className="btnSvg" size={16} />
            <span>Sync</span>
          </button>
        </div>
      </div>
    </main>
  );
}
