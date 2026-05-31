/**
 * 音色目录 — 按听感命名（非乐器名），每件独立合成
 */
const Instruments = (() => {
  /** 旧工程 ID → 现音色 ID（仅解析轨，合成以现 ID 为准） */
  const LEGACY_IDS = {
    ride: "cymbal",
    splash: "cymbal",
    clap: "snare",
    wood: "tom",
    tri: "tom",
    perc: "tom",
    viola: "violin",
    clarinet: "sax",
    oboe: "sax",
    flute: "sax",
    organ: "piano",
    pipeorgan: "piano",
    pluck: "eguitar",
    pad: "piano",
    bells: "piano",
    harp: "cello",
    brass: "trumpet",
    strings: "violin",
    synth: "lead",
    woodblock: "tom",
  };

  const CATALOG = [
    { id: "kick", name: "沉击", type: "drum", voice: "kick", class: "drum-kick" },
    { id: "snare", name: "脆击", type: "drum", voice: "snare", class: "drum-snare" },
    { id: "hihat", name: "细擦", type: "drum", voice: "hihat", class: "drum-hat" },
    { id: "openhat", name: "开擦", type: "drum", voice: "openhat", class: "drum-open" },
    { id: "tom", name: "中击", type: "drum", voice: "tom", class: "drum-tom" },
    { id: "cymbal", name: "飞擦", type: "drum", voice: "cymbal", class: "drum-cymbal" },
    { id: "bass", name: "厚底", type: "melodic", voice: "bass", class: "bass" },
    { id: "piano", name: "击亮", type: "melodic", voice: "piano", class: "melodic-piano" },
    { id: "eguitar", name: "拨清", type: "melodic", voice: "eguitar", class: "melodic-eguitar" },
    { id: "chord", name: "垫暖", type: "melodic", voice: "chord", class: "chord" },
    { id: "lead", name: "句亮", type: "melodic", voice: "lead", class: "lead" },
    { id: "sax", name: "簧亮", type: "melodic", voice: "sax", class: "melodic-sax" },
    { id: "trumpet", name: "铜尖", type: "melodic", voice: "trumpet", class: "melodic-trumpet" },
    { id: "trombone", name: "铜厚", type: "melodic", voice: "trombone", class: "melodic-trombone" },
    { id: "violin", name: "弓清", type: "melodic", voice: "violin", class: "melodic-violin" },
    { id: "cello", name: "弓深", type: "melodic", voice: "cello", class: "melodic-cello" },
  ];

  const byId = Object.fromEntries(CATALOG.map((i) => [i.id, i]));

  const DEFAULT_LAYOUT = [
    { trackId: "kick", instrumentId: "kick" },
    { trackId: "snare", instrumentId: "snare" },
    { trackId: "hihat", instrumentId: "hihat" },
    { trackId: "openhat", instrumentId: "openhat" },
    { trackId: "bass", instrumentId: "bass" },
    { trackId: "chord", instrumentId: "chord" },
    { trackId: "lead", instrumentId: "lead" },
  ];

  function resolveId(id) {
    let cur = id;
    const seen = new Set();
    while (LEGACY_IDS[cur] && !seen.has(cur)) {
      seen.add(cur);
      cur = LEGACY_IDS[cur];
    }
    return cur;
  }

  function get(id) {
    const resolved = resolveId(id);
    return byId[resolved] || null;
  }

  function list(typeFilter) {
    const items = typeFilter ? CATALOG.filter((i) => i.type === typeFilter) : [...CATALOG];
    return items;
  }

  function defaultVolume(type) {
    return type === "drum" ? 0.85 : 0.75;
  }

  return {
    CATALOG,
    DEFAULT_LAYOUT,
    LEGACY_IDS,
    resolveId,
    get,
    list,
    defaultVolume,
  };
})();
