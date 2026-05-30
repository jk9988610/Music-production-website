/**
 * Web Audio 合成引擎 — 鼓组与合成器音色
 */
const AudioEngine = (() => {
  let ctx = null;
  let masterGain = null;
  const trackGains = {};

  const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function playKickOn(c, out, time, gain = 0.9) {
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

  function playSnareOn(c, out, time, gain = 0.75) {
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

  function playHatOn(c, out, time, open = false, gain = 0.5, filterHz = 7000) {
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
    filter.frequency.value = filterHz;
    const env = c.createGain();
    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + dur);
    noise.connect(filter);
    filter.connect(env);
    env.connect(out);
    noise.start(time);
    noise.stop(time + dur + 0.02);
  }

  function playTomOn(c, out, time, gain = 0.8) {
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(220, time);
    osc.frequency.exponentialRampToValueAtTime(80, time + 0.12);
    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.28);
    osc.connect(env);
    env.connect(out);
    osc.start(time);
    osc.stop(time + 0.3);
  }

  function playSynthOn(c, out, time, midi, type, duration, gain) {
    const freq = midiToFreq(midi);
    const osc = c.createOscillator();
    const env = c.createGain();
    const filter = c.createBiquadFilter();
    const cfg = {
      bass: { wave: "sawtooth", lp: 600, attack: 0.005, release: 0.85 },
      chord: { wave: "triangle", lp: 2000, attack: 0.02, release: 0.85 },
      lead: { wave: "square", lp: 3200, attack: 0.02, release: 0.85 },
      piano: { wave: "triangle", lp: 5200, attack: 0.004, release: 0.75 },
      violin: { wave: "sawtooth", lp: 4600, attack: 0.025, release: 0.8 },
      viola: { wave: "sawtooth", lp: 4000, attack: 0.03, release: 0.82 },
      cello: { wave: "sawtooth", lp: 2400, attack: 0.04, release: 0.9 },
      clarinet: { wave: "square", lp: 2900, attack: 0.05, release: 0.8 },
      sax: { wave: "sawtooth", lp: 2700, attack: 0.04, release: 0.82 },
      oboe: { wave: "square", lp: 3100, attack: 0.05, release: 0.78 },
      eguitar: { wave: "sawtooth", lp: 3500, attack: 0.008, release: 0.7 },
      pipeorgan: { wave: "square", lp: 2500, attack: 0.02, release: 0.95 },
      synth: { wave: "square", lp: 3000, attack: 0.01, release: 0.85 },
    };
    const p = cfg[type] || cfg.lead;
    osc.type = p.wave;
    osc.frequency.value = freq;
    filter.type = "lowpass";
    filter.frequency.value = p.lp;
    filter.Q.value = type === "piano" ? 1.5 : 2;
    const release = duration * p.release;
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(gain, time + p.attack);
    env.gain.setValueAtTime(gain * 0.7, time + duration * 0.3);
    env.gain.exponentialRampToValueAtTime(0.001, time + release);
    osc.connect(filter);
    filter.connect(env);
    env.connect(out);
    osc.start(time);
    osc.stop(time + release + 0.05);
  }

  function playChordOn(c, out, time, rootMidi, duration, gain) {
    [0, 4, 7].forEach((semi, i) => {
      playSynthOn(c, out, time, rootMidi + semi, "chord", duration, gain * (i === 0 ? 0.5 : 0.35));
    });
  }

  function resolveVoice(trackId) {
    if (typeof Sequencer !== "undefined" && Sequencer.getTrack) {
      const t = Sequencer.getTrack(trackId);
      if (t?.voice) return t.voice;
    }
    return trackId;
  }

  function playMelodicVoice(c, out, voice, time, noteMidi, stepDuration, gain) {
    if (noteMidi == null) return;
    let midi = noteMidi;
    if (voice === "viola") midi -= 5;
    if (voice === "cello") midi -= 12;
    playSynthOn(c, out, time, midi, voice, stepDuration, gain);
  }

  function playVoiceOn(c, out, voice, time, noteMidi, stepDuration) {
    switch (voice) {
      case "kick":
        playKickOn(c, out, time);
        break;
      case "snare":
      case "clap":
        playSnareOn(c, out, time, voice === "clap" ? 0.65 : 0.75);
        break;
      case "hihat":
        playHatOn(c, out, time, false);
        break;
      case "openhat":
        playHatOn(c, out, time, true, 0.55);
        break;
      case "cymbal":
      case "ride":
        playHatOn(c, out, time, true, 0.42, 5500);
        break;
      case "splash":
        playHatOn(c, out, time, true, 0.48, 9000);
        break;
      case "tom":
      case "perc":
      case "wood":
      case "tri":
        playTomOn(c, out, time);
        break;
      case "bass":
        playMelodicVoice(c, out, "bass", time, noteMidi, stepDuration * 0.95, 0.65);
        break;
      case "chord":
        if (noteMidi != null) {
          playChordOn(c, out, time, noteMidi, stepDuration * 0.9, 0.45);
        }
        break;
      case "lead":
        playMelodicVoice(c, out, "lead", time, noteMidi, stepDuration * 0.85, 0.4);
        break;
      case "piano":
        playMelodicVoice(c, out, "piano", time, noteMidi, stepDuration * 0.7, 0.5);
        break;
      case "violin":
        playMelodicVoice(c, out, "violin", time, noteMidi, stepDuration * 0.82, 0.42);
        break;
      case "viola":
        playMelodicVoice(c, out, "viola", time, noteMidi, stepDuration * 0.88, 0.4);
        break;
      case "cello":
        playMelodicVoice(c, out, "cello", time, noteMidi, stepDuration * 0.95, 0.44);
        break;
      case "clarinet":
        playMelodicVoice(c, out, "clarinet", time, noteMidi, stepDuration * 0.85, 0.42);
        break;
      case "sax":
        playMelodicVoice(c, out, "sax", time, noteMidi, stepDuration * 0.8, 0.45);
        break;
      case "oboe":
        playMelodicVoice(c, out, "oboe", time, noteMidi, stepDuration * 0.82, 0.4);
        break;
      case "eguitar":
        playMelodicVoice(c, out, "eguitar", time, noteMidi, stepDuration * 0.65, 0.48);
        break;
      case "pipeorgan":
      case "organ":
        playMelodicVoice(c, out, "pipeorgan", time, noteMidi, stepDuration * 0.95, 0.4);
        break;
      case "synth":
      case "pad":
      case "bells":
      case "pluck":
      case "flute":
      case "harp":
      case "brass":
      case "strings":
        playMelodicVoice(c, out, "synth", time, noteMidi, stepDuration * 0.75, 0.42);
        break;
      default:
        break;
    }
  }

  function playTrackSoundOn(c, outGetter, trackId, time, noteMidi, stepDuration) {
    const out = outGetter(trackId);
    const voice = resolveVoice(trackId);
    playVoiceOn(c, out, voice, time, noteMidi, stepDuration);
  }

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

  function playTrackSound(trackId, time, noteMidi, stepDuration) {
    const c = ensureContext();
    playTrackSoundOn(c, (id) => getTrackGain(id), trackId, time, noteMidi, stepDuration);
  }

  function previewTrackNote(trackId, midi, duration = 0.28) {
    ensureContext();
    const time = ctx.currentTime + 0.02;
    playTrackSound(trackId, time, midi, duration);
  }

  function createOfflineScheduler(volumes) {
    const gains = {};
    return {
      schedule(c, master, trackId, time, noteMidi, stepDuration) {
        if (!gains[trackId]) {
          const g = c.createGain();
          const def = volumes[trackId] ?? 0.75;
          g.gain.value = def;
          g.connect(master);
          gains[trackId] = g;
        }
        const outGetter = (id) => gains[id];
        playTrackSoundOn(c, outGetter, trackId, time, noteMidi, stepDuration);
      },
    };
  }

  return {
    NOTE_NAMES,
    ensureContext,
    setTrackVolume,
    playTrackSound,
    playTrackSoundOn,
    playVoiceOn,
    previewTrackNote,
    createOfflineScheduler,
    midiToFreq,
    getContext: () => ctx,
  };
})();
