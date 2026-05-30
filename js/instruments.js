/**
 * 乐器目录 — 轨可切换的音色与分类（名称均为两字简称）
 */
const Instruments = (() => {
  const LEGACY_IDS = { ride: "cymbal" };

  const CATALOG = [
    { id: "kick", name: "底鼓", type: "drum", voice: "kick", class: "drum-kick" },
    { id: "snare", name: "军鼓", type: "drum", voice: "snare", class: "drum-snare" },
    { id: "hihat", name: "闭镲", type: "drum", voice: "hihat", class: "drum-hat" },
    { id: "openhat", name: "开镲", type: "drum", voice: "openhat", class: "drum-open" },
    { id: "tom", name: "通鼓", type: "drum", voice: "tom", class: "drum-tom" },
    { id: "clap", name: "拍手", type: "drum", voice: "clap", class: "drum-clap" },
    { id: "cymbal", name: "吊镲", type: "drum", voice: "cymbal", class: "drum-cymbal" },
    { id: "wood", name: "木鱼", type: "drum", voice: "wood", class: "drum-wood" },
    { id: "tri", name: "三角", type: "drum", voice: "tri", class: "drum-tri" },
    { id: "perc", name: "打击", type: "drum", voice: "perc", class: "drum-perc" },
    { id: "bass", name: "贝斯", type: "melodic", voice: "bass", class: "bass" },
    { id: "chord", name: "和弦", type: "melodic", voice: "chord", class: "chord" },
    { id: "lead", name: "领奏", type: "melodic", voice: "lead", class: "lead" },
    { id: "pluck", name: "拨弦", type: "melodic", voice: "pluck", class: "melodic-pluck" },
    { id: "pad", name: "垫音", type: "melodic", voice: "pad", class: "melodic-pad" },
    { id: "organ", name: "风琴", type: "melodic", voice: "organ", class: "melodic-organ" },
    { id: "bells", name: "钟琴", type: "melodic", voice: "bells", class: "melodic-bells" },
    { id: "flute", name: "笛子", type: "melodic", voice: "flute", class: "melodic-flute" },
    { id: "harp", name: "竖琴", type: "melodic", voice: "harp", class: "melodic-harp" },
    { id: "brass", name: "铜管", type: "melodic", voice: "brass", class: "melodic-brass" },
    { id: "strings", name: "弦乐", type: "melodic", voice: "strings", class: "melodic-strings" },
    { id: "synth", name: "合成", type: "melodic", voice: "synth", class: "melodic-synth" },
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
    return LEGACY_IDS[id] || id;
  }

  function get(id) {
    return byId[resolveId(id)] || null;
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
