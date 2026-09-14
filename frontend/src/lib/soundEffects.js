// WhatsApp-style Web Audio Synthesizer for Calling & Message Sound Effects
let audioCtx = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// ==========================================
// 1. OUTGOING RINGBACK TONE (WhatsApp Dial Tone)
// ==========================================
let outgoingTimer = null;
let outgoingGain = null;

export function startOutgoingRingTone() {
  stopOutgoingRingTone();
  stopIncomingRingTone();

  const ctx = getAudioContext();
  if (!ctx) return;

  const playPulse = () => {
    try {
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const t = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.value = 425; // Standard telecom / WhatsApp dial frequency

      osc2.type = "sine";
      osc2.frequency.value = 450; // Harmonic tone

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.05);
      gain.gain.setValueAtTime(0.12, t + 1.15);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.25);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 1.26);
      osc2.stop(t + 1.26);
    } catch (_e) {}
  };

  playPulse();
  outgoingTimer = setInterval(playPulse, 3400);
}

export function stopOutgoingRingTone() {
  if (outgoingTimer) {
    clearInterval(outgoingTimer);
    outgoingTimer = null;
  }
  if (outgoingGain) {
    try {
      outgoingGain.gain.setValueAtTime(0.0001, audioCtx?.currentTime || 0);
    } catch (_e) {}
    outgoingGain = null;
  }
}

// ==========================================
// 2. INCOMING CALL RINGTONE (WhatsApp Melodic Loop)
// ==========================================
let incomingTimer = null;

export function startIncomingRingTone() {
  stopIncomingRingTone();
  stopOutgoingRingTone();

  const ctx = getAudioContext();
  if (!ctx) return;

  // WhatsApp Marimba Melody notes (frequencies in Hz)
  const melody = [
    { freq: 659.25, dur: 0.12, delay: 0.0 },   // E5
    { freq: 783.99, dur: 0.12, delay: 0.16 },  // G5
    { freq: 880.00, dur: 0.18, delay: 0.32 },  // A5
    { freq: 783.99, dur: 0.14, delay: 0.54 },  // G5
    { freq: 659.25, dur: 0.14, delay: 0.72 },  // E5
    { freq: 587.33, dur: 0.14, delay: 0.90 },  // D5
    { freq: 523.25, dur: 0.16, delay: 1.08 },  // C5
    { freq: 587.33, dur: 0.14, delay: 1.28 },  // D5
    { freq: 659.25, dur: 0.28, delay: 1.46 },  // E5
    { freq: 523.25, dur: 0.35, delay: 1.80 }   // C5
  ];

  const playMelody = () => {
    try {
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const now = ctx.currentTime;

      melody.forEach(({ freq, dur, delay }) => {
        const t = now + delay;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        // Warm triangle/sine hybrid for marimba bell sound
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t);
        osc.stop(t + dur + 0.02);
      });
    } catch (_e) {}
  };

  playMelody();
  incomingTimer = setInterval(playMelody, 3200);
}

export function stopIncomingRingTone() {
  if (incomingTimer) {
    clearInterval(incomingTimer);
    incomingTimer = null;
  }
}

// ==========================================
// 3. CALL CONNECTED SOUND
// ==========================================
export function playCallConnected() {
  stopOutgoingRingTone();
  stopIncomingRingTone();

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const t = ctx.currentTime;

    const notes = [
      { freq: 523.25, time: t },
      { freq: 659.25, time: t + 0.08 },
      { freq: 783.99, time: t + 0.16 }
    ];

    notes.forEach(({ freq, time }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, time);

      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(0.12, time + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(time);
      osc.stop(time + 0.13);
    });
  } catch (_e) {}
}

// ==========================================
// 4. CALL ENDED / BUSY SOUND
// ==========================================
export function playCallEnded() {
  stopOutgoingRingTone();
  stopIncomingRingTone();

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const t = ctx.currentTime;

    const beeps = [
      { freq: 480, start: t, end: t + 0.10 },
      { freq: 400, start: t + 0.14, end: t + 0.28 }
    ];

    beeps.forEach(({ freq, start, end }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.14, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(end + 0.02);
    });
  } catch (_e) {}
}

// ==========================================
// 5. INCOMING MESSAGE POP TONE
// ==========================================
export function playMessagePop() {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(1320, t + 0.06);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.1, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.10);
  } catch (_e) {}
}
