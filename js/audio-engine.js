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

  function playWoodOn(c, out, time, gain = 0.7) {
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, time);
    osc.frequency.exponentialRampToValueAtTime(520, time + 0.02);
    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.12);
    osc.connect(env);
    env.connect(out);
    osc.start(time);
    osc.stop(time + 0.14);
  }

  function playTriOn(c, out, time, gain = 0.55) {
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = "sine";
    osc.frequency.value = 1800;
    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.35);
    osc.connect(env);
    env.connect(out);
    osc.start(time);
    osc.stop(time + 0.4);
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

  function playPercOn(c, out, time, gain = 0.55) {
    playHatOn(c, out, time, false, gain, 4500);
  }

  function playSynthOn(c, out, time, midi, type, duration, gain) {
    const freq = midiToFreq(midi);
    const osc = c.createOscillator();
    const env = c.createGain();
    const filter = c.createBiquadFilter();
    const cfg = {
      bass: { wave: "sawtooth", lp: 600, attack: 0.005 },
      chord: { wave: "triangle", lp: 2000, attack: 0.02 },
      lead: { wave: "square", lp: 3200, attack: 0.02 },
      pluck: { wave: "triangle", lp: 2800, attack: 0.002 },
      pad: { wave: "sine", lp: 1400, attack: 0.08 },
      organ: { wave: "square", lp: 2400, attack: 0.01 },
      bells: { wave: "sine", lp: 4000, attack: 0.005 },
      flute: { wave: "sine", lp: 3600, attack: 0.04 },
      harp: { wave: "triangle", lp: 4200, attack: 0.002 },
      brass: { wave: "sawtooth", lp: 1800, attack: 0.03 },
      strings: { wave: "sawtooth", lp: 2400, attack: 0.06 },
      synth: { wave: "square", lp: 3000, attack: 0.01 },
    };
    const p = cfg[type] || cfg.lead;
    osc.type = p.wave;
    osc.frequency.value = freq;
    filter.type = "lowpass";
    filter.frequency.value = p.lp;
    filter.Q.value = type === "bells" ? 8 : 2;
    const release = duration * (type === "pad" ? 1.1 : 0.85);
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

  function playVoiceOn(c, out, voice, time, noteMidi, stepDuration) {
    switch (voice) {
      case "kick":
        playKickOn(c, out, time);
        break;
      case "snare":
        playSnareOn(c, out, time);
        break;
      case "clap":
        playSnareOn(c, out, time, 0.65);
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
      case "wood":
        playWoodOn(c, out, time);
        break;
      case "tri":
        playTriOn(c, out, time);
        break;
      case "tom":
        playTomOn(c, out, time);
        break;
      case "perc":
        playPercOn(c, out, time);
        break;
      case "bass":
        if (noteMidi != null) {
          playSynthOn(c, out, time, noteMidi, "bass", stepDuration * 0.95, 0.65);
        }
        break;
      case "chord":
        if (noteMidi != null) {
          playChordOn(c, out, time, noteMidi, stepDuration * 0.9, 0.45);
        }
        break;
      case "lead":
        if (noteMidi != null) {
          playSynthOn(c, out, time, noteMidi, "lead", stepDuration * 0.85, 0.4);
        }
        break;
      case "pluck":
        if (noteMidi != null) {
          playSynthOn(c, out, time, noteMidi, "pluck", stepDuration * 0.5, 0.5);
        }
        break;
      case "pad":
        if (noteMidi != null) {
          playSynthOn(c, out, time, noteMidi, "pad", stepDuration * 1.2, 0.38);
        }
        break;
      case "organ":
        if (noteMidi != null) {
          playSynthOn(c, out, time, noteMidi, "organ", stepDuration * 0.9, 0.42);
        }
        break;
      case "bells":
        if (noteMidi != null) {
          playSynthOn(c, out, time, noteMidi, "bells", stepDuration * 0.75, 0.45);
        }
        break;
      case "flute":
        if (noteMidi != null) {
          playSynthOn(c, out, time, noteMidi, "flute", stepDuration * 0.8, 0.42);
        }
        break;
      case "harp":
        if (noteMidi != null) {
          playSynthOn(c, out, time, noteMidi, "harp", stepDuration * 0.45, 0.48);
        }
        break;
      case "brass":
        if (noteMidi != null) {
          playSynthOn(c, out, time, noteMidi, "brass", stepDuration * 0.88, 0.5);
        }
        break;
      case "strings":
        if (noteMidi != null) {
          playSynthOn(c, out, time, noteMidi, "strings", stepDuration * 1.0, 0.4);
        }
        break;
      case "synth":
        if (noteMidi != null) {
          playSynthOn(c, out, time, noteMidi, "synth", stepDuration * 0.7, 0.44);
        }
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
