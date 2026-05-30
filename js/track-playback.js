/**
 * 按轨步进倍率播放一格（供实时与离线导出共用）
 */
function playPatternCellForTrack(trackId, time, step, stepDur, cell) {
  const rate = Sequencer.getTrackRate(trackId);
  TrackTiming.playStepCell(rate, step, cell, time, stepDur, (t, note, dur) => {
    AudioEngine.playTrackSound(trackId, t, note, dur);
  });
}
