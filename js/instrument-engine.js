/**
 * Creates and triggers instruments from InstrumentRegistry (sampler or synth).
 */
const InstrumentEngine = (() => {
  function midiToNote(midi) {
    return Tone.Frequency(midi, "midi").toNote();
  }

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

  function pianoGateDuration(stepDuration) {
    const step = Math.max(stepDuration, 0.06);
    return Math.min(step * 0.48, 0.32);
  }

  function createSynth(preset) {
    const C = Tone[preset.toneClass];
    if (!C) throw new Error(`Unknown Tone class: ${preset.toneClass}`);
    if (preset.toneClass === "PolySynth" && preset.polyClass) {
      const Voice = Tone[preset.polyClass];
      return new C(Voice, {
        ...preset.polyOptions,
        voice: { ...preset.options },
      });
    }
    return new C(preset.options || {});
  }

  const samplerLoadCache = new Map();

  function createSamplerAsync(preset) {
    const { urls, baseUrl = "" } = preset.sampler || {};
    if (!urls || !Object.keys(urls).length) {
      return Promise.reject(new Error(`Sampler ${preset.id} has no urls`));
    }
    const cacheKey = preset.id;
    if (samplerLoadCache.has(cacheKey)) return samplerLoadCache.get(cacheKey);

    const promise = new Promise((resolve, reject) => {
      const sampler = new Tone.Sampler({
        urls,
        baseUrl,
        onload: () => resolve(sampler),
        onerror: (err) => reject(err || new Error("Sampler load failed")),
      });
    });
    samplerLoadCache.set(cacheKey, promise);
    return promise;
  }

  function useFallback(preset) {
    const fbId = preset.fallbackPresetId || preset.fallbackSynth;
    const fb = fbId ? InstrumentRegistry.get(fbId) : null;
    if (fb?.kind === "synth") {
      return { preset: fb, synth: createSynth(fb), kind: "synth", fallbackFrom: preset.id };
    }
    return null;
  }

  function createFromPreset(preset) {
    if (!preset) throw new Error("Missing preset");
    if (preset.kind === "empty") return { preset, synth: null, kind: "empty" };
    if (preset.kind === "sampler") throw new Error("Use createAsync for sampler");
    return { preset, synth: createSynth(preset), kind: "synth" };
  }

  function create(presetId) {
    const preset = InstrumentRegistry.get(presetId);
    if (!preset) throw new Error(`Unknown instrument: ${presetId}`);
    if (preset.kind === "empty") {
      return { preset, synth: null, kind: "empty" };
    }
    if (preset.kind === "sampler") {
      throw new Error(`Sampler ${presetId} requires createAsync()`);
    }
    return { preset, synth: createSynth(preset), kind: "synth" };
  }

  async function createAsync(presetId) {
    const preset = InstrumentRegistry.get(presetId);
    if (!preset) throw new Error(`Unknown instrument: ${presetId}`);
    if (preset.kind === "empty") {
      return { preset, synth: null, kind: "empty" };
    }
    if (preset.kind === "sampler") {
      try {
        const synth = await createSamplerAsync(preset);
        return { preset, synth, kind: "sampler" };
      } catch (err) {
        const fb = useFallback(preset);
        if (fb) {
          if (typeof AppLogger !== "undefined") {
            AppLogger.warn(`Sampler ${presetId} failed, using fallback`, err?.message || err);
          }
          return fb;
        }
        throw err;
      }
    }
    return { preset, synth: createSynth(preset), kind: "synth" };
  }

  function connect(inst, destination) {
    if (!inst?.synth) return [];
    const { preset, synth } = inst;
    if (preset.postChain === "piano_eq") {
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
      const gain = new Tone.Volume(5);
      bright.connect(gain);
      gain.connect(destination);
      return [mudCut, bright, gain];
    }
    synth.connect(destination);
    return [];
  }

  function dispose(inst, extras = []) {
    if (inst?.synth?.dispose) {
      try {
        inst.synth.dispose();
      } catch (_) {}
    }
    extras.forEach((node) => {
      try {
        node.dispose();
      } catch (_) {}
    });
  }

  function melodicDuration(presetId, stepDuration) {
    const preset = InstrumentRegistry.get(presetId);
    if (!preset) return stepDuration;
    const d = preset.duration || {};
    if (d.chordHold) return stepDuration * 0.9;
    if (d.melodicGate) return pianoGateDuration(stepDuration);
    if (d.melodicMin) return Math.max(stepDuration, d.melodicMin);
    return stepDuration;
  }

  function previewDuration(presetId) {
    const preset = InstrumentRegistry.get(presetId);
    return preset?.duration?.preview ?? 0.28;
  }

  function trigger(inst, time, noteMidi, duration, velocity = 0.85) {
    const { preset, synth } = inst;
    const t = Math.max(time, 0);
    const dur = Math.max(duration * 0.92, 0.03);
    const opts = preset.triggerOpts || {};

    switch (preset.trigger) {
      case "empty":
        return;
      case "sampler_drum":
        if (!synth?.triggerAttackRelease) return;
        synth.triggerAttackRelease(
          opts.note || "C2",
          opts.length || "8n",
          t,
          velocity * (opts.velocityScale ?? 1)
        );
        break;
      case "sampler_melodic":
        if (noteMidi == null || !synth?.triggerAttackRelease) return;
        {
          const vel =
            preset.id === "INS-008"
              ? Math.min(1, velocity * 1.02)
              : preset.id === "INS-007"
                ? velocity * 0.78
                : velocity * 0.88;
          synth.triggerAttackRelease(midiToNote(noteMidi), dur, t, vel);
        }
        break;
      case "chord_triad": {
        if (noteMidi == null || !synth?.triggerAttackRelease) return;
        const n = Tone.Frequency(midiToNote(noteMidi)).toMidi();
        const notes = [n, n + 4, n + 7].map((m) => midiToNote(m));
        synth.triggerAttackRelease(notes, dur, t, velocity * 0.42);
        break;
      }
      default:
        if (noteMidi == null || !synth?.triggerAttackRelease) return;
        synth.triggerAttackRelease(midiToNote(noteMidi), dur, t, velocity);
        break;
    }
  }

  function isDrumPreset(presetId) {
    const p = InstrumentRegistry.get(presetId);
    return p?.type === "drum";
  }

  return {
    create,
    createFromPreset,
    createAsync,
    connect,
    dispose,
    trigger,
    melodicDuration,
    previewDuration,
    isDrumPreset,
    getPianoStrikeParams,
    midiToNote,
  };
})();
