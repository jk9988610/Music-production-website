/**
 * 乐器目录 — 常用鼓组（两字）+ 乐队配器（三字）
 * 旧工程 ID 仅做别名解析，音色各自独立合成
 */
const Instruments = (() => {
  /** 仅 ID 别名，不共用他人音色 */
  const LEGACY_IDS = {
    ride: "cymbal",
    splash: "cymbal",
  };

  const CATALOG = [
    { id: "kick", name: "底鼓", type: "drum", voice: "kick", class: "drum-kick" },
    { id: "snare", name: "军鼓", type: "drum", voice: "snare", class: "drum-snare" },
    { id: "hihat", name: "闭镲", type: "drum", voice: "hihat", class: "drum-hat" },
    { id: "openhat", name: "开镲", type: "drum", voice: "openhat", class: "drum-open" },
    { id: "tom", name: "通鼓", type: "drum", voice: "tom", class: "drum-tom" },
    { id: "cymbal", name: "吊镲", type: "drum", voice: "cymbal", class: "drum-cymbal" },
    { id: "clap", name: "拍手", type: "drum", voice: "clap", class: "drum-clap" },
    { id: "tri", name: "三角", type: "drum", voice: "tri", class: "drum-tri" },
    { id: "perc", name: "打击", type: "drum", voice: "perc", class: "drum-perc" },
    { id: "bass", name: "贝斯", type: "melodic", voice: "bass", class: "bass" },
    { id: "chord", name: "和弦", type: "melodic", voice: "chord", class: "chord" },
    { id: "lead", name: "领奏", type: "melodic", voice: "lead", class: "lead" },
    { id: "piano", name: "钢琴", type: "melodic", voice: "piano", class: "melodic-piano" },
    { id: "violin", name: "小提琴", type: "melodic", voice: "violin", class: "melodic-violin" },
    { id: "viola", name: "中提琴", type: "melodic", voice: "viola", class: "melodic-viola" },
    { id: "cello", name: "大提琴", type: "melodic", voice: "cello", class: "melodic-cello" },
    { id: "clarinet", name: "单簧管", type: "melodic", voice: "clarinet", class: "melodic-clarinet" },
    { id: "sax", name: "萨克斯", type: "melodic", voice: "sax", class: "melodic-sax" },
    { id: "oboe", name: "双簧管", type: "melodic", voice: "oboe", class: "melodic-oboe" },
    { id: "flute", name: "长笛", type: "melodic", voice: "flute", class: "melodic-flute" },
    { id: "eguitar", name: "电吉他", type: "melodic", voice: "eguitar", class: "melodic-eguitar" },
    { id: "organ", name: "风琴", type: "melodic", voice: "organ", class: "melodic-organ" },
    { id: "pipeorgan", name: "管风琴", type: "melodic", voice: "pipeorgan", class: "melodic-pipeorgan" },
    { id: "pluck", name: "拨弦", type: "melodic", voice: "pluck", class: "melodic-pluck" },
    { id: "pad", name: "垫音", type: "melodic", voice: "pad", class: "melodic-pad" },
    { id: "bells", name: "钟琴", type: "melodic", voice: "bells", class: "melodic-bells" },
    { id: "harp", name: "竖琴", type: "melodic", voice: "harp", class: "melodic-harp" },
    { id: "brass", name: "铜管", type: "melodic", voice: "brass", class: "melodic-brass" },
    { id: "strings", name: "弦乐", type: "melodic", voice: "strings", class: "melodic-strings" },
    { id: "synth", name: "合成器", type: "melodic", voice: "synth", class: "melodic-synth" },
    { id: "wood", name: "木鱼", type: "drum", voice: "wood", class: "drum-wood" },
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
    while (LEGACY_IDS[cur] && LEGACY_IDS[cur] !== cur && !seen.has(cur)) {
      seen.add(cur);
      cur = LEGACY_IDS[cur];
    }
    return cur;
  }

  function get(id) {
    return byId[resolveId(id)] || null;
  }

  function list(typeFilter) {
    if (!typeFilter) return [...CATALOG];
    return CATALOG.filter((i) => i.type === typeFilter);
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
