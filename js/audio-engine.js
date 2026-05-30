/**
 * Web Audio 合成引擎 — 鼓组与合成器音色
 */
const AudioEngine = (() => {
  let ctx = null;
  let masterGain = null;
  const trackGains = {};

  const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

  function ensureContext() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.85;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    return ctx;
  }

  function getTrackGain(trackId, defaultVol = 0.8) {
    ensureContext();
    if (!trackGains[trackId]) {
      const g = ctx.createGain();
      g.gain.value = defaultVol;
      g.connect(masterGain);
      trackGains[trackId] = g;
    }
    return trackGains[trackId];
  }

  function setTrackVolume(trackId, vol) {
    const g = getTrackGain(trackId);
    g.gain.setTargetAtTime(vol, ctx.currentTime, 0.02);
  }

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function playKick(time, gain = 0.9) {
    const c = ensureContext();
    const out = getTrackGain("kick", 0.9);
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.08);
    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.35);
    osc.connect(env);
    env.connect(out);
    osc.start(time);
    osc.stop(time + 0.4);
  }

  function playSnare(time, gain = 0.75) {
    const c = ensureContext();
    const out = getTrackGain("snare", 0.8);
    const bufferSize = c.sampleRate * 0.2;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    const noise = c.createBufferSource();
    noise.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 800;
    const env = c.createGain();
    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    noise.connect(filter);
    filter.connect(env);
    env.connect(out);
    noise.start(time);
    noise.stop(time + 0.2);
    const tone = c.createOscillator();
    const toneEnv = c.createGain();
    tone.type = "triangle";
    tone.frequency.value = 180;
    toneEnv.gain.setValueAtTime(gain * 0.4, time);
    toneEnv.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    tone.connect(toneEnv);
    toneEnv.connect(out);
    tone.start(time);
    tone.stop(time + 0.1);
  }

  function playHat(time, open = false, gain = 0.5) {
    const c = ensureContext();
    const out = getTrackGain(open ? "openhat" : "hihat", 0.65);
    const dur = open ? 0.25 : 0.05;
    const bufferSize = Math.floor(c.sampleRate * dur);
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (open ? 1 - i / bufferSize : 1);
    }
    const noise = c.createBufferSource();
    noise.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 7000;
    const env = c.createGain();
    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + dur);
    noise.connect(filter);
    filter.connect(env);
    env.connect(out);
    noise.start(time);
    noise.stop(time + dur + 0.02);
  }

  function playSynth(time, midi, type, duration, gain, trackId) {
    const c = ensureContext();
    const out = getTrackGain(trackId, 0.7);
    const freq = midiToFreq(midi);
    const osc = c.createOscillator();
    const env = c.createGain();
    const filter = c.createBiquadFilter();
    osc.type = type === "bass" ? "sawtooth" : type === "chord" ? "triangle" : "square";
    osc.frequency.value = freq;
    filter.type = "lowpass";
    filter.frequency.value = type === "bass" ? 600 : type === "lead" ? 3200 : 2000;
    filter.Q.value = 2;
    const attack = type === "bass" ? 0.005 : 0.02;
    const release = duration * 0.85;
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(gain, time + attack);
    env.gain.setValueAtTime(gain * 0.7, time + duration * 0.3);
    env.gain.exponentialRampToValueAtTime(0.001, time + release);
    osc.connect(filter);
    filter.connect(env);
    env.connect(out);
    osc.start(time);
    osc.stop(time + release + 0.05);
  }

  function playChord(time, rootMidi, duration, gain) {
    const intervals = [0, 4, 7];
    intervals.forEach((semi, i) => {
      playSynth(time, rootMidi + semi, "chord", duration, gain * (i === 0 ? 0.5 : 0.35), "chord");
    });
  }

  function playTrackSound(trackId, time, noteMidi, stepDuration) {
    switch (trackId) {
      case "kick":
        playKick(time);
        break;
      case "snare":
        playSnare(time);
        break;
      case "hihat":
        playHat(time, false);
        break;
      case "openhat":
        playHat(time, true, 0.55);
        break;
      case "bass":
        if (noteMidi != null) playSynth(time, noteMidi, "bass", stepDuration * 0.95, 0.65, "bass");
        break;
      case "chord":
        if (noteMidi != null) playChord(time, noteMidi, stepDuration * 0.9, 0.45);
        break;
      case "lead":
        if (noteMidi != null) playSynth(time, noteMidi, "lead", stepDuration * 0.85, 0.4, "lead");
        break;
      default:
        break;
    }
  }

  function previewTrackNote(trackId, midi, duration = 0.28) {
    ensureContext();
    const time = ctx.currentTime + 0.02;
    playTrackSound(trackId, time, midi, duration);
  }

  return {
    NOTE_NAMES,
    ensureContext,
    setTrackVolume,
    playTrackSound,
    previewTrackNote,
    midiToFreq,
    getContext: () => ctx,
  };
})();
