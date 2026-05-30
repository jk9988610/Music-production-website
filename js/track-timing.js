/**
 * 轨步进倍率 — 相对工程主 BPM 的触发密度（½× / 1× / 2× / 4×）
 */
const TrackTiming = (() => {
  const RATE_OPTIONS = [
    { value: 0.5, label: "½×" },
    { value: 1, label: "1×" },
    { value: 2, label: "2×" },
    { value: 4, label: "4×" },
  ];

  const ALLOWED = RATE_OPTIONS.map((o) => o.value);

  function normalizeRate(rate) {
    const n = Number(rate);
    if (!Number.isFinite(n)) return 1;
    let best = 1;
    let bestDiff = Infinity;
    ALLOWED.forEach((v) => {
      const d = Math.abs(v - n);
      if (d < bestDiff) {
        bestDiff = d;
        best = v;
      }
    });
    return best;
  }

  function rateLabel(rate) {
    const opt = RATE_OPTIONS.find((o) => o.value === rate);
    return opt ? opt.label : `${rate}×`;
  }

  /**
   * 在主时钟的某一「步」上，按轨倍率触发该格内容。
   * @param {number} rate - 0.5 | 1 | 2 | 4
   * @param {number} masterStep - 当前主步索引
   * @param {{ on: boolean, note?: number|null }} cell
   * @param {number} time - 音频时间
   * @param {number} stepDur - 主步长（秒）
   * @param {(t: number, note: number|null, dur: number) => void} playSound
   */
  function playStepCell(rate, masterStep, cell, time, stepDur, playSound) {
    if (!cell?.on) return;
    const r = normalizeRate(rate);

    if (r < 1) {
      const div = Math.round(1 / r);
      if (masterStep % div !== 0) return;
      playSound(time, cell.note ?? null, stepDur);
      return;
    }

    const n = Math.round(r);
    for (let i = 0; i < n; i++) {
      const subDur = stepDur / n;
      playSound(time + i * subDur, cell.note ?? null, subDur);
    }
  }

  return {
    RATE_OPTIONS,
    normalizeRate,
    rateLabel,
    playStepCell,
  };
})();
