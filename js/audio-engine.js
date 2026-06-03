/**
 * HarmonyForge 音频引擎 — Tone.js 采样（InstrumentRegistry / InstrumentEngine）
 */
const AudioEngine = (() => {
  const MASTER_GAIN = 0.85;
  let ready = false;
  let playbackActive = false;
  let onSuspendWhilePlaying = null;
  const trackChannels = {};
  /** @type {Record<string, { instrumentId: string, inst: object, extras: any[] }>} */
  const trackInstruments = {};

  function resolveInstrumentId(trackId) {
    if (typeof Sequencer !== "undefined" && Sequencer.getTrack) {
      const t = Sequencer.getTrack(trackId);
      if (t?.engineId) return Instruments.resolveId(t.engineId);
      if (t?.instrumentId) return Instruments.resolveId(t.instrumentId);
    }
    return Instruments.resolveId(trackId);
  }

  function initEngine() {
    if (ready) return;
    Tone.getDestination().volume.value = Tone.gainToDb(MASTER_GAIN);
    ready = true;
    [
      "INS-001",
      "INS-002",
      "INS-003",
      "INS-004",
      "INS-005",
      "INS-006",
      "INS-007",
      "INS-008",
      "INS-009",
    ].forEach((id) => {
      InstrumentEngine.createAsync(id).catch((err) => {
        if (typeof AppLogger !== "undefined") {
          AppLogger.warn("采样预加载失败", id, err?.message || err);
        }
      });
    });
    if (typeof AppLogger !== "undefined") {
      AppLogger.info("Tone.js 采样引擎就绪", `v${Tone.version}`);
    }
  }

  function ensureContext() {
    initEngine();
    return Tone.getContext().rawContext;
  }

  async function unlockAudio() {
    await Tone.start();
    initEngine();
    return Tone.getContext().rawContext;
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
        if (Tone.getContext().state === "suspended" && playbackActive && onSuspendWhilePlaying) {
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
    getTrackChannel(trackId, vol).gain.rampTo(vol, 0.02);
  }

  function disposeTrackInstrument(trackId) {
    const entry = trackInstruments[trackId];
    if (entry) {
      InstrumentEngine.dispose(entry.inst, entry.extras);
      delete trackInstruments[trackId];
    }
  }

  function invalidateTrack(trackId) {
    disposeTrackInstrument(trackId);
  }

  async function ensureTrackInstrumentAsync(trackId, instrumentId) {
    const channel = getTrackChannel(trackId);
    const entry = trackInstruments[trackId];
    if (entry && entry.instrumentId === instrumentId && entry.inst) return entry.inst;
    if (entry) disposeTrackInstrument(trackId);
    const inst = await InstrumentEngine.createAsync(instrumentId);
    const extras = InstrumentEngine.connect(inst, channel);
    trackInstruments[trackId] = { instrumentId, inst, extras, ready: true };
    return inst;
  }

  function ensureTrackInstrument(trackId, instrumentId) {
    const preset = InstrumentRegistry.get(instrumentId);
    if (preset?.kind === "sampler") {
      const entry = trackInstruments[trackId];
      if (entry?.instrumentId === instrumentId && entry.inst) return entry.inst;
      ensureTrackInstrumentAsync(trackId, instrumentId).catch((err) => {
        if (typeof AppLogger !== "undefined") AppLogger.error("采样加载失败", err.message);
      });
      return entry?.inst || null;
    }
    const channel = getTrackChannel(trackId);
    const entry = trackInstruments[trackId];
    if (entry && entry.instrumentId === instrumentId && entry.inst) return entry.inst;
    if (entry) disposeTrackInstrument(trackId);
    const inst = InstrumentEngine.create(instrumentId);
    const extras = InstrumentEngine.connect(inst, channel);
    trackInstruments[trackId] = { instrumentId, inst, extras, ready: true };
    return inst;
  }

  function triggerInstrument(trackId, instrumentId, time, noteMidi, duration, velocity = 0.85) {
    const preset = InstrumentRegistry.get(instrumentId);
    if (preset?.kind === "empty") return;
    const t = Math.max(time, Tone.now() + 0.001);
    if (preset?.kind === "sampler") {
      ensureTrackInstrumentAsync(trackId, instrumentId)
        .then((inst) => {
          if (!inst) return;
          const playAt = Math.max(t, Tone.now() + 0.02);
          InstrumentEngine.trigger(inst, playAt, noteMidi, duration, velocity);
        })
        .catch((err) => {
          if (typeof AppLogger !== "undefined") {
            AppLogger.error("采样发声失败", instrumentId, err?.message || err);
          }
        });
      return;
    }
    const inst = ensureTrackInstrument(trackId, instrumentId);
    if (inst) InstrumentEngine.trigger(inst, t, noteMidi, duration, velocity);
  }

  function playVelocityFor(instrumentId) {
    const preset = InstrumentRegistry.get(instrumentId);
    if (!preset) return 0.78;
    if (InstrumentEngine.isDrumPreset(instrumentId)) return 0.85;
    if (preset.trigger === "chord_triad") return 0.55;
    if (preset.id === "INS-008") return 0.95;
    if (preset.id === "INS-007") return 0.82;
    return 0.78;
  }

  function playInstrumentOn(trackId, instrumentId, time, noteMidi, stepDuration) {
    const dur = InstrumentEngine.melodicDuration(instrumentId, stepDuration);
    const preset = InstrumentRegistry.get(instrumentId);
    if (preset?.trigger === "chord_triad" && noteMidi != null) {
      triggerInstrument(
        trackId,
        instrumentId,
        time,
        noteMidi,
        stepDuration * 0.9,
        playVelocityFor(instrumentId)
      );
      return;
    }
    if (InstrumentEngine.isDrumPreset(instrumentId)) {
      triggerInstrument(trackId, instrumentId, time, null, dur, 0.85);
      return;
    }
    triggerInstrument(trackId, instrumentId, time, noteMidi, dur, playVelocityFor(instrumentId));
  }

  function playTrackSoundOn(_c, _outGetter, trackId, time, noteMidi, stepDuration) {
    const instrumentId = resolveInstrumentId(trackId);
    playInstrumentOn(trackId, instrumentId, time, noteMidi, stepDuration);
  }

  function playTrackSound(trackId, time, noteMidi, stepDuration) {
    initEngine();
    const instrumentId = resolveInstrumentId(trackId);
    const t = typeof time === "number" ? time : Tone.now() + 0.01;
    if (!isRunning()) {
      if (playbackActive) return;
      unlockAudio()
        .then(() => playInstrumentOn(trackId, instrumentId, Tone.now() + 0.02, noteMidi, stepDuration))
        .catch(() => {});
      return;
    }
    playInstrumentOn(trackId, instrumentId, t, noteMidi, stepDuration);
  }

  async function previewTrackNote(trackId, midi, duration) {
    const instrumentId = resolveInstrumentId(trackId);
    const stepDur = InstrumentEngine.melodicDuration(
      instrumentId,
      duration != null ? duration : InstrumentEngine.previewDuration(instrumentId)
    );
    try {
      await unlockAudio();
      const inst = await ensureTrackInstrumentAsync(trackId, instrumentId);
      if (!inst) return;
      const playAt = Tone.now() + 0.03;
      InstrumentEngine.trigger(inst, playAt, midi, stepDur, playVelocityFor(instrumentId));
    } catch (err) {
      if (typeof AppLogger !== "undefined") {
        AppLogger.error("试听失败", instrumentId, err?.message || err);
      }
    }
  }

  function setTransportBpm(bpm) {
    Tone.Transport.bpm.value = bpm;
  }

  async function preloadInstrumentsForTracks(trackInstrumentMap) {
    const map = {};
    await Promise.all(
      Object.entries(trackInstrumentMap).map(async ([trackId, instrumentId]) => {
        const preset = InstrumentRegistry.get(instrumentId);
        if (!preset || preset.kind === "empty") return;
        map[trackId] = await InstrumentEngine.createAsync(instrumentId);
      })
    );
    return map;
  }

  function createOfflineScheduler(volumes, trackInstrumentMap, preloadedByTrack = {}) {
    const offlineTracks = {};

    function ensureOfflineTrack(trackId, instrumentId) {
      let cached = offlineTracks[trackId];
      if (cached && cached.instrumentId === instrumentId) return cached;
      if (cached) InstrumentEngine.dispose(cached.inst, cached.extras);
      const ch = new Tone.Gain(volumes[trackId] ?? 0.75).toDestination();
      const inst = preloadedByTrack[trackId];
      if (!inst) {
        throw new Error(`离线渲染缺少预加载音色: ${trackId} → ${instrumentId}`);
      }
      const extras = InstrumentEngine.connect(inst, ch);
      offlineTracks[trackId] = { instrumentId, inst, extras, channel: ch };
      return offlineTracks[trackId];
    }

    return {
      schedule(_ctx, _master, trackId, time, noteMidi, stepDuration) {
        const instrumentId = trackInstrumentMap?.[trackId] || resolveInstrumentId(trackId);
        const cached = ensureOfflineTrack(trackId, instrumentId);
        const dur = InstrumentEngine.melodicDuration(instrumentId, stepDuration);
        const preset = InstrumentRegistry.get(instrumentId);
        const noteDur =
          preset?.trigger === "chord_triad" && noteMidi != null ? stepDuration * 0.9 : dur;
        InstrumentEngine.trigger(cached.inst, time, noteMidi, noteDur, playVelocityFor(instrumentId));
      },
    };
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
    previewTrackNote,
    invalidateTrack,
    preloadInstrumentsForTracks,
    createOfflineScheduler,
    midiToFreq,
    resolveInstrumentId,
    getInstrumentToneLabel: (instrumentId) => {
      const p = InstrumentRegistry.get(instrumentId);
      return InstrumentRegistry.toneLabel(p);
    },
    getContext: () => ensureContext(),
  };
})();
