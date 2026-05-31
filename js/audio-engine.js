/**
 * HarmonyForge 音频引擎 — Tone.js 合成与调度
 * voice → 合成器（与 instruments.js 中 voice 字段一一对应）
 * @see https://tonejs.github.io/
 */
const AudioEngine = (() => {
  /** @type {Record<string, string>} 音色与 Tone 合成器类型对照（便于维护） */
  const VOICE_SYNTH_KIND = {
    kick: "MembraneSynth",
    snare: "NoiseSynth",
    clap: "NoiseSynth",
    hihat: "MetalSynth",
    openhat: "MetalSynth",
    cymbal: "MetalSynth",
    tom: "MembraneSynth",
    bass: "MonoSynth",
    piano: "PolySynth(FMSynth)",
    eguitar: "PluckSynth",
    chord: "PolySynth(AMSynth)",
    lead: "MonoSynth",
    sax: "MonoSynth",
    trumpet: "FMSynth",
    trombone: "MonoSynth",
    violin: "MonoSynth",
    cello: "MonoSynth",
  };
  const MASTER_GAIN = 0.85;
  let ready = false;
  let playbackActive = false;
  let onSuspendWhilePlaying = null;
  const trackChannels = {};
  const trackSynths = {};

  function resolveVoice(trackId) {
    if (typeof Sequencer !== "undefined" && Sequencer.getTrack) {
      const t = Sequencer.getTrack(trackId);
      if (t?.voice) return t.voice;
    }
    return trackId;
  }

  function midiToNote(midi) {
    return Tone.Frequency(midi, "midi").toNote();
  }

  /**
   * 按音高区分钢琴击弦/编钟感参数（低音非谐波、极短调制，避免中低音像管乐）
   * @param {number} noteMidi
   */
  function getPianoStrikeParams(noteMidi) {
    const m = typeof noteMidi === "number" ? noteMidi : 60;
    const modEnv = { attack: 0.001, sustain: 0, release: 0.008 };
    const ampEnv = { attack: 0.001, sustain: 0 };

    if (m < 50) {
      return {
        harmonicity: 7.8,
        modulationIndex: 3.2,
        oscillator: { type: "sine" },
        modulation: { type: "sine" },
        envelope: { ...ampEnv, decay: 0.5, release: 0.72 },
        modulationEnvelope: { ...modEnv, decay: 0.01 },
      };
    }
    if (m < 62) {
      return {
        harmonicity: 6.2,
        modulationIndex: 3.8,
        oscillator: { type: "sine" },
        modulation: { type: "sine" },
        envelope: { ...ampEnv, decay: 0.44, release: 0.65 },
        modulationEnvelope: { ...modEnv, decay: 0.014 },
      };
    }
    if (m < 72) {
      return {
        harmonicity: 3.8,
        modulationIndex: 5.2,
        oscillator: { type: "triangle" },
        modulation: { type: "sine" },
        envelope: { ...ampEnv, decay: 0.36, release: 0.58 },
        modulationEnvelope: { ...modEnv, decay: 0.02 },
      };
    }
    return {
      harmonicity: 2.01,
      modulationIndex: 6.5,
      oscillator: { type: "triangle" },
      modulation: { type: "sine" },
      envelope: { ...ampEnv, decay: 0.34, release: 0.55 },
      modulationEnvelope: { ...modEnv, decay: 0.032 },
    };
  }

  function applyPianoStrikeParams(synth, noteMidi) {
    if (synth?.set) synth.set(getPianoStrikeParams(noteMidi));
  }

  /** 钢琴按键按住：够让 decay 展开，偏敲击衰减 */
  function pianoGateDuration(stepDuration) {
    const step = Math.max(stepDuration, 0.06);
    return Math.min(step * 0.48, 0.32);
  }

  function pianoNoteDuration(stepDuration) {
    return pianoGateDuration(stepDuration);
  }

  function leadNoteDuration(stepDuration) {
    return Math.max(stepDuration, 0.58);
  }

  function melodicNoteDuration(voice, stepDuration) {
    if (voice === "piano") return pianoNoteDuration(stepDuration);
    if (voice === "violin") return Math.max(stepDuration, 0.68);
    if (voice === "cello") return Math.max(stepDuration, 0.72);
    if (voice === "lead") return leadNoteDuration(stepDuration);
    if (voice === "bass" || voice === "trombone") return Math.max(stepDuration, 0.32);
    if (voice === "sax" || voice === "trumpet") return Math.max(stepDuration, 0.36);
    return stepDuration;
  }

  function previewDurationForVoice(voice) {
    const map = {
      piano: 0.38,
      bass: 0.42,
      cello: 0.78,
      violin: 0.74,
      lead: 0.62,
      sax: 0.52,
      trumpet: 0.44,
      trombone: 0.48,
      eguitar: 0.34,
    };
    return map[voice] ?? 0.28;
  }

  function createVoiceSynth(voice) {
    switch (voice) {
      case "kick":
        return new Tone.MembraneSynth({
          pitchDecay: 0.05,
          octaves: 10,
          oscillator: { type: "sine" },
          envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.08 },
        });
      case "snare":
      case "clap":
        return new Tone.NoiseSynth({
          noise: { type: "pink" },
          envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.06 },
        });
      case "hihat":
        return new Tone.MetalSynth({
          envelope: { attack: 0.001, decay: 0.035, release: 0.01 },
          harmonicity: 5.1,
          modulationIndex: 32,
          resonance: 7500,
          octaves: 0.6,
        });
      case "openhat":
        return new Tone.MetalSynth({
          envelope: { attack: 0.001, decay: 0.28, release: 0.12 },
          harmonicity: 4.2,
          modulationIndex: 24,
          resonance: 5200,
          octaves: 1.4,
        });
      case "cymbal":
      case "ride":
      case "splash":
        return new Tone.MetalSynth({
          envelope: { attack: 0.001, decay: 0.65, release: 0.2 },
          harmonicity: 5.5,
          modulationIndex: 36,
          resonance: 9000,
          octaves: 1.8,
        });
      case "tom":
      case "wood":
      case "tri":
      case "perc":
        return new Tone.MembraneSynth({
          pitchDecay: 0.04,
          octaves: 5,
          envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.08 },
        });
      case "bass":
        return new Tone.MonoSynth({
          oscillator: { type: "sawtooth" },
          filter: { Q: 2.5, type: "lowpass", rolloff: -24, frequency: 380 },
          filterEnvelope: {
            attack: 0.01,
            decay: 0.18,
            sustain: 0.25,
            release: 0.2,
            baseFrequency: 90,
            octaves: 3.8,
          },
          envelope: { attack: 0.008, decay: 0.24, sustain: 0.3, release: 0.22 },
        });
      case "piano":
        return new Tone.PolySynth(Tone.FMSynth, {
          maxPolyphony: 8,
          voice: {
            volume: -2,
            ...getPianoStrikeParams(60),
          },
        });
      case "eguitar":
        return new Tone.PluckSynth({
          attackNoise: 0.85,
          dampening: 2400,
          resonance: 0.78,
          release: 0.55,
        });
      case "chord":
        return new Tone.PolySynth(Tone.AMSynth, {
          maxPolyphony: 8,
          voice: {
            harmonicity: 2.2,
            oscillator: { type: "square" },
            envelope: { attack: 0.06, decay: 0.3, sustain: 0.62, release: 1.1 },
          },
        });
      case "lead":
        return new Tone.MonoSynth({
          oscillator: { type: "sawtooth" },
          filter: { type: "lowpass", frequency: 2800, Q: 2, rolloff: -12 },
          filterEnvelope: {
            attack: 0.02,
            decay: 0.15,
            sustain: 0.55,
            release: 0.35,
            baseFrequency: 600,
            octaves: 2.8,
          },
          envelope: { attack: 0.02, decay: 0.18, sustain: 0.7, release: 0.4 },
        });
      case "sax":
        return new Tone.MonoSynth({
          oscillator: { type: "sawtooth" },
          filter: { type: "bandpass", frequency: 1100, Q: 2.8, rolloff: -12 },
          filterEnvelope: {
            attack: 0.07,
            decay: 0.16,
            sustain: 0.55,
            release: 0.28,
            baseFrequency: 700,
            octaves: 2.6,
          },
          envelope: { attack: 0.09, decay: 0.16, sustain: 0.58, release: 0.32 },
        });
      case "trumpet":
        return new Tone.FMSynth({
          harmonicity: 2.4,
          modulationIndex: 6.5,
          oscillator: { type: "sine" },
          modulation: { type: "square" },
          envelope: { attack: 0.02, decay: 0.14, sustain: 0.52, release: 0.28 },
          modulationEnvelope: {
            attack: 0.01,
            decay: 0.1,
            sustain: 0.25,
            release: 0.12,
          },
        });
      case "trombone":
        return new Tone.MonoSynth({
          oscillator: { type: "sawtooth" },
          filter: { type: "lowpass", frequency: 1200, Q: 2.2, rolloff: -24 },
          filterEnvelope: {
            attack: 0.08,
            decay: 0.2,
            sustain: 0.65,
            release: 0.38,
            baseFrequency: 280,
            octaves: 2.2,
          },
          envelope: { attack: 0.07, decay: 0.22, sustain: 0.72, release: 0.42 },
        });
      case "violin":
        return new Tone.MonoSynth({
          portamento: 0.04,
          oscillator: { type: "sawtooth" },
          filter: { type: "lowpass", frequency: 2200, Q: 1.6, rolloff: -12 },
          filterEnvelope: {
            attack: 0.22,
            decay: 0.14,
            sustain: 0.72,
            release: 0.35,
            baseFrequency: 900,
            octaves: 2.4,
          },
          envelope: { attack: 0.2, decay: 0.1, sustain: 0.9, release: 0.48 },
        });
      case "cello":
        return new Tone.MonoSynth({
          portamento: 0.05,
          oscillator: { type: "fatsawtooth", spread: 18, count: 3 },
          filter: { type: "lowpass", frequency: 750, Q: 1.4, rolloff: -24 },
          filterEnvelope: {
            attack: 0.26,
            decay: 0.18,
            sustain: 0.75,
            release: 0.45,
            baseFrequency: 320,
            octaves: 1.6,
          },
          envelope: { attack: 0.24, decay: 0.14, sustain: 0.92, release: 0.62 },
        });
      default:
        if (typeof AppLogger !== "undefined" && VOICE_SYNTH_KIND[voice] === undefined) {
          AppLogger.warn("未知音色 voice，使用默认 Synth", voice);
        }
        return new Tone.Synth({
          oscillator: { type: "sawtooth" },
          envelope: { attack: 0.02, decay: 0.2, sustain: 0.5, release: 0.3 },
        });
    }
  }

  function connectVoiceSynth(synth, voice, destination) {
    if (voice !== "piano") {
      synth.connect(destination);
      return { synth, extras: [] };
    }
    const mudCut = new Tone.Filter(140, "highpass", -12);
    const bright = new Tone.EQ3({
      low: -3.5,
      mid: 1,
      high: 5,
      lowFrequency: 200,
      highFrequency: 3600,
    });
    synth.connect(mudCut);
    mudCut.connect(bright);
    bright.connect(destination);
    return { synth, extras: [mudCut, bright] };
  }

  function disposeTrackSynth(trackId) {
    const entry = trackSynths[trackId];
    if (entry?.synth?.dispose) {
      try {
        entry.synth.dispose();
      } catch (_) {}
    }
    if (entry?.extras) {
      entry.extras.forEach((node) => {
        try {
          node.dispose();
        } catch (_) {}
      });
    }
    delete trackSynths[trackId];
  }

  /** 切换轨音色后调用，避免仍用旧合成器发声 */
  function invalidateTrack(trackId) {
    disposeTrackSynth(trackId);
  }

  function ensureTrackSynth(trackId, voice) {
    const channel = getTrackChannel(trackId);
    const entry = trackSynths[trackId];
    if (entry && entry.voice === voice) return entry.synth;
    if (entry) disposeTrackSynth(trackId);
    const raw = createVoiceSynth(voice);
    const { synth, extras } = connectVoiceSynth(raw, voice, channel);
    trackSynths[trackId] = { synth, voice, channel, extras };
    return synth;
  }

  function initEngine() {
    if (ready) return;
    Tone.getDestination().volume.value = Tone.gainToDb(MASTER_GAIN);
    ready = true;
    if (typeof AppLogger !== "undefined") {
      AppLogger.info("Tone.js 引擎就绪", `v${Tone.version}`);
    }
  }

  function ensureContext() {
    initEngine();
    return Tone.getContext().rawContext;
  }

  async function unlockAudio() {
    await Tone.start();
    initEngine();
    const ctx = Tone.getContext().rawContext;
    if (ctx.state !== "running" && typeof AppLogger !== "undefined") {
      AppLogger.warn("AudioContext 状态", ctx.state);
    }
    return ctx;
  }

  function isRunning() {
    return Tone.getContext().state === "running";
  }

  function now() {
    return Tone.now();
  }

  function setPlaybackActive(active) {
    playbackActive = !!active;
  }

  function setOnSuspendWhilePlaying(fn) {
    onSuspendWhilePlaying = typeof fn === "function" ? fn : null;
    if (onSuspendWhilePlaying && !Tone._hfSuspendHook) {
      Tone._hfSuspendHook = true;
      Tone.getContext().rawContext.addEventListener("statechange", () => {
        const state = Tone.getContext().state;
        if (state === "suspended" && playbackActive && onSuspendWhilePlaying) {
          onSuspendWhilePlaying();
        }
      });
    }
  }

  function getTrackChannel(trackId, defaultVol = 0.8) {
    initEngine();
    if (!trackChannels[trackId]) {
      trackChannels[trackId] = new Tone.Gain(defaultVol).connect(Tone.getDestination());
    }
    return trackChannels[trackId];
  }

  function setTrackVolume(trackId, vol) {
    const ch = getTrackChannel(trackId, vol);
    ch.gain.rampTo(vol, 0.02);
  }

  function triggerVoice(trackId, voice, time, noteMidi, duration, velocity = 0.9) {
    const synth = ensureTrackSynth(trackId, voice);
    const t = Math.max(time, Tone.now() + 0.001);
    triggerOnSynth(synth, voice, t, noteMidi, duration, velocity);
  }

  function playVoiceOn(trackId, voice, time, noteMidi, stepDuration) {
    const dur = melodicNoteDuration(voice, stepDuration);
    if (voice === "chord" && noteMidi != null) {
      triggerVoice(trackId, voice, time, noteMidi, stepDuration * 0.9, 0.42);
      return;
    }
    if (
      voice === "kick" ||
      voice === "snare" ||
      voice === "clap" ||
      voice === "hihat" ||
      voice === "openhat" ||
      voice === "cymbal" ||
      voice === "tom"
    ) {
      triggerVoice(trackId, voice, time, null, dur, 0.85);
      return;
    }
    triggerVoice(trackId, voice, time, noteMidi, dur, 0.42);
  }

  function playTrackSoundOn(_c, _outGetter, trackId, time, noteMidi, stepDuration) {
    const voice = resolveVoice(trackId);
    playVoiceOn(trackId, voice, time, noteMidi, stepDuration);
  }

  function playTrackSound(trackId, time, noteMidi, stepDuration) {
    initEngine();
    const voice = resolveVoice(trackId);
    const dur =
      voice === "chord" && noteMidi != null
        ? stepDuration * 0.9
        : melodicNoteDuration(voice, stepDuration);
    const t = typeof time === "number" ? time : Tone.now() + 0.01;
    if (!isRunning()) {
      if (playbackActive) return;
      unlockAudio()
        .then(() => triggerVoice(trackId, voice, Tone.now() + 0.02, noteMidi, dur, 0.85))
        .catch(() => {});
      return;
    }
    triggerVoice(trackId, voice, t, noteMidi, dur, 0.85);
  }

  function previewTrackNote(trackId, midi, duration) {
    const voice = resolveVoice(trackId);
    const stepDur = melodicNoteDuration(
      voice,
      duration != null ? duration : previewDurationForVoice(voice)
    );
    unlockAudio()
      .then(() => {
        triggerVoice(trackId, voice, Tone.now() + 0.03, midi, stepDur, 0.8);
      })
      .catch(() => {});
  }

  function setTransportBpm(bpm) {
    Tone.Transport.bpm.value = bpm;
  }

  function createOfflineScheduler(volumes, trackVoiceMap) {
    const offlineTracks = {};
    return {
      schedule(_ctx, _master, trackId, time, noteMidi, stepDuration) {
        const voice = trackVoiceMap?.[trackId] || resolveVoice(trackId);
        const cached = offlineTracks[trackId];
        if (!cached || cached.voice !== voice) {
          if (cached?.synth?.dispose) {
            try {
              cached.synth.dispose();
            } catch (_) {}
          }
          if (cached?.extras) {
            cached.extras.forEach((node) => {
              try {
                node.dispose();
              } catch (_) {}
            });
          }
          const ch = new Tone.Gain(volumes[trackId] ?? 0.75).toDestination();
          const raw = createVoiceSynth(voice);
          const { synth, extras } = connectVoiceSynth(raw, voice, ch);
          offlineTracks[trackId] = { channel: ch, synth, voice, extras };
        }
        const { synth, voice: v } = offlineTracks[trackId];
        const dur =
          v === "chord" && noteMidi != null
            ? stepDuration * 0.9
            : melodicNoteDuration(v, stepDuration);
        triggerOnSynth(synth, v, time, noteMidi, dur, 0.85);
      },
    };
  }

  function triggerOnSynth(synth, voice, time, noteMidi, duration, velocity) {
    const t = Math.max(time, 0);
    const dur = Math.max(duration * 0.92, 0.03);
    switch (voice) {
      case "kick":
        synth.triggerAttackRelease("C1", dur, t, velocity);
        break;
      case "snare":
      case "clap":
        synth.triggerAttackRelease(dur, t, velocity);
        break;
      case "hihat":
        synth.triggerAttackRelease("C6", "32n", t, velocity * 0.7);
        break;
      case "openhat":
        synth.triggerAttackRelease("C6", "8n", t, velocity * 0.65);
        break;
      case "cymbal":
      case "ride":
      case "splash":
        synth.triggerAttackRelease("C6", "2n", t, velocity * 0.55);
        break;
      case "tom":
      case "wood":
      case "tri":
      case "perc":
        synth.triggerAttackRelease("G2", dur, t, velocity * 0.85);
        break;
      case "chord": {
        if (noteMidi == null) return;
        const n = Tone.Frequency(midiToNote(noteMidi)).toMidi();
        const notes = [n, n + 4, n + 7].map((m) => midiToNote(m));
        synth.triggerAttackRelease(notes, dur, t, velocity * 0.42);
        break;
      }
      case "piano": {
        if (noteMidi == null) return;
        applyPianoStrikeParams(synth, noteMidi);
        const gate = pianoGateDuration(duration);
        synth.triggerAttackRelease(midiToNote(noteMidi), gate, t, velocity * 0.92);
        break;
      }
      case "violin":
      case "cello":
        if (noteMidi == null) return;
        synth.triggerAttackRelease(midiToNote(noteMidi), dur, t, velocity * 0.52);
        break;
      case "bass":
        if (noteMidi == null) return;
        synth.triggerAttackRelease(midiToNote(noteMidi), dur, t, velocity * 0.75);
        break;
      case "eguitar":
        if (noteMidi == null) return;
        synth.triggerAttackRelease(midiToNote(noteMidi), dur * 0.85, t, velocity * 0.7);
        break;
      default:
        if (noteMidi == null) return;
        synth.triggerAttackRelease(midiToNote(noteMidi), dur, t, velocity);
        break;
    }
  }

  function midiToFreq(midi) {
    return Tone.Frequency(midi, "midi").toFrequency();
  }

  return {
    ensureContext,
    unlockAudio,
    isRunning,
    now,
    setPlaybackActive,
    setOnSuspendWhilePlaying,
    setTrackVolume,
    setTransportBpm,
    playTrackSound,
    playTrackSoundOn,
    playVoiceOn,
    previewTrackNote,
    invalidateTrack,
    createOfflineScheduler,
    midiToFreq,
    getVoiceSynthKind: (voice) => VOICE_SYNTH_KIND[voice] || "Synth",
    getContext: () => ensureContext(),
  };
})();
