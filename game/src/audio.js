// Sound, synthesized with WebAudio: no audio files, nothing fetched. Short
// blips and chimes for footsteps, pebbles, pickups and alarms, plus a very
// quiet night pad that starts on the first user gesture. Everything is
// guarded: no audio context, no sound, no crash.
export function createAudio() {
  let context = null;
  let muted = false;
  let pad = null;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return context;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
    } catch {
      return null;
    }
    return context;
  }

  function tone(freq, dur, type, gain, when, slideTo) {
    const ctx = ensure();
    if (!ctx || muted) return;
    try {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + (when || 0));
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + (when || 0) + dur);
      amp.gain.setValueAtTime(0, ctx.currentTime + (when || 0));
      amp.gain.linearRampToValueAtTime(gain || 0.08, ctx.currentTime + (when || 0) + 0.01);
      amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (when || 0) + dur);
      osc.connect(amp);
      amp.connect(ctx.destination);
      osc.start(ctx.currentTime + (when || 0));
      osc.stop(ctx.currentTime + (when || 0) + dur + 0.05);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  function noiseBurst(dur, gain, freq) {
    const ctx = ensure();
    if (!ctx || muted) return;
    try {
      const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq || 800;
      const amp = ctx.createGain();
      amp.gain.value = gain || 0.05;
      source.connect(filter);
      filter.connect(amp);
      amp.connect(ctx.destination);
      source.start();
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  return {
    unlock() {
      ensure();
      const ctx = context;
      if (!ctx || muted || pad) return;
      try {
        pad = ctx.createGain();
        pad.gain.value = 0.015;
        const oscA = ctx.createOscillator();
        oscA.type = 'sine';
        oscA.frequency.value = 110;
        const oscB = ctx.createOscillator();
        oscB.type = 'sine';
        oscB.frequency.value = 164.8;
        oscA.connect(pad);
        oscB.connect(pad);
        pad.connect(ctx.destination);
        oscA.start();
        oscB.start();
      } catch {
        pad = null;
      }
    },
    toggleMute() {
      muted = !muted;
      if (pad) pad.gain.value = muted ? 0 : 0.015;
      return muted;
    },
    get muted() {
      return muted;
    },
    step() {
      noiseBurst(0.05, 0.02, 500);
    },
    pebble() {
      noiseBurst(0.12, 0.05, 2400);
      tone(620, 0.12, 'sine', 0.04, 0, 240);
    },
    pebbleLand() {
      noiseBurst(0.08, 0.06, 900);
      tone(180, 0.1, 'triangle', 0.05, 0, 120);
    },
    petal() {
      tone(880, 0.18, 'sine', 0.07);
      tone(1318, 0.26, 'sine', 0.06, 0.08);
    },
    spotted() {
      tone(220, 0.16, 'square', 0.04);
      tone(233, 0.16, 'square', 0.04, 0.02);
    },
    alarm() {
      tone(196, 0.3, 'sawtooth', 0.06, 0, 147);
      tone(196, 0.3, 'sawtooth', 0.06, 0.32, 147);
      tone(294, 0.4, 'sawtooth', 0.05, 0.64, 220);
    },
    caught() {
      tone(330, 0.25, 'sawtooth', 0.07, 0, 110);
      tone(110, 0.5, 'sawtooth', 0.07, 0.2, 55);
    },
    clear() {
      tone(523, 0.16, 'sine', 0.07);
      tone(659, 0.16, 'sine', 0.07, 0.12);
      tone(784, 0.3, 'sine', 0.07, 0.24);
    },
    win() {
      const notes = [523, 659, 784, 1046, 1318];
      notes.forEach((freq, i) => tone(freq, 0.3, 'sine', 0.07, i * 0.14));
    },
  };
}
