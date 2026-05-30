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

  const TRACKS = [
    { id: "kick", name: "底鼓", type: "drum", class: "drum-kick" },
    { id: "snare", name: "军鼓", type: "drum", class: "drum-snare" },
    { id: "hihat", name: "闭镲", type: "drum", class: "drum-hat" },
    { id: "openhat", name: "开镲", type: "drum", class: "drum-open" },
    { id: "bass", name: "贝斯", type: "melodic", class: "bass" },
    { id: "chord", name: "和弦", type: "melodic", class: "chord" },
    { id: "lead", name: "主旋律", type: "melodic", class: "lead" },
  ];

  const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

  const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    pentatonic: [0, 2, 4, 7, 9],
    dorian: [0, 2, 3, 5, 7, 9, 10],
  };

  let steps = DEFAULT_STEPS;
  let patterns = createEmptyPatterns(DEFAULT_PATTERN_COUNT);
  let currentPattern = 0;
  let rootKey = 0;
  let scaleName = "major";
  let volumes = {};
  TRACKS.forEach((t) => { volumes[t.id] = t.type === "drum" ? 0.85 : 0.75; });

  function emptyCell() {
    return { on: false, note: null };
  }

  function createEmptyPattern() {
    const pattern = {};
    TRACKS.forEach((track) => {
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
      TRACKS.forEach((track) => {
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

  function addSteps(count = STEP_ADD) {
    const add = Math.min(count, MAX_STEPS - steps);
    if (add <= 0) return { ok: false, steps };
    steps += add;
    patterns.forEach((pattern) => {
      TRACKS.forEach((track) => {
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
      TRACKS.forEach((track) => {
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

  function getScaleNotes(octaves = 3) {
    const scale = SCALES[scaleName] || SCALES.major;
    const notes = [];
    for (let oct = 2; oct < 2 + octaves; oct++) {
      scale.forEach((semi) => {
        const midi = (oct + 1) * 12 + rootKey + semi;
        if (midi >= 36 && midi <= 84) notes.push(midi);
      });
    }
    return [...new Set(notes)].sort((a, b) => a - b);
  }

  function noteLabel(midi) {
    if (midi == null) return "";
    const name = KEYS[midi % 12];
    const oct = Math.floor(midi / 12) - 1;
    return `${name}${oct}`;
  }

  function toggleStep(patternIndex, trackId, step, noteMidi = null) {
    const cell = patterns[patternIndex][trackId][step];
    const track = TRACKS.find((t) => t.id === trackId);
    if (track.type === "drum") {
      cell.on = !cell.on;
    } else {
      if (!cell.on && noteMidi == null) {
        const defaults = getScaleNotes();
        cell.note = defaults[Math.floor(defaults.length / 2)] || 60;
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
      volumes,
      rootKey,
      scaleName,
      currentPattern,
    };
  }

  function importState(state) {
    if (state.steps != null) steps = Math.min(MAX_STEPS, Math.max(4, Number(state.steps) || DEFAULT_STEPS));
    if (state.patterns) {
      patterns = state.patterns;
      if (patterns.length > MAX_PATTERNS) patterns = patterns.slice(0, MAX_PATTERNS);
      if (patterns.length < 1) patterns = createEmptyPatterns(1);
    }
    if (state.volumes) volumes = { ...volumes, ...state.volumes };
    if (state.rootKey != null) rootKey = state.rootKey;
    if (state.scaleName) scaleName = state.scaleName;
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
    MAX_STEPS,
    MAX_PATTERNS,
    STEP_ADD,
    DEFAULT_PATTERN_COUNT,
    TRACKS,
    KEYS,
    patterns: () => patterns,
    currentPattern: () => currentPattern,
    setCurrentPattern: (i) => { currentPattern = i; },
    rootKey: () => rootKey,
    setRootKey: (k) => { rootKey = k; },
    scaleName: () => scaleName,
    setScaleName: (s) => { scaleName = s; },
    volumes: () => volumes,
    setVolume: (id, v) => { volumes[id] = v; },
    getScaleNotes,
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
    MIN_STEPS,
    MIN_PATTERNS,
    normalizeAllPatterns,
  };
})();
