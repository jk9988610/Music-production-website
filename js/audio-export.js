/**
 * 编曲离线渲染 — Tone.Offline + WAV / MP3
 */
const AudioExport = (() => {
  function getTrackIds(project) {
    const layout = project?.sequencer?.trackLayout;
    if (layout?.length) return layout.map((t) => t.trackId);
    if (typeof Sequencer !== "undefined" && Sequencer.getTracks) {
      return Sequencer.getTracks().map((t) => t.id);
    }
    return ["kick", "snare", "hihat", "openhat", "bass", "chord", "lead"];
  }

  function buildTrackVoiceMap(project) {
    const map = {};
    const layout = project?.sequencer?.trackLayout;
    if (layout?.length && typeof Instruments !== "undefined") {
      layout.forEach((t) => {
        const inst = Instruments.get(t.instrumentId);
        map[t.trackId] = inst?.voice || t.trackId;
      });
    }
    return map;
  }

  function computeArrangementDuration(project) {
    const seq = project.sequencer;
    const sections = project.arranger?.sections || [];
    const steps = seq.steps || 16;
    const bpm = project.bpm || 120;
    const base = 60 / bpm / 4;
    const totalSteps = sections.length * steps;
    const total = totalSteps * base;
    return {
      total,
      sections,
      steps,
      bpm,
      base,
      patterns: seq.patterns,
      volumes: seq.volumes,
      trackRates: seq.trackRates || {},
    };
  }

  async function renderArrangementBuffer(project) {
    const info = computeArrangementDuration(project);
    if (!info.sections.length) throw new Error("没有编曲段落可导出");

    if (typeof Tone === "undefined") {
      throw new Error("Tone.js 未加载");
    }
    await AudioEngine.unlockAudio();

    const duration = info.total + 0.15;
    const trackVoiceMap = buildTrackVoiceMap(project);
    const scheduler = AudioEngine.createOfflineScheduler(
      info.volumes || {},
      trackVoiceMap
    );

    const buffer = await Tone.Offline(() => {
      let time = 0;
      const totalSteps = info.sections.length * info.steps;
      for (let g = 0; g < totalSteps; g++) {
        const sectionIdx = Math.floor(g / info.steps);
        const step = g % info.steps;
        const patternIndex = info.sections[sectionIdx]?.patternIndex ?? 0;
        const pattern = info.patterns[patternIndex];
        if (pattern) {
          getTrackIds(project).forEach((trackId) => {
            const cell = pattern[trackId]?.[step];
            const rate = TrackTiming.normalizeRate(info.trackRates[trackId] ?? 1);
            TrackTiming.playStepCell(rate, step, cell, time, info.base, (t, note, dur) => {
              scheduler.schedule(null, null, trackId, t, note, dur);
            });
          });
        }
        time += info.base;
      }
    }, duration);

    return buffer;
  }

  function encodeWav(audioBuffer) {
    const numCh = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const samples = audioBuffer.length;
    const bits = 16;
    const blockAlign = (numCh * bits) / 8;
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples * blockAlign;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    function writeStr(offset, str) {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    }

    writeStr(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numCh, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bits, true);
    writeStr(36, "data");
    view.setUint32(40, dataSize, true);

    let offset = 44;
    const chData = [];
    for (let ch = 0; ch < numCh; ch++) chData.push(audioBuffer.getChannelData(ch));

    for (let i = 0; i < samples; i++) {
      for (let ch = 0; ch < numCh; ch++) {
        const s = Math.max(-1, Math.min(1, chData[ch][i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
      }
    }

    return new Blob([buffer], { type: "audio/wav" });
  }

  function loadLamejs() {
    return new Promise((resolve, reject) => {
      if (window.lamejs && window.lamejs.Mp3Encoder) {
        resolve(window.lamejs);
        return;
      }
      const existing = document.querySelector('script[data-hf-lame="1"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(window.lamejs));
        existing.addEventListener("error", () => reject(new Error("MP3 编码库加载失败")));
        return;
      }
      const s = document.createElement("script");
      const build =
        typeof AppVersion !== "undefined" && AppVersion.BUILD && AppVersion.BUILD !== "dev"
          ? `?v=${encodeURIComponent(AppVersion.BUILD)}`
          : "";
      s.src = `js/lame.min.js${build}`;
      s.dataset.hfLame = "1";
      s.onload = () => resolve(window.lamejs);
      s.onerror = () => reject(new Error("MP3 编码库加载失败"));
      document.head.appendChild(s);
    });
  }

  async function encodeMp3(audioBuffer) {
    const lamejs = await loadLamejs();
    if (!lamejs?.Mp3Encoder) {
      throw new Error("MP3 编码库未正确加载，请刷新页面后重试");
    }
    const ch0 = audioBuffer.getChannelData(0);
    const ch1 =
      audioBuffer.numberOfChannels > 1
        ? audioBuffer.getChannelData(1)
        : audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const encoder = new lamejs.Mp3Encoder(2, sampleRate, 128);
    const block = 1152;
    const mp3Data = [];

    for (let i = 0; i < ch0.length; i += block) {
      const left = floatTo16(ch0.subarray(i, i + block));
      const right = floatTo16(ch1.subarray(i, i + block));
      const buf = encoder.encodeBuffer(left, right);
      if (buf.length) mp3Data.push(buf);
    }
    const end = encoder.flush();
    if (end.length) mp3Data.push(end);

    return new Blob(mp3Data, { type: "audio/mpeg" });
  }

  function floatTo16(samples) {
    const out = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }

  async function renderExportBlob(project, format = "mp3") {
    const buffer = await renderArrangementBuffer(project);
    if (format === "mp3") return encodeMp3(buffer);
    return encodeWav(buffer);
  }

  async function exportAudio(project, format, filenameBase) {
    const ext = format === "mp3" ? ".mp3" : ".wav";
    const mime = format === "mp3" ? "audio/mpeg" : "audio/wav";
    const name = filenameBase.endsWith(ext) ? filenameBase : `${filenameBase}${ext}`;
    if (typeof FileSave === "undefined") {
      throw new Error("文件保存模块未加载");
    }
    const target = await FileSave.prepareTarget(name, mime);
    const blob = await renderExportBlob(project, format);
    const written = await FileSave.writeTarget(target, blob);
    return { filename: name, bytes: blob.size, manualLink: written.manualLink };
  }

  return {
    renderArrangementBuffer,
    renderExportBlob,
    encodeWav,
    encodeMp3,
    exportAudio,
  };
})();
