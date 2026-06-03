/**
 * HarmonyForge instrument registry — offline samplers only (builtins).
 */
const InstrumentRegistry = (() => {
  /** @typedef {'drum'|'melodic'} TrackType */
  /** @typedef {'sampler'|'synth'} EngineKind */
  /**
   * @typedef {object} Preset
   * @property {string} id
   * @property {EngineKind} kind
   * @property {TrackType} type
   * @property {string} toneClass
   * @property {string} trigger sampler_melodic | sampler_drum | chord_triad
   * @property {object} [triggerOpts]
   * @property {object} [sampler] { urls, baseUrl }
   * @property {object} [duration]
   * @property {string} synthesis
   */

  const PIANO_URLS = {
    A0: "A0.mp3",
    C1: "C1.mp3",
    "D#1": "Ds1.mp3",
    "F#1": "Fs1.mp3",
    A1: "A1.mp3",
    C2: "C2.mp3",
    "D#2": "Ds2.mp3",
    "F#2": "Fs2.mp3",
    A2: "A2.mp3",
    C3: "C3.mp3",
    "D#3": "Ds3.mp3",
    "F#3": "Fs3.mp3",
    A3: "A3.mp3",
    C4: "C4.mp3",
    "D#4": "Ds4.mp3",
    "F#4": "Fs4.mp3",
    A4: "A4.mp3",
    C5: "C5.mp3",
    "D#5": "Ds5.mp3",
    "F#5": "Fs5.mp3",
    A5: "A5.mp3",
    C6: "C6.mp3",
    "D#6": "Ds6.mp3",
    "F#6": "Fs6.mp3",
    A6: "A6.mp3",
    C7: "C7.mp3",
    "D#7": "Ds7.mp3",
    "F#7": "Fs7.mp3",
    A7: "A7.mp3",
    C8: "C8.mp3",
  };

  const PRESETS = [
    {
      id: "INS-000",
      kind: "empty",
      type: "melodic",
      toneClass: "Empty",
      trigger: "empty",
      synthesis: "Empty track carrier.",
    },

    {
      id: "INS-001",
      kind: "sampler",
      type: "drum",
      toneClass: "Sampler",
      trigger: "sampler_drum",
      triggerOpts: { note: "C2", length: "8n", velocityScale: 1 },
      sampler: { baseUrl: "samples/INS-001/", urls: { C2: "kick.mp3" } },
      duration: { preview: 0.2 },
      synthesis: "Sampler: offline kick (acoustic-kit).",
    },
    {
      id: "INS-002",
      kind: "sampler",
      type: "drum",
      toneClass: "Sampler",
      trigger: "sampler_drum",
      triggerOpts: { note: "D2", length: "8n", velocityScale: 0.95 },
      sampler: { baseUrl: "samples/INS-002/", urls: { D2: "snare.mp3" } },
      duration: { preview: 0.18 },
      synthesis: "Sampler: offline snare (acoustic-kit).",
    },
    {
      id: "INS-003",
      kind: "sampler",
      type: "drum",
      toneClass: "Sampler",
      trigger: "sampler_drum",
      triggerOpts: { note: "G4", length: "32n", velocityScale: 0.85 },
      sampler: { baseUrl: "samples/INS-003/", urls: { G4: "hihat.mp3" } },
      duration: { preview: 0.08 },
      synthesis: "Sampler: offline closed hi-hat.",
    },
    {
      id: "INS-004",
      kind: "sampler",
      type: "drum",
      toneClass: "Sampler",
      trigger: "sampler_drum",
      triggerOpts: { note: "A4", length: "16n", velocityScale: 0.8 },
      sampler: { baseUrl: "samples/INS-004/", urls: { A4: "openhat.mp3" } },
      duration: { preview: 0.25 },
      synthesis: "Sampler: offline open hi-hat.",
    },
    {
      id: "INS-005",
      kind: "sampler",
      type: "drum",
      toneClass: "Sampler",
      trigger: "sampler_drum",
      triggerOpts: { note: "B2", length: "8n", velocityScale: 0.9 },
      sampler: { baseUrl: "samples/INS-005/", urls: { B2: "tom.mp3" } },
      duration: { preview: 0.22 },
      synthesis: "Sampler: offline tom.",
    },
    {
      id: "INS-006",
      kind: "sampler",
      type: "drum",
      toneClass: "Sampler",
      trigger: "sampler_drum",
      triggerOpts: { note: "E4", length: "4n", velocityScale: 0.75 },
      sampler: { baseUrl: "samples/INS-006/", urls: { E4: "cymbal.mp3" } },
      duration: { preview: 0.35 },
      synthesis: "Sampler: offline cymbal / ride sample.",
    },

    {
      id: "INS-007",
      kind: "sampler",
      type: "melodic",
      toneClass: "Sampler",
      trigger: "sampler_melodic",
      sampler: {
        baseUrl: "samples/INS-007/",
        urls: {
          A1: "A1.mp3",
          C2: "C2.mp3",
          D2: "D2.mp3",
          E2: "E2.mp3",
          "F#2": "Fs2.mp3",
          G2: "G2.mp3",
        },
      },
      duration: { melodicMin: 0.28, preview: 0.4 },
      synthesis: "Sampler: offline bass multisample (Casio-style keys, bundled).",
    },

    {
      id: "INS-008",
      kind: "sampler",
      type: "melodic",
      toneClass: "Sampler",
      trigger: "sampler_melodic",
      postChain: "piano_eq",
      sampler: {
        baseUrl: "samples/INS-008/",
        urls: PIANO_URLS,
      },
      duration: { melodicMin: 0.2, preview: 0.5 },
      synthesis: "Sampler: offline Salamander piano multisamples in samples/INS-008/.",
    },

    {
      id: "INS-009",
      kind: "sampler",
      type: "melodic",
      toneClass: "Sampler",
      trigger: "chord_triad",
      sampler: {
        baseUrl: "samples/INS-009/",
        urls: { C3: "pad.mp3" },
      },
      duration: { chordHold: true, preview: 0.55 },
      synthesis: "Sampler: offline pad; chord_triad triggers three mapped notes.",
    },
  ];

  const userPresets = new Map();

  function rebuildIndex() {
    const map = {};
    PRESETS.forEach((p) => {
      map[p.id] = p;
    });
    userPresets.forEach((p, id) => {
      map[id] = p;
    });
    return map;
  }

  let byId = rebuildIndex();

  function get(id) {
    return byId[id] || null;
  }

  function list(typeFilter, opts = {}) {
    const includeEmpty = opts.includeEmpty === true;
    const items = [...PRESETS, ...userPresets.values()].filter((p) => {
      if (!opts.includeHidden && p.hidden) return false;
      if (p.kind === "empty" && !includeEmpty) return false;
      return true;
    });
    if (typeFilter) return items.filter((p) => p.type === typeFilter);
    return items;
  }

  function registerUserPreset(preset) {
    if (!preset?.id) return null;
    userPresets.set(preset.id, { ...preset, user: true });
    byId = rebuildIndex();
    return preset;
  }

  function unregisterUserPreset(id) {
    userPresets.delete(id);
    byId = rebuildIndex();
  }

  function isEmptyId(id) {
    return id === "INS-000";
  }

  function toneLabel(preset) {
    if (!preset) return "Sampler";
    if (preset.kind === "empty") return "Empty";
    return "Sampler";
  }

  return {
    PRESETS,
    EMPTY_ID: "INS-000",
    get,
    list,
    registerUserPreset,
    unregisterUserPreset,
    isEmptyId,
    toneLabel,
  };
})();
