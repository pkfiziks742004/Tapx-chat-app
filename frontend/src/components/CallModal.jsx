import { useEffect, useState } from "react";
import Avatar from "./Avatar.jsx";
import {
  IconCamera,
  IconCameraOff,
  IconMaximize,
  IconMic,
  IconMicOff,
  IconMinimize,
  IconPhoneEnd,
  IconScreenShare,
  IconSpeaker,
  IconSpeakerOff,
  IconVideo
} from "./Icons.jsx";

function formatDuration(ms) {
  const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function CallModal({
  title,
  media = "video",
  avatarUrl = "",
  remoteVideoOn = true,
  status = "Connecting...",
  startedAt = null,
  speakerOn = false,
  micOn = true,
  camOn = true,
  isScreenSharing = false,
  audioUnlockNeeded = false,
  upgradeNotice = "",
  onToggleSpeaker,
  onToggleMic,
  onToggleCam,
  onToggleScreenShare,
  onUpgradeToVideo,
  onUnlockAudio,
  onHangup,
  localVideoRef,
  remoteVideoRef,
  remoteAudioRef
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const isConnected = String(status || "").toLowerCase().includes("connected");
  const isVideo = media === "video";

  useEffect(() => {
    if (!isConnected || !startedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isConnected, startedAt]);

  const durationStr = isConnected && startedAt ? formatDuration(now - startedAt) : status;

  return (
    <div className={`callModalBackdrop ${isMinimized ? "minimized" : ""} ${isFullscreen ? "fullscreen" : ""}`}>
      <div className={`callPopupCard ${isVideo ? "videoCard" : "audioCard"} ${isMinimized ? "minimizedCard" : ""} ${isFullscreen ? "fullscreenCard" : ""}`}>
        {/* Hidden Audio element for remote sound */}
        <audio ref={remoteAudioRef} autoPlay playsInline />

        {/* Top Header Bar */}
        <div className="callPopupHeader">
          <div className="callPopupCallerInfo">
            <div className="callPopupCallerAvatar">
              <Avatar name={title || "User"} url={avatarUrl} size={36} />
            </div>
            <div className="callPopupCallerMeta">
              <span className="callPopupCallerName">{title || "Call"}</span>
              <span className={`callPopupStatus ${isConnected ? "connected" : "calling"}`}>
                <span className="callStatusDot" />
                {durationStr}
              </span>
            </div>
          </div>

          <div className="callPopupWindowActions">
            <button
              className="callWindowActionBtn"
              type="button"
              onClick={() => setIsMinimized(!isMinimized)}
              aria-label={isMinimized ? "Restore" : "Minimize"}
              title={isMinimized ? "Restore" : "Minimize"}
            >
              <IconMinimize size={16} />
            </button>
            <button
              className="callWindowActionBtn"
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              <IconMaximize size={16} />
            </button>
          </div>
        </div>

        {/* Main Stage View */}
        <div className="callPopupStage">
          {isVideo ? (
            <div className="callRemoteVideoWrap">
              <video
                ref={remoteVideoRef}
                className={`callRemoteVideo ${remoteVideoOn ? "visible" : "hidden"}`}
                autoPlay
                playsInline
              />

              {(!remoteVideoOn || !isConnected) && (
                <div className="callAvatarFallback">
                  <div className="callAvatarPulseRing">
                    <Avatar name={title || "User"} url={avatarUrl} size={110} />
                  </div>
                  <h3 className="callFallbackName">{title}</h3>
                  <span className="callFallbackStatus">
                    {!isConnected ? (status || "Connecting…") : "Camera is off"}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="callAudioStage">
              <div className="callAvatarPulseRing">
                <Avatar name={title || "User"} url={avatarUrl} size={110} />
              </div>
              <h3 className="callFallbackName">{title}</h3>
              <span className="callFallbackStatus">{durationStr}</span>
              {upgradeNotice && <div className="callUpgradeNotice">{upgradeNotice}</div>}
            </div>
          )}

          {/* Local PiP Video in corner (Only in video mode) */}
          {isVideo && (
            <div className={`callLocalPip ${isScreenSharing ? "sharing" : ""}`}>
              <video ref={localVideoRef} className="callLocalVideo" autoPlay playsInline muted />
              {!camOn && !isScreenSharing && (
                <div className="callLocalCamOff">
                  <IconCameraOff size={20} />
                  <span>Camera Off</span>
                </div>
              )}
              {isScreenSharing && <div className="callScreenShareBadge">Screen Sharing</div>}
            </div>
          )}

          {audioUnlockNeeded && (
            <div className="callAudioUnlockBanner">
              <button className="callAudioUnlockBtn" type="button" onClick={onUnlockAudio}>
                Tap to enable sound
              </button>
            </div>
          )}
        </div>

        {/* Floating Controls Dock */}
        <div className="callPopupControls">
          {/* Mute Mic Toggle */}
          <button
            className={`callControlBtn ${!micOn ? "muted" : ""}`}
            type="button"
            onClick={onToggleMic}
            aria-label={micOn ? "Mute Microphone" : "Unmute Microphone"}
            title={micOn ? "Mute Microphone" : "Unmute Microphone"}
          >
            {micOn ? <IconMic size={20} /> : <IconMicOff size={20} />}
          </button>

          {/* Camera Toggle or Switch to Video */}
          {isVideo ? (
            <button
              className={`callControlBtn ${!camOn ? "disabled" : ""}`}
              type="button"
              onClick={onToggleCam}
              aria-label={camOn ? "Turn Camera Off" : "Turn Camera On"}
              title={camOn ? "Turn Camera Off" : "Turn Camera On"}
            >
              {camOn ? <IconCamera size={20} /> : <IconCameraOff size={20} />}
            </button>
          ) : (
            <button
              className="callControlBtn upgradeVideoBtn"
              type="button"
              onClick={onUpgradeToVideo}
              aria-label="Switch to Video Call"
              title="Switch to Video Call"
            >
              <IconVideo size={20} />
            </button>
          )}

          {/* Screen Share Toggle (in Video mode) */}
          {isVideo && (
            <button
              className={`callControlBtn ${isScreenSharing ? "activeScreenShare" : ""}`}
              type="button"
              onClick={onToggleScreenShare}
              aria-label={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
              title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
            >
              <IconScreenShare size={20} />
            </button>
          )}

          {/* Speaker / Handsfree Toggle */}
          <button
            className={`callControlBtn ${speakerOn ? "speakerActive" : ""}`}
            type="button"
            onClick={onToggleSpeaker}
            aria-label={speakerOn ? "Speaker On" : "Speaker Off"}
            title={speakerOn ? "Speaker On" : "Speaker Off"}
          >
            {speakerOn ? <IconSpeaker size={20} /> : <IconSpeakerOff size={20} />}
          </button>

          {/* Hang Up Button */}
          <button
            className="callControlBtn endCallBtn"
            type="button"
            onClick={onHangup}
            aria-label="End Call"
            title="End Call"
          >
            <IconPhoneEnd size={22} />
          </button>
        </div>
      </div>
    </div>
  );
}
