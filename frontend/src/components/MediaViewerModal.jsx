import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Avatar from "./Avatar.jsx";
import {
  IconDownload,
  IconForward,
  IconMaximize,
  IconMinimize,
  IconRotate,
  IconRotateCcw,
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
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const videoRef = useRef(null);
  const viewerRef = useRef(null);

  const isVideo =
    media?.kind === "video" ||
    (media?.mime && media.mime.startsWith("video/")) ||
    media?.url?.match(/\.(mp4|webm|mov|m4v|mkv)$/i);

  const isImage = !isVideo;

  const handleReset = useCallback(() => {
    setZoom(1);
    setRotation(0);
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(4, Math.round((z + 0.25) * 100) / 100));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(0.5, Math.round((z - 0.25) * 100) / 100));
  }, []);

  const handleRotate = useCallback(() => {
    setRotation((r) => (r + 90) % 360);
  }, []);

  const handleRotateCcw = useCallback(() => {
    setRotation((r) => (r - 90 + 360) % 360);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      viewerRef.current?.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  const handleDownload = useCallback(async () => {
    if (!media?.url) return;
    if (onDownload) {
      onDownload(media);
      return;
    }

    setDownloading(true);
    try {
      const response = await fetch(media.url, { mode: "cors" });
      if (!response.ok) throw new Error("Network error");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const ext = isVideo ? "mp4" : "jpg";
      const cleanName = media.name || `tapx_media_${Date.now()}.${ext}`;
      a.download = cleanName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      // Fallback if CORS or network blocks blob fetch
      const a = document.createElement("a");
      a.href = media.url;
      a.download = media.name || (isVideo ? "video.mp4" : "image.jpg");
      a.target = "_blank";
      a.rel = "noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setDownloading(false);
    }
  }, [media, isVideo, onDownload]);

  // Double click toggles zoom
  const handleImageDoubleClick = useCallback(() => {
    setZoom((z) => (z === 1 ? 2 : 1));
  }, []);

  // Mouse wheel zoom
  const handleWheel = useCallback((e) => {
    if (e.deltaY < 0) {
      setZoom((z) => Math.min(4, Math.round((z + 0.15) * 100) / 100));
    } else {
      setZoom((z) => Math.max(0.5, Math.round((z - 0.15) * 100) / 100));
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "Escape") {
        onClose?.();
      } else if (e.key === "+" || e.key === "=") {
        handleZoomIn();
      } else if (e.key === "-") {
        handleZoomOut();
      } else if (e.key === "0") {
        handleReset();
      } else if (e.key === "r" || e.key === "R") {
        handleRotate();
      } else if (e.key === "f" || e.key === "F") {
        handleToggleFullscreen();
      } else if (e.key === "d" || e.key === "D") {
        handleDownload();
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [
    onClose,
    handleZoomIn,
    handleZoomOut,
    handleReset,
    handleRotate,
    handleToggleFullscreen,
    handleDownload
  ]);

  if (!media || !media.url) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={viewerRef}
        className="mediaViewerOverlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        {/* Top Header Bar */}
        <header className="mediaViewerHeader" onClick={(e) => e.stopPropagation()}>
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
                  onClick={handleZoomIn}
                  title="Zoom in (+)"
                  aria-label="Zoom in"
                >
                  <IconZoomIn size={20} />
                </button>
                <button
                  type="button"
                  className="mediaViewerBtn"
                  onClick={handleZoomOut}
                  title="Zoom out (-)"
                  aria-label="Zoom out"
                >
                  <IconZoomOut size={20} />
                </button>
                <button
                  type="button"
                  className="mediaViewerBtn"
                  onClick={handleRotate}
                  title="Rotate 90° (R)"
                  aria-label="Rotate clockwise"
                >
                  <IconRotate size={20} />
                </button>
                <button
                  type="button"
                  className="mediaViewerBtn"
                  onClick={handleRotateCcw}
                  title="Rotate counter-clockwise"
                  aria-label="Rotate counter-clockwise"
                >
                  <IconRotateCcw size={20} />
                </button>
                {(zoom !== 1 || rotation !== 0) && (
                  <button
                    type="button"
                    className="mediaViewerBtn textBtn"
                    onClick={handleReset}
                    title="Reset view (0)"
                    aria-label="Reset zoom and rotation"
                  >
                    {Math.round(zoom * 100)}%
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              className="mediaViewerBtn"
              onClick={handleToggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
              aria-label="Toggle fullscreen"
            >
              {isFullscreen ? <IconMinimize size={20} /> : <IconMaximize size={20} />}
            </button>

            {onForward && (
              <button
                type="button"
                className="mediaViewerBtn"
                onClick={() => onForward(media)}
                title="Forward media"
                aria-label="Forward media"
              >
                <IconForward size={20} />
              </button>
            )}

            <button
              type="button"
              className={`mediaViewerBtn ${downloading ? "loading" : ""}`}
              onClick={handleDownload}
              title="Download media (D)"
              aria-label="Download media"
              disabled={downloading}
            >
              <IconDownload size={20} />
            </button>

            <button
              type="button"
              className="mediaViewerBtn closeBtn"
              onClick={onClose}
              title="Close (Esc)"
              aria-label="Close viewer"
            >
              <IconX size={22} />
            </button>
          </div>
        </header>

        {/* Center Media Body */}
        <div
          className="mediaViewerBody"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onClose?.();
            }
          }}
          onWheel={isImage ? handleWheel : undefined}
        >
          {isImage && (
            <motion.div
              className={`mediaViewerImageWrap ${zoom > 1 ? "isZoomed" : ""}`}
              drag={zoom > 1}
              dragConstraints={{ left: -400 * zoom, right: 400 * zoom, top: -300 * zoom, bottom: 300 * zoom }}
              dragElastic={0.1}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={handleImageDoubleClick}
              style={{
                cursor: zoom > 1 ? "grab" : "zoom-in"
              }}
              whileTap={{ cursor: zoom > 1 ? "grabbing" : "zoom-in" }}
            >
              <motion.img
                src={media.url}
                alt={media.name || "Media"}
                className="mediaViewerImage"
                draggable={false}
                animate={{
                  scale: zoom,
                  rotate: rotation
                }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 25
                }}
              />
            </motion.div>
          )}

          {isVideo && (
            <div className="mediaViewerVideoWrap" onClick={(e) => e.stopPropagation()}>
              <video
                ref={videoRef}
                src={media.url}
                controls
                autoPlay
                playsInline
                className="mediaViewerVideo"
              />
            </div>
          )}
        </div>

        {/* Bottom Caption Bar */}
        {media.caption && (
          <footer className="mediaViewerFooter" onClick={(e) => e.stopPropagation()}>
            <p className="mediaViewerCaption">{media.caption}</p>
          </footer>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

