import { useEffect, useRef, useState } from "react";
import {
  IconCamera,
  IconDoc,
  IconImage,
  IconMic,
  IconPaperclip,
  IconSend,
  IconSmile,
  IconStop,
  IconTrash,
  IconX
} from "./Icons.jsx";

function formatDuration(ms) {
  const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function pickRecordingMime() {
  if (typeof window === "undefined") return "";
  const MR = window.MediaRecorder;
  if (!MR || typeof MR.isTypeSupported !== "function") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4"
  ];
  for (const c of candidates) if (MR.isTypeSupported(c)) return c;
  return "";
}

function extForMime(mime) {
  const m = String(mime || "").toLowerCase();
  if (m.includes("mp4")) return "m4a";
  if (m.includes("mpeg")) return "mp3";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("webm")) return "webm";
  return "wav";
}

export default function Composer({ onSend, onSendFile, onTyping, sending = false, disabled = false }) {
  const [text, setText] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordMs, setRecordMs] = useState(0);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const inputRef = useRef(null);
  const attachBtnRef = useRef(null);
  const attachMenuRef = useRef(null);
  const emojiBtnRef = useRef(null);
  const emojiMenuRef = useRef(null);
  const docRef = useRef(null);
  const mediaRef = useRef(null);
  const cameraRef = useRef(null);
  const audioRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);

  const recorderRef = useRef(null);
  const recStreamRef = useRef(null);
  const recTimerRef = useRef(null);

  const hasText = Boolean(String(text || "").trim());

  const EMOJIS = [
    "😀", "😁", "😂", "🤣", "😃", "😄", "😅", "😆",
    "😉", "😊", "😋", "😎", "😍", "😘", "🥰", "😗",
    "😙", "😚", "🙂", "🤗", "🤩", "🤔", "🤨", "😐",
    "😑", "😶", "🙄", "😏", "😣", "😥", "😮", "🤐",
    "😯", "😪", "😫", "🥱", "😴", "😌", "😛", "😜",
    "👍", "🙏", "👏", "👌", "🔥", "🎉", "💯", "❤️"
  ];

  useEffect(() => {
    if (!attachOpen && !emojiOpen) return;
    const onDown = (e) => {
      const el = e.target;
      if (attachMenuRef.current?.contains(el)) return;
      if (attachBtnRef.current?.contains(el)) return;
      if (emojiMenuRef.current?.contains(el)) return;
      if (emojiBtnRef.current?.contains(el)) return;
      setAttachOpen(false);
      setEmojiOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [attachOpen, emojiOpen]);

  useEffect(() => {
    return () => {
      try {
        if (recTimerRef.current) clearInterval(recTimerRef.current);
      } catch (_e) {}
      try {
        if (recStreamRef.current) {
          for (const track of recStreamRef.current.getTracks?.() || []) track.stop?.();
        }
      } catch (_e) {}
      try {
        if (cameraStreamRef.current) {
          for (const track of cameraStreamRef.current.getTracks?.() || []) track.stop?.();
        }
      } catch (_e) {}
    };
  }, []);

  async function sendCurrentMessage() {
    const raw = String(text || "").trim();
    if (!raw || sending || disabled) return;
    setText("");
    onTyping?.("");
    try {
      await onSend?.(raw);
    } catch (_e) {}
    try {
      inputRef.current?.focus?.();
    } catch (_e) {}
  }

  function openPicker(ref) {
    setAttachOpen(false);
    try {
      if (ref.current) {
        ref.current.value = "";
        ref.current.click();
      }
    } catch (_e) {}
  }

  async function onFileChange(e) {
    const file = e.target?.files?.[0];
    if (!file || disabled || sending) return;
    try {
      await onSendFile?.(file);
    } catch (_e) {}
    try {
      if (e.target) e.target.value = "";
    } catch (_e) {}
  }

  const [cameraFacing, setCameraFacing] = useState("user");

  async function openCamera(facing = "user") {
    setAttachOpen(false);
    setCameraError("");
    const targetFacing = facing || cameraFacing || "user";
    try {
      if (cameraStreamRef.current) {
        for (const track of cameraStreamRef.current.getTracks?.() || []) track.stop?.();
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        openPicker(cameraRef);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: targetFacing } },
        audio: false
      });
      cameraStreamRef.current = stream;
      setCameraFacing(targetFacing);
      setCameraOpen(true);
      setTimeout(() => {
        try {
          if (cameraVideoRef.current) cameraVideoRef.current.srcObject = stream;
        } catch (_e) {}
      }, 50);
    } catch (_err) {
      if (facing === "environment") {
        openCamera("user").catch(() => openPicker(cameraRef));
      } else {
        openPicker(cameraRef);
      }
    }
  }

  function flipCamera() {
    const nextFacing = cameraFacing === "user" ? "environment" : "user";
    openCamera(nextFacing).catch(() => {});
  }

  function closeCamera() {
    try {
      if (cameraStreamRef.current) {
        for (const track of cameraStreamRef.current.getTracks?.() || []) track.stop?.();
      }
    } catch (_e) {}
    cameraStreamRef.current = null;
    setCameraOpen(false);
  }

  async function captureCameraFrame() {
    const video = cameraVideoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    closeCamera();
    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: "image/jpeg" });
        await onSendFile?.(file);
      },
      "image/jpeg",
      0.9
    );
  }

  const cancelRecordingRef = useRef(false);

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) return;
    try {
      cancelRecordingRef.current = false;
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 48000
          }
        });
      } catch (_e) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      recStreamRef.current = stream;
      const mime = pickRecordingMime();
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = recorder;
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        if (cancelRecordingRef.current) {
          try {
            for (const track of stream.getTracks?.() || []) track.stop?.();
          } catch (_e) {}
          return;
        }
        const finalMime = recorder.mimeType || mime || "audio/webm";
        const blob = new Blob(chunks, { type: finalMime });
        const ext = extForMime(finalMime);
        const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: finalMime });
        if (file.size > 0) await onSendFile?.(file);
        try {
          for (const track of stream.getTracks?.() || []) track.stop?.();
        } catch (_e) {}
      };

      recorder.start(250);
      setRecording(true);
      setRecordMs(0);
      const start = Date.now();
      recTimerRef.current = setInterval(() => {
        setRecordMs(Date.now() - start);
      }, 250);
    } catch (_err) {
      setRecording(false);
    }
  }

  function stopRecording() {
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    } catch (_e) {}
    setRecording(false);
  }

  function cancelRecording() {
    cancelRecordingRef.current = true;
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    } catch (_e) {}
    try {
      if (recStreamRef.current) {
        for (const track of recStreamRef.current.getTracks?.() || []) track.stop?.();
      }
    } catch (_e) {}
    setRecording(false);
    setRecordMs(0);
  }

  function toggleRecording() {
    if (recording) stopRecording();
    else startRecording().catch(() => {});
  }

  function insertEmoji(emoji) {
    const input = inputRef.current;
    if (!input) {
      setText((t) => `${t}${emoji}`);
      return;
    }
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    onTyping?.(next);
    setTimeout(() => {
      try {
        input.focus();
        input.setSelectionRange(start + emoji.length, start + emoji.length);
      } catch (_e) {}
    }, 0);
  }

  return (
    <form
      className="composerContainer"
      onSubmit={(e) => {
        e.preventDefault();
        sendCurrentMessage().catch(() => {});
      }}
    >
      <input ref={docRef} type="file" style={{ display: "none" }} onChange={onFileChange} />
      <input ref={mediaRef} type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={onFileChange} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={onFileChange} />
      <input ref={audioRef} type="file" accept="audio/*" style={{ display: "none" }} onChange={onFileChange} />

      {cameraOpen && (
        <div className="modalOverlay cameraModalOverlay" onMouseDown={closeCamera} role="presentation">
          <div className="modal cameraModal" onMouseDown={(e) => e.stopPropagation()} role="presentation">
            <div className="cameraHeader">
              <div className="modalTitle">Camera</div>
              <div className="cameraHeaderActions">
                <button
                  className="cameraFlipBtn"
                  type="button"
                  onClick={flipCamera}
                  title="Switch Camera (Front/Back)"
                  aria-label="Switch Camera"
                >
                  🔄 Flip
                </button>
                <button className="cameraCloseBtn" type="button" onClick={closeCamera} aria-label="Close camera">
                  <IconX size={18} />
                </button>
              </div>
            </div>
            <div className="cameraPreview">
              <video ref={cameraVideoRef} className="cameraVideo" autoPlay playsInline muted />
            </div>
            {cameraError && <div className="error">{cameraError}</div>}
            <div className="modalActions cameraActions">
              <button className="btn" type="button" onClick={closeCamera}>Cancel</button>
              <button className="btn primary" type="button" onClick={() => captureCameraFrame().catch(() => {})}>
                <IconCamera size={18} /> Take photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main input wrapper */}
      <div className={`composerPill ${recording ? "recordingActive" : ""}`}>
        {recording ? (
          <div className="composerRecordingBar">
            <div className="composerRecTimerWrap">
              <span className="composerRecDot" />
              <span className="composerRecTimer">{formatDuration(recordMs)}</span>
            </div>
            <div className="composerRecWave">
              <span className="waveBar bar1" />
              <span className="waveBar bar2" />
              <span className="waveBar bar3" />
              <span className="waveBar bar4" />
              <span className="waveBar bar5" />
              <span className="waveBar bar6" />
              <span className="waveBar bar7" />
            </div>
            <button
              className="composerRecCancelBtn"
              type="button"
              onClick={cancelRecording}
              title="Cancel recording"
            >
              <IconTrash size={18} />
            </button>
          </div>
        ) : (
          <input
            ref={inputRef}
            className="composerInput"
            type="text"
            value={text}
            disabled={disabled || sending}
            onChange={(e) => {
              const v = e.target.value;
              setText(v);
              if (!disabled) onTyping?.(v);
            }}
            placeholder={disabled ? "Select messages..." : "Enter Message..."}
            maxLength={1000}
          />
        )}

        <div className="composerActions">
          {/* Emoji Button */}
          {!recording && (
            <div className="composerActionWrap">
              <button
                ref={emojiBtnRef}
                className="composerActionBtn"
                type="button"
                disabled={disabled || sending}
                onClick={() => {
                  setAttachOpen(false);
                  setEmojiOpen((v) => !v);
                }}
                aria-label="Emoji"
                title="Emoji"
              >
                <IconSmile size={20} />
              </button>

              {emojiOpen && (
                <div className="composerEmojiMenu" ref={emojiMenuRef}>
                  {EMOJIS.map((e) => (
                    <button key={e} className="composerEmojiBtn" type="button" onClick={() => insertEmoji(e)}>
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Attachment Button */}
          {!recording && (
            <div className="composerActionWrap">
              <button
                ref={attachBtnRef}
                className="composerActionBtn"
                type="button"
                disabled={disabled || sending || !onSendFile}
                onClick={() => {
                  setEmojiOpen(false);
                  setAttachOpen((v) => !v);
                }}
                aria-label="Attach file"
                title="Attach file"
              >
                <IconPaperclip size={20} />
              </button>

              {attachOpen && (
                <div className="composerAttachMenu" ref={attachMenuRef}>
                  <button className="composerAttachItem" type="button" onClick={() => openPicker(docRef)}>
                    <IconDoc size={18} />
                    <span>Document</span>
                  </button>
                  <button className="composerAttachItem" type="button" onClick={() => openPicker(mediaRef)}>
                    <IconImage size={18} />
                    <span>Photos &amp; Videos</span>
                  </button>
                  <button className="composerAttachItem" type="button" onClick={() => openCamera().catch(() => {})}>
                    <IconCamera size={18} />
                    <span>Camera</span>
                  </button>
                  <button className="composerAttachItem" type="button" onClick={() => openPicker(audioRef)}>
                    <IconMic size={18} />
                    <span>Audio file</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Send / Mic Button */}
          {hasText ? (
            <button className="composerSendBtn" type="submit" disabled={disabled || sending} title="Send message">
              <IconSend size={18} />
            </button>
          ) : recording ? (
            <button
              className="composerSendBtn recordingSend"
              type="button"
              onClick={stopRecording}
              title="Send voice note"
            >
              <IconSend size={18} />
            </button>
          ) : (
            <button
              className="composerSendBtn micBtn"
              type="button"
              disabled={disabled || sending || !onSendFile}
              onClick={() => startRecording().catch(() => {})}
              title="Record voice note"
            >
              <IconMic size={20} />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
