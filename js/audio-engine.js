/**
 * HarmonyForge 音频引擎 — Tone.js 合成与调度
 * @see https://tonejs.github.io/
 */
const AudioEngine = (() => {
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

  function pianoNoteDuration(stepDuration) {
    return Math.max(stepDuration, 0.45);
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
      piano: 0.62,
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
          pitchDecay: 0.04,
          octaves: 8,
          envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.05 },
        });
      case "snare":
      case "clap":
        return new Tone.NoiseSynth({
          noise: { type: "white" },
          envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.05 },
        });
      case "hihat":
        return new Tone.MetalSynth({
          envelope: { attack: 0.001, decay: 0.04, release: 0.02 },
          harmonicity: 5.2,
          modulationIndex: 22,
          resonance: 7000,
          octaves: 0.8,
        });
      case "openhat":
        return new Tone.MetalSynth({
          envelope: { attack: 0.001, decay: 0.22, release: 0.08 },
          harmonicity: 4.5,
          modulationIndex: 18,
          resonance: 5000,
          octaves: 1.2,
        });
      case "cymbal":
      case "ride":
      case "splash":
        return new Tone.MetalSynth({
          envelope: { attack: 0.001, decay: 0.5, release: 0.15 },
          harmonicity: 5.8,
          modulationIndex: 28,
          resonance: 8000,
          octaves: 1.5,
        });
      case "tom":
      case "wood":
      case "tri":
      case "perc":
        return new Tone.MembraneSynth({
          pitchDecay: 0.03,
          octaves: 4,
          envelope: { attack: 0.001, decay: 0.28, sustain: 0, release: 0.06 },
        });
      case "bass":
        return new Tone.MonoSynth({
          oscillator: { type: "sawtooth" },
          filter: { Q: 2, type: "lowpass", rolloff: -24 },
          envelope: { attack: 0.02, decay: 0.25, sustain: 0.35, release: 0.2 },
        });
      case "piano":
        return new Tone.PolySynth(Tone.FMSynth, {
          maxPolyphony: 6,
          voice: {
            modulationIndex: 1.2,
            harmonicity: 3.5,
            oscillator: { type: "sine" },
            envelope: { attack: 0.01, decay: 0.3, sustain: 0.45, release: 0.8 },
          },
        });
      case "eguitar":
        return new Tone.PluckSynth({
          attackNoise: 0.6,
          dampening: 3200,
          resonance: 0.85,
          release: 0.4,
        });
      case "chord":
        return new Tone.PolySynth(Tone.AMSynth, {
          maxPolyphony: 8,
          voice: {
            harmonicity: 1.5,
            envelope: { attack: 0.08, decay: 0.35, sustain: 0.55, release: 0.9 },
          },
        });
      case "lead":
        return new Tone.MonoSynth({
          oscillator: { type: "sawtooth" },
          filter: { type: "lowpass", Q: 1.8, rolloff: -12 },
          envelope: { attack: 0.03, decay: 0.2, sustain: 0.65, release: 0.45 },
        });
      case "sax":
        return new Tone.FMSynth({
          harmonicity: 1.8,
          modulationIndex: 2.2,
          oscillator: { type: "sawtooth" },
          envelope: { attack: 0.05, decay: 0.2, sustain: 0.5, release: 0.35 },
        });
      case "trumpet":
        return new Tone.FMSynth({
          harmonicity: 2,
          modulationIndex: 3.5,
          oscillator: { type: "square" },
          envelope: { attack: 0.03, decay: 0.15, sustain: 0.55, release: 0.3 },
        });
      case "trombone":
        return new Tone.MonoSynth({
          oscillator: { type: "sawtooth" },
          filter: { type: "lowpass", frequency: 1800, Q: 2 },
          envelope: { attack: 0.06, decay: 0.25, sustain: 0.7, release: 0.4 },
        });
      case "violin":
        return new Tone.Synth({
          oscillator: { type: "triangle" },
          envelope: { attack: 0.12, decay: 0.15, sustain: 0.85, release: 0.55 },
        });
      case "cello":
        return new Tone.Synth({
          oscillator: { type: "sine" },
          envelope: { attack: 0.14, decay: 0.2, sustain: 0.88, release: 0.65 },
        });
      default:
        return new Tone.Synth({
          oscillator: { type: "sawtooth" },
          envelope: { attack: 0.02, decay: 0.2, sustain: 0.5, release: 0.3 },
        });
    }
  }

  function disposeTrackSynth(trackId) {
    const entry = trackSynths[trackId];
    if (entry?.synth?.dispose) {
      try {
        entry.synth.dispose();
      } catch (_) {}
    }
    delete trackSynths[trackId];
  }

  function ensureTrackSynth(trackId, voice) {
    const channel = getTrackChannel(trackId);
    const entry = trackSynths[trackId];
    if (entry && entry.voice === voice) return entry.synth;
    if (entry) disposeTrackSynth(trackId);
    const synth = createVoiceSynth(voice);
    synth.connect(channel);
    trackSynths[trackId] = { synth, voice, channel };
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
        if (!offlineTracks[trackId]) {
          const ch = new Tone.Gain(volumes[trackId] ?? 0.75).toDestination();
          const synth = createVoiceSynth(voice);
          synth.connect(ch);
          offlineTracks[trackId] = { channel: ch, synth, voice };
        }
        const { channel, synth, voice: v } = offlineTracks[trackId];
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
    createOfflineScheduler,
    midiToFreq,
    getContext: () => ensureContext(),
  };
})();
