import { useEffect, useMemo, useRef, useState } from "react";
import { IconMic, IconPause, IconPlay } from "./Icons.jsx";

function formatSeconds(value) {
  const total = Math.max(0, Math.floor(Number(value || 0)));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const ACTIVE_AUDIO_KEY = "__chatapp_active_voice_note_audio__";

function stopOtherAudio(self) {
  try {
    const w = window;
    const active = w?.[ACTIVE_AUDIO_KEY];
    if (active && active !== self && typeof active.pause === "function") active.pause();
    w[ACTIVE_AUDIO_KEY] = self;
  } catch (_e) {}
}

// Generate realistic deterministic waveform bar heights from URL string
function generateWaveformBars(seedStr, count = 30) {
  const bars = [];
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = (seed * 31 + seedStr.charCodeAt(i)) % 100000;
  }
  for (let i = 0; i < count; i++) {
    seed = (seed * 9301 + 49297) % 233280;
    const rnd = seed / 233280;
    const bell = Math.sin((i / count) * Math.PI);
    const height = Math.max(20, Math.min(100, Math.round((bell * 0.65 + rnd * 0.35) * 100)));
    bars.push(height);
  }
  return bars;
}

export default function VoiceNote({ url = "", isMe = false }) {
  const audioRef = useRef(null);
  const waveformRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [pos, setPos] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [hasError, setHasError] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const bars = useMemo(() => generateWaveformBars(url || "voicenote", 30), [url]);

  const progressPct = useMemo(() => {
    const d = Number(duration || 0);
    if (!d) return 0;
    return Math.max(0, Math.min(100, (Number(pos || 0) / d) * 100));
  }, [duration, pos]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    setHasError(false);
    setPlaying(false);
    setDuration(0);
    setPos(0);

    const onLoaded = () => {
      const d = Number(el.duration);
      setDuration(Number.isFinite(d) && d > 0 ? d : 0);
    };
    const onTime = () => setPos(Number(el.currentTime || 0));
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setPos(0);
      try {
        el.currentTime = 0;
      } catch (_e) {}
    };
    const onError = () => setHasError(true);

    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("durationchange", onLoaded);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onError);

    return () => {
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("durationchange", onLoaded);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onError);
    };
  }, [url]);

  useEffect(() => {
    return () => {
      const el = audioRef.current;
      try {
        if (el && typeof el.pause === "function") el.pause();
      } catch (_e) {}
      try {
        if (window?.[ACTIVE_AUDIO_KEY] === el) window[ACTIVE_AUDIO_KEY] = null;
      } catch (_e) {}
    };
  }, []);

  function toggle() {
    const el = audioRef.current;
    if (!el || !url || hasError) return;

    if (!playing) {
      stopOtherAudio(el);
      try {
        el.muted = false;
        el.volume = 1;
        el.playbackRate = playbackSpeed;
      } catch (_e) {}
      try {
        const p = el.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      } catch (_e) {}
      return;
    }

    try {
      el.pause();
    } catch (_e) {}
  }

  function handleSeekFromEvent(e) {
    if (!waveformRef.current) return;
    const rect = waveformRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const pct = clickX / rect.width;
    const targetSeconds = (duration || 0) * pct;

    const el = audioRef.current;
    if (el) {
      try {
        el.currentTime = targetSeconds;
        setPos(targetSeconds);
      } catch (_e) {}
    }
  }

  function toggleSpeed() {
    const speeds = [1, 1.5, 2];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      try {
        audioRef.current.playbackRate = nextSpeed;
      } catch (_e) {}
    }
  }

  return (
    <div className={`vnContainer ${isMe ? "vnOutgoing" : "vnIncoming"} ${playing ? "vnPlaying" : ""}`}>
      {/* Play / Pause Circular Action Button */}
      <button
        className="vnPlayBtn"
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
        title={playing ? "Pause" : "Play"}
      >
        {playing ? <IconPause size={17} /> : <IconPlay size={17} />}
      </button>

      {/* Center: Interactive Audio Waveform & Meta */}
      <div className="vnBody">
        {/* Waveform track with click/scrub support */}
        <div
          ref={waveformRef}
          className="vnWaveformTrack"
          onClick={handleSeekFromEvent}
          onMouseDown={(e) => {
            setIsScrubbing(true);
            handleSeekFromEvent(e);
          }}
          onTouchStart={(e) => {
            setIsScrubbing(true);
            handleSeekFromEvent(e);
          }}
          onTouchMove={(e) => {
            if (isScrubbing) handleSeekFromEvent(e);
          }}
          onMouseMove={(e) => {
            if (isScrubbing) handleSeekFromEvent(e);
          }}
          onMouseUp={() => setIsScrubbing(false)}
          onTouchEnd={() => setIsScrubbing(false)}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={duration || 0}
          aria-valuenow={pos}
          tabIndex={0}
          title="Click to seek"
        >
          {bars.map((height, i) => {
            const barProgress = (i / bars.length) * 100;
            const isPlayed = barProgress <= progressPct;
            return (
              <span
                key={i}
                className={`vnBar ${isPlayed ? "played" : "unplayed"}`}
                style={{ height: `${height}%` }}
              />
            );
          })}
          {/* Active playhead scrubber indicator */}
          <span className="vnScrubberDot" style={{ left: `${progressPct}%` }} />
        </div>

        {/* Bottom meta row: Timer, mic icon, speed switch */}
        <div className="vnMetaRow">
          <div className="vnTimeWrap">
            <span className="vnMicIcon">
              <IconMic size={11} />
            </span>
            <span className="vnTimeText">
              {playing ? formatSeconds(pos) : formatSeconds(duration || pos || 0)}
            </span>
          </div>

          <button
            className={`vnSpeedBtn ${playbackSpeed !== 1 ? "active" : ""}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleSpeed();
            }}
            title="Change playback speed"
          >
            {playbackSpeed}x
          </button>
        </div>

        {hasError && url && (
          <a className="vnErrorFallback" href={url} target="_blank" rel="noreferrer">
            Audio file link
          </a>
        )}
      </div>

      <audio ref={audioRef} src={url} preload="metadata" />
    </div>
  );
}
