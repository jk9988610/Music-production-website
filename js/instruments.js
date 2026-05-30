/**
 * 乐器目录 — 乐队常用（宁缺毋滥），每件独立音色
 */
const Instruments = (() => {
  /** 旧工程 ID → 现乐器（仅解析轨名，音色以现 ID 为准） */
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
    { id: "kick", name: "底鼓", type: "drum", voice: "kick", class: "drum-kick" },
    { id: "snare", name: "军鼓", type: "drum", voice: "snare", class: "drum-snare" },
    { id: "hihat", name: "闭镲", type: "drum", voice: "hihat", class: "drum-hat" },
    { id: "openhat", name: "开镲", type: "drum", voice: "openhat", class: "drum-open" },
    { id: "tom", name: "通鼓", type: "drum", voice: "tom", class: "drum-tom" },
    { id: "cymbal", name: "吊镲", type: "drum", voice: "cymbal", class: "drum-cymbal" },
    {
      id: "bass",
      name: "贝斯",
      type: "melodic",
      voice: "bass",
      class: "bass",
      defaultTonality: { rootKey: 0, scaleName: "minor" },
    },
    {
      id: "piano",
      name: "钢琴",
      type: "melodic",
      voice: "piano",
      class: "melodic-piano",
      defaultTonality: { rootKey: 0, scaleName: "major" },
    },
    {
      id: "eguitar",
      name: "电吉他",
      type: "melodic",
      voice: "eguitar",
      class: "melodic-eguitar",
      defaultTonality: { rootKey: 4, scaleName: "minor" },
    },
    {
      id: "chord",
      name: "和弦",
      type: "melodic",
      voice: "chord",
      class: "chord",
      defaultTonality: { rootKey: 0, scaleName: "major" },
    },
    {
      id: "lead",
      name: "领奏",
      type: "melodic",
      voice: "lead",
      class: "lead",
      defaultTonality: { rootKey: 0, scaleName: "major" },
    },
    {
      id: "sax",
      name: "萨克斯",
      type: "melodic",
      voice: "sax",
      class: "melodic-sax",
      defaultTonality: { rootKey: 10, scaleName: "blues" },
    },
    {
      id: "trumpet",
      name: "小号",
      type: "melodic",
      voice: "trumpet",
      class: "melodic-trumpet",
      defaultTonality: { rootKey: 10, scaleName: "major" },
    },
    {
      id: "trombone",
      name: "长号",
      type: "melodic",
      voice: "trombone",
      class: "melodic-trombone",
      defaultTonality: { rootKey: 10, scaleName: "major" },
    },
    {
      id: "violin",
      name: "小提琴",
      type: "melodic",
      voice: "violin",
      class: "melodic-violin",
      defaultTonality: { rootKey: 7, scaleName: "major" },
    },
    {
      id: "cello",
      name: "大提琴",
      type: "melodic",
      voice: "cello",
      class: "melodic-cello",
      defaultTonality: { rootKey: 0, scaleName: "minor" },
    },
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

  const FALLBACK_TONALITY = { rootKey: 0, scaleName: "major" };

  function getDefaultTonality(instrumentId) {
    const inst = get(instrumentId);
    if (!inst?.defaultTonality) return { ...FALLBACK_TONALITY };
    return {
      rootKey: inst.defaultTonality.rootKey ?? 0,
      scaleName: inst.defaultTonality.scaleName || "major",
    };
  }

  return {
    CATALOG,
    DEFAULT_LAYOUT,
    LEGACY_IDS,
    resolveId,
    get,
    list,
    defaultVolume,
    getDefaultTonality,
    FALLBACK_TONALITY,
  };
})();
