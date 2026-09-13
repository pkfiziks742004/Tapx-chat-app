import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Avatar from "./Avatar.jsx";
import {
  IconDownload,
  IconForward,
  IconMaximize,
  IconX,
  IconZoomIn,
  IconZoomOut
} from "./Icons.jsx";

export default function MediaViewerModal({
  media,
  onClose,
  onForward,
  onDownload
}) {
  const [zoom, setZoom] = useState(1);
  const videoRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      } else if (e.key === "+" || e.key === "=") {
        setZoom((z) => Math.min(3, z + 0.25));
      } else if (e.key === "-") {
        setZoom((z) => Math.max(0.5, z - 0.25));
      } else if (e.key === "0") {
        setZoom(1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!media || !media.url) return null;

  const isVideo =
    media.kind === "video" ||
    (media.mime && media.mime.startsWith("video/")) ||
    media.url.match(/\.(mp4|webm|mov|m4v|mkv)$/i);

  const isImage = !isVideo;

  const handleDownload = () => {
    if (onDownload) {
      onDownload(media);
    } else {
      const a = document.createElement("a");
      a.href = media.url;
      a.download = media.name || (isVideo ? "video.mp4" : "image.jpg");
      a.target = "_blank";
      a.rel = "noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="mediaViewerOverlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        {/* Top Header Bar */}
        <div className="mediaViewerHeader" onClick={(e) => e.stopPropagation()}>
          <div className="mediaViewerSender">
            <Avatar name={media.senderName || "User"} url={media.senderAvatar} size={40} />
            <div className="mediaViewerMeta">
              <span className="mediaViewerSenderName">{media.senderName || "User"}</span>
              <span className="mediaViewerTimestamp">{media.timestamp || "Shared media"}</span>
            </div>
          </div>

          <div className="mediaViewerActions">
            {isImage && (
              <>
                <button
                  type="button"
                  className="mediaViewerBtn"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                  title="Zoom In (+)"
                >
                  <IconZoomIn size={20} />
                </button>
                <button
                  type="button"
                  className="mediaViewerBtn"
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                  title="Zoom Out (-)"
                >
                  <IconZoomOut size={20} />
                </button>
                {zoom !== 1 && (
                  <button
                    type="button"
                    className="mediaViewerBtn textBtn"
                    onClick={() => setZoom(1)}
                    title="Reset Zoom (0)"
                  >
                    100%
                  </button>
                )}
              </>
            )}

            {isVideo && (
              <button
                type="button"
                className="mediaViewerBtn"
                onClick={handleFullscreen}
                title="Fullscreen"
              >
                <IconMaximize size={20} />
              </button>
            )}

            {onForward && (
              <button
                type="button"
                className="mediaViewerBtn"
                onClick={() => onForward(media)}
                title="Forward"
              >
                <IconForward size={20} />
              </button>
            )}

            <button
              type="button"
              className="mediaViewerBtn"
              onClick={handleDownload}
              title="Download"
            >
              <IconDownload size={20} />
            </button>

            <button
              type="button"
              className="mediaViewerBtn closeBtn"
              onClick={onClose}
              title="Close (Esc)"
            >
              <IconX size={22} />
            </button>
          </div>
        </div>

        {/* Center Media Body */}
        <div className="mediaViewerBody" onClick={(e) => e.stopPropagation()}>
          {isImage && (
            <motion.div
              className="mediaViewerImageWrap"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: zoom, opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <img
                src={media.url}
                alt={media.name || "Media"}
                className="mediaViewerImage"
                draggable={false}
              />
            </motion.div>
          )}

          {isVideo && (
            <div className="mediaViewerVideoWrap">
              <video
                ref={videoRef}
                src={media.url}
                controls
                autoPlay
                className="mediaViewerVideo"
              />
            </div>
          )}
        </div>

        {/* Bottom Caption Bar */}
        {media.caption && (
          <div className="mediaViewerFooter" onClick={(e) => e.stopPropagation()}>
            <p className="mediaViewerCaption">{media.caption}</p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
