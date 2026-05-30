/**
 * Web Audio 合成引擎 — 每件乐器独立音色，不做移调借用
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

  function playClapOn(c, out, time, gain = 0.7) {
    [0, 0.012, 0.024].forEach((off, i) => {
      const bufferSize = Math.floor(c.sampleRate * 0.06);
      const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let j = 0; j < bufferSize; j++) {
        data[j] = (Math.random() * 2 - 1) * (1 - j / bufferSize);
      }
      const noise = c.createBufferSource();
      noise.buffer = buffer;
      const f = c.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = 2200;
      f.Q.value = 0.8;
      const env = c.createGain();
      const t = time + off;
      env.gain.setValueAtTime(gain * (0.9 - i * 0.2), t);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      noise.connect(f);
      f.connect(env);
      env.connect(out);
      noise.start(t);
      noise.stop(t + 0.08);
    });
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

  function playWoodOn(c, out, time, gain = 0.75) {
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1200, time);
    osc.frequency.exponentialRampToValueAtTime(600, time + 0.015);
    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    osc.connect(env);
    env.connect(out);
    osc.start(time);
    osc.stop(time + 0.12);
  }

  function playTriOn(c, out, time, gain = 0.5) {
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = "sine";
    osc.frequency.value = 2100;
    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.45);
    osc.connect(env);
    env.connect(out);
    osc.start(time);
    osc.stop(time + 0.5);
  }

  function playPercOn(c, out, time, gain = 0.65) {
    const osc = c.createOscillator();
    const env = c.createGain();
    const filter = c.createBiquadFilter();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(320, time);
    osc.frequency.exponentialRampToValueAtTime(140, time + 0.08);
    filter.type = "bandpass";
    filter.frequency.value = 400;
    filter.Q.value = 1.2;
    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
    osc.connect(filter);
    filter.connect(env);
    env.connect(out);
    osc.start(time);
    osc.stop(time + 0.25);
  }

  function playNoiseBurst(c, out, time, dur, gain, filterHz, q = 1) {
    const bufferSize = Math.floor(c.sampleRate * dur);
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = c.createBufferSource();
    noise.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = filterHz;
    filter.Q.value = q;
    const env = c.createGain();
    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + dur);
    noise.connect(filter);
    filter.connect(env);
    env.connect(out);
    noise.start(time);
    noise.stop(time + dur + 0.02);
  }

  function playMonoVoice(c, out, time, midi, duration, gain, opts) {
    const freq = midiToFreq(midi);
    const osc = c.createOscillator();
    const env = c.createGain();
    const filter = c.createBiquadFilter();
    osc.type = opts.wave || "sine";
    osc.frequency.value = freq;
    if (opts.detuneCents) osc.detune.value = opts.detuneCents;
    filter.type = opts.filterType || "lowpass";
    filter.frequency.value = opts.lp ?? 3000;
    filter.Q.value = opts.q ?? 2;
    const attack = opts.attack ?? 0.02;
    const release = duration * (opts.releaseMul ?? 0.85);
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(gain, time + attack);
    if (opts.sustainLevel != null) {
      env.gain.setValueAtTime(gain * opts.sustainLevel, time + duration * 0.35);
    }
    env.gain.exponentialRampToValueAtTime(0.001, time + release);
    osc.connect(filter);
    filter.connect(env);
    env.connect(out);
    osc.start(time);
    osc.stop(time + release + 0.05);
  }

  function playPianoOn(c, out, time, midi, duration, gain = 0.5) {
    const freq = midiToFreq(midi);
    [1, 2, 3, 4].forEach((h, i) => {
      const osc = c.createOscillator();
      const env = c.createGain();
      osc.type = "sine";
      osc.frequency.value = freq * h;
      const g = gain * (1 / (i + 1));
      env.gain.setValueAtTime(0, time);
      env.gain.linearRampToValueAtTime(g, time + 0.003);
      env.gain.exponentialRampToValueAtTime(0.001, time + duration * (0.6 - i * 0.08));
      osc.connect(env);
      env.connect(out);
      osc.start(time);
      osc.stop(time + duration);
    });
  }

  function playBellsOn(c, out, time, midi, duration, gain = 0.45) {
    const freq = midiToFreq(midi);
    [1, 2.4, 3.8].forEach((ratio, i) => {
      const osc = c.createOscillator();
      const env = c.createGain();
      osc.type = "sine";
      osc.frequency.value = freq * ratio;
      env.gain.setValueAtTime(0, time);
      env.gain.linearRampToValueAtTime(gain * (0.7 - i * 0.15), time + 0.002);
      env.gain.exponentialRampToValueAtTime(0.001, time + duration * (1.1 - i * 0.1));
      osc.connect(env);
      env.connect(out);
      osc.start(time);
      osc.stop(time + duration * 1.2);
    });
  }

  function playHarpOn(c, out, time, midi, duration, gain = 0.48) {
    playMonoVoice(c, out, time, midi, duration * 0.55, gain, {
      wave: "triangle",
      lp: 4800,
      attack: 0.001,
      releaseMul: 0.5,
    });
  }

  function playStringsOn(c, out, time, midi, duration, gain = 0.38) {
    [-7, 0, 7].forEach((cents, i) => {
      playMonoVoice(c, out, time, midi, duration, gain * (i === 1 ? 0.5 : 0.28), {
        wave: "sawtooth",
        lp: 2800,
        attack: 0.08,
        releaseMul: 1.0,
        sustainLevel: 0.75,
        detuneCents: cents,
      });
    });
  }

  function playBrassOn(c, out, time, midi, duration, gain = 0.48) {
    playMonoVoice(c, out, time, midi, duration, gain, {
      wave: "sawtooth",
      lp: 1900,
      attack: 0.06,
      releaseMul: 0.88,
      q: 3,
    });
    playNoiseBurst(c, out, time + 0.02, duration * 0.4, gain * 0.12, 1200, 0.6);
  }

  function playFluteOn(c, out, time, midi, duration, gain = 0.42) {
    playMonoVoice(c, out, time, midi, duration, gain * 0.85, {
      wave: "sine",
      lp: 3800,
      attack: 0.05,
      releaseMul: 0.8,
    });
    playNoiseBurst(c, out, time, duration * 0.9, gain * 0.08, 2800, 0.4);
  }

  function playPadOn(c, out, time, midi, duration, gain = 0.36) {
    playMonoVoice(c, out, time, midi, duration * 1.15, gain, {
      wave: "sine",
      lp: 1400,
      attack: 0.12,
      releaseMul: 1.05,
      sustainLevel: 0.8,
    });
  }

  function playPluckOn(c, out, time, midi, duration, gain = 0.5) {
    playMonoVoice(c, out, time, midi, duration * 0.45, gain, {
      wave: "triangle",
      lp: 3200,
      attack: 0.001,
      releaseMul: 0.45,
    });
  }

  function playOrganOn(c, out, time, midi, duration, gain = 0.4) {
    [0, 12].forEach((semi, i) => {
      playMonoVoice(c, out, time, midi + semi, duration, gain * (i === 0 ? 0.55 : 0.35), {
        wave: "square",
        lp: 2200,
        attack: 0.015,
        releaseMul: 0.9,
      });
    });
  }

  function playPipeOrganOn(c, out, time, midi, duration, gain = 0.4) {
    [0, 7, 12].forEach((semi, i) => {
      playMonoVoice(c, out, time, midi + semi, duration, gain * (0.45 - i * 0.08), {
        wave: "square",
        lp: 2600,
        attack: 0.02,
        releaseMul: 0.95,
      });
    });
  }

  function playChordOn(c, out, time, rootMidi, duration, gain) {
    [0, 4, 7].forEach((semi, i) => {
      playMonoVoice(c, out, time, rootMidi + semi, duration, gain * (i === 0 ? 0.5 : 0.35), {
        wave: "triangle",
        lp: 2000,
        attack: 0.02,
        releaseMul: 0.85,
      });
    });
  }

  function resolveVoice(trackId) {
    if (typeof Sequencer !== "undefined" && Sequencer.getTrack) {
      const t = Sequencer.getTrack(trackId);
      if (t?.voice) return t.voice;
    }
    return trackId;
  }

  function playMelodic(c, out, voice, time, noteMidi, stepDuration, gain) {
    if (noteMidi == null) return;
    const d = stepDuration;
    switch (voice) {
      case "bass":
        playMonoVoice(c, out, time, noteMidi, d * 0.95, gain, {
          wave: "sawtooth",
          lp: 600,
          attack: 0.005,
          releaseMul: 0.85,
        });
        break;
      case "lead":
        playMonoVoice(c, out, time, noteMidi, d * 0.85, gain, {
          wave: "square",
          lp: 3200,
          attack: 0.02,
          releaseMul: 0.85,
        });
        break;
      case "piano":
        playPianoOn(c, out, time, noteMidi, d * 0.7, gain);
        break;
      case "violin":
        playMonoVoice(c, out, time, noteMidi, d * 0.82, gain, {
          wave: "sawtooth",
          lp: 4600,
          attack: 0.025,
          releaseMul: 0.8,
        });
        break;
      case "viola":
        playMonoVoice(c, out, time, noteMidi, d * 0.88, gain, {
          wave: "sawtooth",
          lp: 3600,
          attack: 0.03,
          releaseMul: 0.82,
          detuneCents: -15,
        });
        break;
      case "cello":
        playMonoVoice(c, out, time, noteMidi, d * 0.95, gain, {
          wave: "sawtooth",
          lp: 2200,
          attack: 0.04,
          releaseMul: 0.9,
          detuneCents: -25,
        });
        break;
      case "clarinet":
        playMonoVoice(c, out, time, noteMidi, d * 0.85, gain, {
          wave: "square",
          lp: 2900,
          attack: 0.05,
          releaseMul: 0.8,
        });
        break;
      case "sax":
        playMonoVoice(c, out, time, noteMidi, d * 0.8, gain, {
          wave: "sawtooth",
          lp: 2700,
          attack: 0.04,
          releaseMul: 0.82,
          q: 2.5,
        });
        break;
      case "oboe":
        playMonoVoice(c, out, time, noteMidi, d * 0.82, gain, {
          wave: "square",
          lp: 3100,
          attack: 0.05,
          releaseMul: 0.78,
          q: 3,
        });
        break;
      case "flute":
        playFluteOn(c, out, time, noteMidi, d * 0.85, gain);
        break;
      case "eguitar":
        playMonoVoice(c, out, time, noteMidi, d * 0.65, gain, {
          wave: "sawtooth",
          lp: 3500,
          attack: 0.008,
          releaseMul: 0.7,
        });
        break;
      case "organ":
        playOrganOn(c, out, time, noteMidi, d * 0.9, gain);
        break;
      case "pipeorgan":
        playPipeOrganOn(c, out, time, noteMidi, d * 0.95, gain);
        break;
      case "pluck":
        playPluckOn(c, out, time, noteMidi, d, gain);
        break;
      case "pad":
        playPadOn(c, out, time, noteMidi, d, gain);
        break;
      case "bells":
        playBellsOn(c, out, time, noteMidi, d * 0.75, gain);
        break;
      case "harp":
        playHarpOn(c, out, time, noteMidi, d, gain);
        break;
      case "brass":
        playBrassOn(c, out, time, noteMidi, d * 0.88, gain);
        break;
      case "strings":
        playStringsOn(c, out, time, noteMidi, d, gain);
        break;
      case "synth":
        playMonoVoice(c, out, time, noteMidi, d * 0.75, gain, {
          wave: "square",
          lp: 3000,
          attack: 0.01,
          releaseMul: 0.85,
        });
        break;
      default:
        playMonoVoice(c, out, time, noteMidi, d * 0.8, gain, {
          wave: "sine",
          lp: 3000,
          attack: 0.02,
          releaseMul: 0.85,
        });
        break;
    }
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
        playClapOn(c, out, time);
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
      case "tom":
        playTomOn(c, out, time);
        break;
      case "wood":
        playWoodOn(c, out, time);
        break;
      case "tri":
        playTriOn(c, out, time);
        break;
      case "perc":
        playPercOn(c, out, time);
        break;
      case "chord":
        if (noteMidi != null) {
          playChordOn(c, out, time, noteMidi, stepDuration * 0.9, 0.45);
        }
        break;
      default:
        playMelodic(c, out, voice, time, noteMidi, stepDuration, 0.42);
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
        playTrackSoundOn(c, (id) => gains[id], trackId, time, noteMidi, stepDuration);
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
