/**
 * 步进音序器 — Pattern 与多轨数据
 */
const Sequencer = (() => {
  const DEFAULT_STEPS = 16;
  const MAX_STEPS = 64;
  const MIN_STEPS = 4;
  const STEP_ADD = 4;
  const DEFAULT_PATTERN_COUNT = 4;
  const MAX_PATTERNS = 16;
  const MIN_PATTERNS = 1;
  const MAX_TRACKS = 12;
  const MIN_TRACKS = 1;

  const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    pentatonic: [0, 2, 4, 7, 9],
    blues: [0, 3, 5, 6, 7, 10],
  };

  const SCALE_OPTIONS = [
    { id: "major", label: "大调" },
    { id: "minor", label: "小调" },
    { id: "pentatonic", label: "五声" },
    { id: "blues", label: "蓝调" },
  ];

  let trackLayout = Instruments.DEFAULT_LAYOUT.map((t) => ({ ...t }));
  let trackIdSeq = 0;

  let steps = DEFAULT_STEPS;
  let patterns = createEmptyPatterns(DEFAULT_PATTERN_COUNT);
  let currentPattern = 0;
  let volumes = {};
  let trackRates = {};

  const DEFAULT_ROOT_KEY = 0;
  const DEFAULT_SCALE_NAME = SCALE_OPTIONS[0].id;

  function normalizeScaleName(name) {
    if (!name || name === "dorian") return DEFAULT_SCALE_NAME;
    return SCALES[name] ? name : DEFAULT_SCALE_NAME;
  }

  function defaultTonality() {
    return { rootKey: DEFAULT_ROOT_KEY, scaleName: DEFAULT_SCALE_NAME };
  }

  function initTrackMeta() {
    volumes = {};
    trackRates = {};
    getTracks().forEach((t) => {
      volumes[t.id] = Instruments.defaultVolume(t.type);
      trackRates[t.id] = 1;
    });
  }

  initTrackMeta();

  function resolveTrack(entry) {
    const inst = Instruments.get(entry.instrumentId);
    if (!inst) return null;
    return {
      id: entry.trackId,
      instrumentId: entry.instrumentId,
      name: inst.name,
      type: inst.type,
      class: inst.class,
      voice: inst.voice,
    };
  }

  function getTracks() {
    return trackLayout.map(resolveTrack).filter(Boolean);
  }

  function getTrack(trackId) {
    return getTracks().find((t) => t.id === trackId) || null;
  }

  function nextTrackId() {
    trackIdSeq += 1;
    return `tr${trackIdSeq}`;
  }

  function normalizeTrackRate(rate) {
    return typeof TrackTiming !== "undefined"
      ? TrackTiming.normalizeRate(rate)
      : Number(rate) || 1;
  }

  function getTrackRate(trackId) {
    return normalizeTrackRate(trackRates[trackId] ?? 1);
  }

  function setTrackRate(trackId, rate) {
    trackRates[trackId] = normalizeTrackRate(rate);
  }

  function emptyCell() {
    return { on: false, note: null, rootKey: null, scaleName: null };
  }

  function resolveTonality(cell) {
    const def = defaultTonality();
    return {
      rootKey: cell?.rootKey != null ? cell.rootKey : def.rootKey,
      scaleName: cell?.scaleName ? normalizeScaleName(cell.scaleName) : def.scaleName,
    };
  }

  function getCellTonality(patternIndex, trackId, step) {
    const cell = patterns[patternIndex]?.[trackId]?.[step];
    return resolveTonality(cell);
  }

  function setCellTonality(patternIndex, trackId, step, rk, sn) {
    const cell = patterns[patternIndex][trackId][step];
    if (rk != null) cell.rootKey = rk;
    if (sn != null) cell.scaleName = normalizeScaleName(sn);
  }

  function getScaleNotesFor(rootK, scaleN, octaves = 3) {
    const scale = SCALES[scaleN] || SCALES.major;
    const rk = rootK;
    const notes = [];
    for (let oct = 2; oct < 2 + octaves; oct++) {
      scale.forEach((semi) => {
        const midi = (oct + 1) * 12 + rk + semi;
        if (midi >= 36 && midi <= 84) notes.push(midi);
      });
    }
    return [...new Set(notes)].sort((a, b) => a - b);
  }

  function ensurePatternRows(pattern) {
    getTracks().forEach((track) => {
      if (!pattern[track.id]) {
        pattern[track.id] = Array(steps).fill(null).map(() => emptyCell());
      }
    });
  }

  function createEmptyPattern() {
    const pattern = {};
    getTracks().forEach((track) => {
      pattern[track.id] = Array(steps).fill(null).map(() => emptyCell());
    });
    return pattern;
  }

  function createEmptyPatterns(count = DEFAULT_PATTERN_COUNT) {
    const n = Math.min(MAX_PATTERNS, Math.max(1, count));
    const p = [];
    for (let i = 0; i < n; i++) {
      p.push(createEmptyPattern());
    }
    return p;
  }

  function normalizeAllPatterns() {
    patterns.forEach((pattern) => {
      getTracks().forEach((track) => {
        const row = pattern[track.id];
        if (!row) {
          pattern[track.id] = Array(steps).fill(null).map(() => emptyCell());
          return;
        }
        while (row.length < steps) row.push(emptyCell());
        if (row.length > steps) row.length = steps;
      });
    });
  }

  function importTrackLayout(raw) {
    if (!raw || !Array.isArray(raw) || !raw.length) {
      trackLayout = Instruments.DEFAULT_LAYOUT.map((t) => ({ ...t }));
      initTrackMeta();
      return;
    }
    trackLayout = raw
      .map((t) => ({
        trackId: String(t.trackId || t.id || ""),
        instrumentId: Instruments.resolveId(
          String(t.instrumentId || t.trackId || "")
        ),
      }))
      .filter((t) => t.trackId && Instruments.get(t.instrumentId));
    if (!trackLayout.length) {
      trackLayout = Instruments.DEFAULT_LAYOUT.map((t) => ({ ...t }));
    }
    trackLayout.forEach((t) => {
      const n = Number(String(t.trackId).replace(/\D/g, ""));
      if (n > trackIdSeq) trackIdSeq = n;
    });
    initTrackMeta();
  }

  function addSteps(count = STEP_ADD) {
    const add = Math.min(count, MAX_STEPS - steps);
    if (add <= 0) return { ok: false, steps };
    steps += add;
    patterns.forEach((pattern) => {
      getTracks().forEach((track) => {
        ensurePatternRows(pattern);
        for (let i = 0; i < add; i++) {
          pattern[track.id].push(emptyCell());
        }
      });
    });
    return { ok: true, steps, added: add };
  }

  function removeSteps(count = STEP_ADD) {
    const remove = Math.min(count, steps - MIN_STEPS);
    if (remove <= 0) return { ok: false, steps };
    steps -= remove;
    patterns.forEach((pattern) => {
      getTracks().forEach((track) => {
        const row = pattern[track.id];
        if (row) row.length = steps;
      });
    });
    return { ok: true, steps, removed: remove };
  }

  function removePattern() {
    if (patterns.length <= MIN_PATTERNS) return { ok: false, count: patterns.length };
    patterns.pop();
    if (currentPattern >= patterns.length) currentPattern = patterns.length - 1;
    return { ok: true, count: patterns.length };
  }

  function addPattern() {
    if (patterns.length >= MAX_PATTERNS) return { ok: false, count: patterns.length };
    patterns.push(createEmptyPattern());
    return { ok: true, count: patterns.length };
  }

  function addTrack(instrumentId) {
    if (trackLayout.length >= MAX_TRACKS) {
      return { ok: false, count: trackLayout.length };
    }
    const inst = Instruments.get(instrumentId);
    if (!inst) return { ok: false, count: trackLayout.length };
    const trackId = nextTrackId();
    trackLayout.push({ trackId, instrumentId });
    volumes[trackId] = Instruments.defaultVolume(inst.type);
    trackRates[trackId] = 1;
    patterns.forEach((pattern) => {
      pattern[trackId] = Array(steps).fill(null).map(() => emptyCell());
    });
    return { ok: true, count: trackLayout.length, trackId };
  }

  function removeTrack() {
    if (trackLayout.length <= MIN_TRACKS) {
      return { ok: false, count: trackLayout.length };
    }
    const removed = trackLayout.pop();
    if (removed) {
      delete volumes[removed.trackId];
      delete trackRates[removed.trackId];
      patterns.forEach((pattern) => {
        delete pattern[removed.trackId];
      });
    }
    return { ok: true, count: trackLayout.length };
  }

  function setTrackInstrument(trackId, instrumentId) {
    const entry = trackLayout.find((t) => t.trackId === trackId);
    const inst = Instruments.get(instrumentId);
    if (!entry || !inst) return false;
    const prev = getTrack(trackId);
    entry.instrumentId = instrumentId;
    if (prev && prev.type !== inst.type) {
      const def = defaultTonality();
      const defaults = getScaleNotesFor(def.rootKey, def.scaleName);
      const mid = defaults[Math.floor(defaults.length / 2)] || 60;
      patterns.forEach((pattern) => {
        const row = pattern[trackId];
        if (!row) return;
        row.forEach((cell) => {
          if (inst.type === "drum") {
            cell.note = null;
          } else if (cell.on && cell.note == null) {
            cell.note = mid;
          }
        });
      });
    }
    return true;
  }

  const PIANO_MIDI_MIN = 48;
  const PIANO_MIDI_MAX = 80;

  function getScaleNotesForCell(patternIndex, trackId, step, octaves = 3) {
    const t = getCellTonality(patternIndex, trackId, step);
    let notes = getScaleNotesFor(t.rootKey, t.scaleName, octaves);
    const track = getTrack(trackId);
    if (track && (track.voice === "piano" || track.instrumentId === "piano")) {
      notes = notes.filter((m) => m >= PIANO_MIDI_MIN && m <= PIANO_MIDI_MAX);
      if (!notes.length) {
        notes = getScaleNotesFor(t.rootKey, t.scaleName, 2).filter(
          (m) => m >= PIANO_MIDI_MIN && m <= PIANO_MIDI_MAX
        );
      }
    }
    return notes;
  }

  function defaultMidiForTrack(trackId, patternIndex, step) {
    const notes = getScaleNotesForCell(patternIndex, trackId, step);
    if (!notes.length) return 60;
    const track = getTrack(trackId);
    if (track && (track.voice === "piano" || track.instrumentId === "piano")) {
      const mid = notes.filter((m) => m >= 55 && m <= 67);
      if (mid.length) return mid[Math.floor(mid.length / 2)];
    }
    return notes[Math.floor(notes.length / 2)];
  }

  function stepColumnHasContent(patternIndex, step) {
    const pattern = patterns[patternIndex];
    if (!pattern) return false;
    return getTracks().some((track) => pattern[track.id]?.[step]?.on);
  }

  function noteLabel(midi) {
    if (midi == null) return "";
    const name = KEYS[midi % 12];
    const oct = Math.floor(midi / 12) - 1;
    return `${name}${oct}`;
  }

  function toggleStep(patternIndex, trackId, step, noteMidi = null) {
    const cell = patterns[patternIndex][trackId][step];
    const track = getTrack(trackId);
    if (!track) return cell;
    if (track.type === "drum") {
      cell.on = !cell.on;
    } else {
      if (!cell.on && noteMidi == null) {
        cell.note = defaultMidiForTrack(trackId, patternIndex, step);
        cell.on = true;
      } else if (noteMidi != null) {
        cell.note = noteMidi;
        cell.on = true;
      } else {
        cell.on = false;
        cell.note = null;
      }
    }
    return cell;
  }

  function clearPattern(patternIndex) {
    patterns[patternIndex] = createEmptyPattern();
  }

  function loadDemoPatterns() {
    const demo = [
      { kick: [0, 4, 8, 12], snare: [4, 12], hihat: [0, 2, 4, 6, 8, 10, 12, 14] },
      { kick: [0, 3, 6, 10, 12], snare: [4, 8, 12], bass: [{ s: 0, n: 36 }, { s: 8, n: 43 }] },
      { kick: [0, 8], snare: [4, 12], chord: [{ s: 0, n: 48 }, { s: 8, n: 55 }], lead: [{ s: 4, n: 60 }, { s: 12, n: 64 }] },
      { kick: [0, 4, 8, 12], snare: [4, 12], hihat: [2, 6, 10, 14], openhat: [15], bass: [{ s: 0, n: 36 }, { s: 4, n: 38 }, { s: 8, n: 41 }, { s: 12, n: 43 }] },
    ];
    demo.forEach((d, pi) => {
      if (pi >= patterns.length) return;
      clearPattern(pi);
      Object.entries(d).forEach(([trackId, data]) => {
        if (!patterns[pi][trackId]) return;
        if (Array.isArray(data) && typeof data[0] === "number") {
          data.forEach((s) => {
            if (s < steps) patterns[pi][trackId][s].on = true;
          });
        } else if (Array.isArray(data)) {
          data.forEach(({ s, n }) => {
            if (s < steps) {
              patterns[pi][trackId][s].on = true;
              patterns[pi][trackId][s].note = n;
            }
          });
        }
      });
    });
  }

  function getPattern(index) {
    return patterns[index];
  }

  function exportState() {
    return {
      steps,
      patterns,
      trackLayout: trackLayout.map((t) => ({ ...t })),
      volumes,
      trackRates: { ...trackRates },
      currentPattern,
    };
  }

  function importState(state) {
    if (state.trackLayout) {
      importTrackLayout(state.trackLayout);
    } else {
      trackLayout = Instruments.DEFAULT_LAYOUT.map((t) => ({ ...t }));
      initTrackMeta();
    }
    if (state.steps != null) steps = Math.min(MAX_STEPS, Math.max(4, Number(state.steps) || DEFAULT_STEPS));
    if (state.patterns) {
      patterns = state.patterns;
      if (patterns.length > MAX_PATTERNS) patterns = patterns.slice(0, MAX_PATTERNS);
      if (patterns.length < 1) patterns = createEmptyPatterns(1);
    }
    if (state.volumes) volumes = { ...volumes, ...state.volumes };
    if (state.trackRates) {
      getTracks().forEach((t) => {
        if (state.trackRates[t.id] != null) {
          trackRates[t.id] = normalizeTrackRate(state.trackRates[t.id]);
        }
      });
    }
    if (state.currentPattern != null) currentPattern = state.currentPattern;
    normalizeAllPatterns();
    if (currentPattern >= patterns.length) currentPattern = 0;
  }

  return {
    get STEPS() {
      return steps;
    },
    get steps() {
      return steps;
    },
    get patternCount() {
      return patterns.length;
    },
    get PATTERN_COUNT() {
      return patterns.length;
    },
    get TRACKS() {
      return getTracks();
    },
    get trackCount() {
      return trackLayout.length;
    },
    MAX_STEPS,
    MAX_PATTERNS,
    MAX_TRACKS,
    MIN_TRACKS,
    STEP_ADD,
    DEFAULT_PATTERN_COUNT,
    getTracks,
    getTrack,
    KEYS,
    SCALE_OPTIONS,
    SCALES,
    patterns: () => patterns,
    currentPattern: () => currentPattern,
    setCurrentPattern: (i) => {
      currentPattern = i;
    },
    defaultTonality,
    volumes: () => volumes,
    setVolume: (id, v) => {
      volumes[id] = v;
    },
    trackRates: () => ({ ...trackRates }),
    getTrackRate,
    setTrackRate,
    getScaleNotesFor,
    getScaleNotesForCell,
    defaultMidiForTrack,
    PIANO_MIDI_MIN,
    PIANO_MIDI_MAX,
    getCellTonality,
    setCellTonality,
    stepColumnHasContent,
    noteLabel,
    toggleStep,
    clearPattern,
    loadDemoPatterns,
    getPattern,
    exportState,
    importState,
    createEmptyPatterns,
    addSteps,
    removeSteps,
    addPattern,
    removePattern,
    addTrack,
    removeTrack,
    setTrackInstrument,
    MIN_STEPS,
    MIN_PATTERNS,
    normalizeAllPatterns,
    listInstruments: Instruments.list,
  };
})();
