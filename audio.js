export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let muted = false;
  let ambientNodes = null;

  function ensureContext() {
    if (ctx) return ctx;

    try {
      const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContextClass) return null;

      ctx = new AudioContextClass();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      return ctx;
    } catch {
      ctx = null;
      master = null;
      return null;
    }
  }

  function unlock() {
    const audio = ensureContext();
    if (!audio) return Promise.resolve();

    try {
      if (audio.state === "suspended") {
        return audio.resume().catch(() => {});
      }
    } catch {
      return Promise.resolve();
    }
    return Promise.resolve();
  }

  function setMuted(value) {
    muted = Boolean(value);
    if (!ctx || !master) return;

    try {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(muted ? 0 : 0.5, now, 0.015);
    } catch {}
  }

  function getNoiseBuffer() {
    if (!ctx || muted) return null;
    if (noiseBuffer) return noiseBuffer;

    try {
      const length = Math.max(1, Math.floor(ctx.sampleRate * 2));
      noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      return noiseBuffer;
    } catch {
      return null;
    }
  }

  function blip(freq, dur, type = "sine", gain = 0.2, when) {
    if (!ctx || muted) return;

    try {
      const start = when === undefined ? ctx.currentTime : when;
      const length = Math.max(0.005, dur);
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(1, freq), start);
      amp.gain.setValueAtTime(0.0001, start);
      amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + 0.004);
      amp.gain.exponentialRampToValueAtTime(0.0001, start + length);
      osc.connect(amp);
      amp.connect(master);
      osc.start(start);
      osc.stop(start + length + 0.01);
      osc.onended = () => {
        try {
          osc.disconnect();
          amp.disconnect();
        } catch {}
      };
    } catch {}
  }

  function noiseBurst(dur, filterFreq, gain, when) {
    if (!ctx || muted) return;

    try {
      const buffer = getNoiseBuffer();
      if (!buffer) return;

      const start = when === undefined ? ctx.currentTime : when;
      const length = Math.max(0.008, dur);
      const source = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const amp = ctx.createGain();
      source.buffer = buffer;
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(Math.max(80, filterFreq), start);
      filter.Q.setValueAtTime(0.7, start);
      amp.gain.setValueAtTime(0.0001, start);
      amp.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + 0.003);
      amp.gain.exponentialRampToValueAtTime(0.0001, start + length);
      source.connect(filter);
      filter.connect(amp);
      amp.connect(master);
      source.start(start);
      source.stop(start + length + 0.01);
      source.onended = () => {
        try {
          source.disconnect();
          filter.disconnect();
          amp.disconnect();
        } catch {}
      };
    } catch {}
  }

  function shot(kind, vol = 1) {
    if (!ctx || muted) return;

    const profiles = {
      pistol: { noise: 0.075, cutoff: 4200, snap: 0.27, thump: 0.34, pitch: 105 },
      smg: { noise: 0.055, cutoff: 5200, snap: 0.19, thump: 0.23, pitch: 135 },
      rifle: { noise: 0.095, cutoff: 3100, snap: 0.32, thump: 0.42, pitch: 82 },
      shotgun: { noise: 0.18, cutoff: 1800, snap: 0.44, thump: 0.52, pitch: 58 },
      dmr: { noise: 0.12, cutoff: 2500, snap: 0.35, thump: 0.46, pitch: 68 },
      bot: { noise: 0.07, cutoff: 3600, snap: 0.2, thump: 0.24, pitch: 95 }
    };
    const profile = profiles[kind] || profiles.rifle;
    const scale = Math.max(0, Math.min(2, Number.isFinite(vol) ? vol : 1));
    const now = ctx.currentTime;

    noiseBurst(profile.noise, profile.cutoff, profile.snap * scale, now);
    blip(profile.pitch, 0.13, "sine", profile.thump * scale, now);
    blip(profile.pitch * 0.52, 0.09, "triangle", profile.thump * scale * 0.35, now + 0.012);
  }

  function dryFire() {
    if (!ctx || muted) return;
    blip(780, 0.035, "square", 0.075);
    blip(240, 0.045, "triangle", 0.04, ctx.currentTime + 0.025);
  }

  function reloadStart() {
    if (!ctx || muted) return;
    noiseBurst(0.075, 1700, 0.11);
    blip(360, 0.08, "triangle", 0.08, ctx.currentTime + 0.06);
  }

  function reloadEnd() {
    if (!ctx || muted) return;
    blip(620, 0.045, "square", 0.09);
    blip(980, 0.07, "triangle", 0.11, ctx.currentTime + 0.045);
    noiseBurst(0.045, 2600, 0.07, ctx.currentTime + 0.025);
  }

  function hit(kill) {
    if (!ctx || muted) return;
    if (kill) {
      blip(880, 0.08, "sine", 0.16);
      blip(1320, 0.12, "sine", 0.13, ctx.currentTime + 0.075);
    } else {
      blip(680, 0.055, "triangle", 0.12);
    }
  }

  function hurt() {
    if (!ctx || muted) return;
    noiseBurst(0.12, 950, 0.2);
    blip(115, 0.16, "sawtooth", 0.18);
  }

  function footstep(run) {
    if (!ctx || muted) return;
    const strength = run ? 0.18 : 0.11;
    noiseBurst(run ? 0.09 : 0.12, run ? 750 : 520, strength);
    blip(run ? 72 : 58, 0.1, "sine", strength * 0.8);
  }

  function plantBeep(final) {
    if (!ctx || muted) return;
    const start = ctx.currentTime;
    const freq = final ? 1250 : 860;
    blip(freq, final ? 0.16 : 0.1, "square", final ? 0.15 : 0.1, start);
    if (final) blip(freq * 1.25, 0.2, "sine", 0.1, start + 0.17);
  }

  function defuseBeep() {
    if (!ctx || muted) return;
    blip(720, 0.09, "square", 0.11);
    blip(540, 0.11, "triangle", 0.09, ctx.currentTime + 0.1);
  }

  function roundWin(win) {
    if (!ctx || muted) return;
    const start = ctx.currentTime;
    const notes = win ? [523, 659, 784, 1047] : [392, 330, 262];
    notes.forEach((freq, index) => {
      blip(freq, 0.2, "triangle", 0.12, start + index * 0.13);
    });
  }

  function buySound() {
    if (!ctx || muted) return;
    const start = ctx.currentTime;
    blip(660, 0.07, "sine", 0.1, start);
    blip(880, 0.09, "sine", 0.09, start + 0.07);
  }

  function grenadeThrow() {
    if (!ctx || muted) return;
    noiseBurst(0.11, 1200, 0.12);
    blip(230, 0.16, "triangle", 0.1, ctx.currentTime + 0.025);
  }

  function explosion() {
    if (!ctx || muted) return;
    const start = ctx.currentTime;
    noiseBurst(0.7, 850, 0.48, start);
    blip(48, 0.65, "sine", 0.56, start);
    blip(82, 0.34, "triangle", 0.26, start + 0.015);
  }

  function smokeHiss() {
    if (!ctx || muted) return;
    noiseBurst(0.85, 1450, 0.16);
    noiseBurst(0.45, 700, 0.07, ctx.currentTime + 0.12);
  }

  function click() {
    if (!ctx || muted) return;
    blip(1150, 0.025, "square", 0.055);
  }

  function startAmbient() {
    if (!ctx || muted || ambientNodes) return;

    try {
      const buffer = getNoiseBuffer();
      if (!buffer) return;

      const now = ctx.currentTime;
      const oscillator = ctx.createOscillator();
      const oscGain = ctx.createGain();
      const noise = ctx.createBufferSource();
      const noiseFilter = ctx.createBiquadFilter();
      const noiseGain = ctx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(48, now);
      oscGain.gain.setValueAtTime(0.0001, now);
      oscGain.gain.linearRampToValueAtTime(0.035, now + 1.2);
      oscillator.connect(oscGain);
      oscGain.connect(master);

      noise.buffer = buffer;
      noise.loop = true;
      noiseFilter.type = "lowpass";
      noiseFilter.frequency.setValueAtTime(290, now);
      noiseFilter.Q.setValueAtTime(0.45, now);
      noiseGain.gain.setValueAtTime(0.0001, now);
      noiseGain.gain.linearRampToValueAtTime(0.012, now + 1.5);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(master);

      oscillator.start(now);
      noise.start(now);
      ambientNodes = { oscillator, oscGain, noise, noiseFilter, noiseGain };
    } catch {
      ambientNodes = null;
    }
  }

  function stopAmbient() {
    if (!ctx || muted || !ambientNodes) return;

    const nodes = ambientNodes;
    ambientNodes = null;
    try {
      const now = ctx.currentTime;
      nodes.oscGain.gain.cancelScheduledValues(now);
      nodes.oscGain.gain.setTargetAtTime(0.0001, now, 0.08);
      nodes.noiseGain.gain.cancelScheduledValues(now);
      nodes.noiseGain.gain.setTargetAtTime(0.0001, now, 0.08);
      nodes.oscillator.stop(now + 0.4);
      nodes.noise.stop(now + 0.4);
      nodes.oscillator.onended = () => {
        try {
          nodes.oscillator.disconnect();
          nodes.oscGain.disconnect();
          nodes.noise.disconnect();
          nodes.noiseFilter.disconnect();
          nodes.noiseGain.disconnect();
        } catch {}
      };
    } catch {
      try {
        nodes.oscillator.stop();
        nodes.noise.stop();
      } catch {}
    }
  }

  return {
    unlock,
    setMuted,
    get muted() {
      return muted;
    },
    shot,
    dryFire,
    reloadStart,
    reloadEnd,
    hit,
    hurt,
    footstep,
    plantBeep,
    defuseBeep,
    roundWin,
    buySound,
    grenadeThrow,
    explosion,
    smokeHiss,
    click,
    startAmbient,
    stopAmbient
  };
}