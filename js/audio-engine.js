/**
 * Web Audio 合成 — 乐队常用乐器（鼓组 / 电声 / 管乐 / 弓弦谐波模型，见各 play* 注释）
 */
const AudioEngine = (() => {
  let ctx = null;
  let masterGain = null;
  const trackGains = {};

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function playKickOn(c, out, time, gain = 0.9) {
    const clickLen = Math.max(4, Math.floor(c.sampleRate * 0.004));
    const click = c.createBuffer(1, clickLen, c.sampleRate);
    const cd = click.getChannelData(0);
    for (let i = 0; i < clickLen; i++) cd[i] = (Math.random() * 2 - 1) * (1 - i / clickLen);
    const clickSrc = c.createBufferSource();
    clickSrc.buffer = click;
    const clickE = c.createGain();
    clickE.gain.setValueAtTime(gain * 0.35, time);
    clickE.gain.exponentialRampToValueAtTime(0.001, time + 0.008);
    clickSrc.connect(clickE);
    clickE.connect(out);
    clickSrc.start(time);
    clickSrc.stop(time + 0.01);

    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(165, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.1);
    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.38);
    osc.connect(env);
    env.connect(out);
    osc.start(time);
    osc.stop(time + 0.42);
  }

  function playSnareOn(c, out, time, gain = 0.75) {
    const bufferSize = c.sampleRate * 0.2;
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    const noise = c.createBufferSource();
    noise.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 800;
    const env = c.createGain();
    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    noise.connect(filter);
    filter.connect(env);
    env.connect(out);
    noise.start(time);
    noise.stop(time + 0.2);
    const tone = c.createOscillator();
    const toneEnv = c.createGain();
    tone.type = "triangle";
    tone.frequency.value = 180;
    toneEnv.gain.setValueAtTime(gain * 0.4, time);
    toneEnv.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    tone.connect(toneEnv);
    toneEnv.connect(out);
    tone.start(time);
    tone.stop(time + 0.1);
  }

  function playHatOn(c, out, time, open = false, gain = 0.5, filterHz = 7000) {
    const dur = open ? 0.25 : 0.05;
    const bufferSize = Math.floor(c.sampleRate * dur);
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (open ? 1 - i / bufferSize : 1);
    }
    const noise = c.createBufferSource();
    noise.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = filterHz;
    const env = c.createGain();
    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + dur);
    noise.connect(filter);
    filter.connect(env);
    env.connect(out);
    noise.start(time);
    noise.stop(time + dur + 0.02);
  }

  function playTomOn(c, out, time, gain = 0.8) {
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, time);
    osc.frequency.exponentialRampToValueAtTime(70, time + 0.14);
    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.32);
    osc.connect(env);
    env.connect(out);
    osc.start(time);
    osc.stop(time + 0.34);
  }

  /** 吊镲 — 比开镲更亮、更长的高频金属感 */
  function playCymbalOn(c, out, time, gain = 0.42) {
    const dur = 0.55;
    const bufferSize = Math.floor(c.sampleRate * dur);
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) ** 0.7;
    }
    const noise = c.createBufferSource();
    noise.buffer = buffer;
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 5200;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 9200;
    bp.Q.value = 0.6;
    const env = c.createGain();
    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + dur);
    noise.connect(hp);
    hp.connect(bp);
    bp.connect(env);
    env.connect(out);
    noise.start(time);
    noise.stop(time + dur + 0.02);
  }

  /**
   * 弓弦 — 纯谐波加法（无噪声）：正弦分音 + 轻微失谐 + 固定明亮低通。
   * 仅幅度起弓，不做管乐式低通扫频；高音分音较快起音以增强穿透。
   */
  function playBowedString(c, out, time, midi, duration, gain, preset) {
    const freq = midiToFreq(midi);
    const inharmonicB = preset.inharmonicB ?? 0.00028;
    const noteLen = Math.max(duration, preset.minNoteLen ?? 0.65);
    const stopAt = time + noteLen + 0.35;
    const baseAtk = preset.attack ?? 0.1;
    const rel = noteLen * (preset.releaseMul ?? 0.98);
    const harmWaveFrom = preset.harmonicWaveFromN ?? 99;
    const harmWave = preset.harmonicWave ?? "triangle";

    const master = c.createGain();
    master.gain.setValueAtTime(0, time);
    master.gain.linearRampToValueAtTime(gain, time + baseAtk);
    master.gain.setValueAtTime(gain * (preset.sustain ?? 0.92), time + baseAtk + 0.08);
    master.gain.exponentialRampToValueAtTime(0.001, time + rel);

    const bus = c.createGain();
    let chain = bus;
    if (preset.highpassHz) {
      const hp = c.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = preset.highpassHz;
      hp.Q.value = preset.highpassQ ?? 0.65;
      chain.connect(hp);
      chain = hp;
    }
    (preset.bodyPeaks ?? []).forEach((body) => {
      const pk = c.createBiquadFilter();
      pk.type = "peaking";
      pk.frequency.value = body.hz;
      pk.Q.value = body.q ?? 4;
      pk.gain.value = body.gain ?? 3;
      chain.connect(pk);
      chain = pk;
    });

    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = Math.min(
      preset.lpCap ?? 9000,
      freq * (preset.lpMul ?? 11) + (preset.lpAdd ?? 650)
    );
    lp.Q.value = preset.lpQ ?? 0.6;
    chain.connect(lp);
    lp.connect(master);
    master.connect(out);

    const vib = c.createOscillator();
    vib.type = "sine";
    vib.frequency.value = preset.vibratoHz ?? 5.2;
    const vibDepth = c.createGain();
    vibDepth.gain.value = preset.vibratoCents ?? 11;
    vib.connect(vibDepth);
    const vibStart = time + (preset.vibratoDelay ?? 0.24);
    vib.start(vibStart);
    vib.stop(stopAt);

    (preset.partials ?? []).forEach((p) => {
      const n = p.n ?? 1;
      const f = freq * n * Math.sqrt(1 + inharmonicB * n * n);
      if (f > (preset.maxHz ?? 11000)) return;

      const osc = c.createOscillator();
      osc.type = p.wave ?? (n >= harmWaveFrom ? harmWave : "sine");
      osc.frequency.setValueAtTime(f, time);
      if (n === 1 || preset.vibratoOnFundamental !== false) {
        vibDepth.connect(osc.detune);
      }
      if (p.detuneCents != null) {
        osc.detune.setValueAtTime(p.detuneCents, time);
      }

      const amp = c.createGain();
      const peak = gain * (p.amp ?? 0.25);
      const atk = p.atk ?? Math.max(0.004, baseAtk - n * 0.008);
      const pRel = Math.max(0.2, noteLen * (p.decayMul ?? 0.96));
      amp.gain.setValueAtTime(0, time);
      amp.gain.linearRampToValueAtTime(peak, time + atk);
      amp.gain.setValueAtTime(peak * (p.sustain ?? 0.9), time + atk + 0.04);
      amp.gain.exponentialRampToValueAtTime(0.001, time + pRel);

      osc.connect(amp);
      amp.connect(bus);
      osc.start(time);
      osc.stop(stopAt);
    });
  }

  const BOW_VIOLIN = {
    minNoteLen: 0.68,
    attack: 0.042,
    sustain: 0.9,
    releaseMul: 0.99,
    vibratoHz: 5.6,
    vibratoCents: 7,
    vibratoDelay: 0.38,
    vibratoOnFundamental: false,
    inharmonicB: 0.00035,
    harmonicWaveFromN: 3,
    harmonicWave: "triangle",
    highpassHz: 210,
    highpassQ: 0.55,
    lpCap: 15000,
    lpMul: 17,
    lpAdd: 1600,
    lpQ: 0.32,
    maxHz: 14000,
    partials: [
      { n: 1, amp: 0.28, atk: 0.05, decayMul: 1, detuneCents: -4 },
      { n: 1, amp: 0.28, atk: 0.05, decayMul: 1, detuneCents: 4 },
      { n: 2, amp: 0.34, atk: 0.028, decayMul: 0.99 },
      { n: 3, amp: 0.36, atk: 0.018, decayMul: 0.98 },
      { n: 4, amp: 0.32, atk: 0.012, decayMul: 0.97 },
      { n: 5, amp: 0.28, atk: 0.009, decayMul: 0.96 },
      { n: 6, amp: 0.24, atk: 0.007, decayMul: 0.94 },
      { n: 7, amp: 0.2, atk: 0.006, decayMul: 0.92 },
      { n: 8, amp: 0.16, atk: 0.005, decayMul: 0.9 },
      { n: 9, amp: 0.12, atk: 0.004, decayMul: 0.88 },
      { n: 10, amp: 0.08, atk: 0.003, decayMul: 0.86 },
    ],
    bodyPeaks: [
      { hz: 1800, q: 2.2, gain: 3 },
      { hz: 3400, q: 2.8, gain: 5.5 },
      { hz: 5600, q: 3.2, gain: 4.5 },
    ],
  };

  const BOW_CELLO = {
    minNoteLen: 0.72,
    attack: 0.052,
    sustain: 0.91,
    releaseMul: 0.99,
    vibratoHz: 4.6,
    vibratoCents: 6,
    vibratoDelay: 0.42,
    vibratoOnFundamental: false,
    inharmonicB: 0.00028,
    harmonicWaveFromN: 2,
    harmonicWave: "triangle",
    highpassHz: 155,
    highpassQ: 0.5,
    lpCap: 9200,
    lpMul: 12,
    lpAdd: 1100,
    lpQ: 0.34,
    maxHz: 10000,
    partials: [
      { n: 1, amp: 0.34, atk: 0.06, decayMul: 1, detuneCents: -3 },
      { n: 1, amp: 0.34, atk: 0.06, decayMul: 1, detuneCents: 3 },
      { n: 2, amp: 0.38, atk: 0.032, decayMul: 0.99 },
      { n: 3, amp: 0.36, atk: 0.022, decayMul: 0.98 },
      { n: 4, amp: 0.32, atk: 0.016, decayMul: 0.97 },
      { n: 5, amp: 0.28, atk: 0.012, decayMul: 0.96 },
      { n: 6, amp: 0.22, atk: 0.009, decayMul: 0.94 },
      { n: 7, amp: 0.17, atk: 0.007, decayMul: 0.92 },
      { n: 8, amp: 0.12, atk: 0.005, decayMul: 0.9 },
    ],
    bodyPeaks: [
      { hz: 1200, q: 2, gain: 2.5 },
      { hz: 2600, q: 2.6, gain: 4.5 },
      { hz: 4200, q: 3, gain: 3.5 },
    ],
  };

  function playViolinOn(c, out, time, midi, duration, gain = 0.46) {
    playBowedString(c, out, time, midi, duration, gain, BOW_VIOLIN);
  }

  function playCelloOn(c, out, time, midi, duration, gain = 0.48) {
    playBowedString(c, out, time, midi, duration, gain, BOW_CELLO);
  }

  /**
   * 钢琴 — 电钢琴取向（Rhodes 式 FM 击齿 + 锯波体，对照常见电子琴）：
   * 调/阶不参与发声，只影响选音列表；音长取 max(步长, 0.45s) 避免高密度轨听成拨弦。
   */
  function playPianoOn(c, out, time, midi, duration, gain = 0.5) {
    const freq = midiToFreq(midi);
    const noteLen = Math.max(duration, 0.45);
    const stopAt = time + noteLen + 0.2;

    const env = c.createGain();
    const peak = gain * 0.9;
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(peak, time + 0.01);
    env.gain.exponentialRampToValueAtTime(peak * 0.68, time + 0.14);
    env.gain.setValueAtTime(peak * 0.6, time + noteLen * 0.5);
    env.gain.exponentialRampToValueAtTime(0.001, time + noteLen * 0.98);

    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(Math.min(5800, 700 + freq * 7.5), time);
    lp.Q.value = 0.85;

    const mix = c.createGain();
    mix.connect(lp);
    lp.connect(env);
    env.connect(out);

    const carrier = c.createOscillator();
    carrier.type = "sine";
    carrier.frequency.setValueAtTime(freq, time);
    const mod = c.createOscillator();
    mod.type = "sine";
    mod.frequency.setValueAtTime(freq * 4, time);
    const modDepth = c.createGain();
    modDepth.gain.setValueAtTime(freq * 0.16, time);
    modDepth.gain.exponentialRampToValueAtTime(freq * 0.008, time + 0.11);
    mod.connect(modDepth);
    modDepth.connect(carrier.frequency);
    const tineG = c.createGain();
    tineG.gain.value = 0.52;
    carrier.connect(tineG);
    tineG.connect(mix);
    carrier.start(time);
    carrier.stop(stopAt);
    mod.start(time);
    mod.stop(stopAt);

    [-4, 4].forEach((cents) => {
      const saw = c.createOscillator();
      saw.type = "sawtooth";
      saw.frequency.setValueAtTime(freq, time);
      saw.detune.setValueAtTime(cents, time);
      const g = c.createGain();
      g.gain.value = 0.16;
      saw.connect(g);
      g.connect(mix);
      saw.start(time);
      saw.stop(stopAt);
    });

    const body = c.createOscillator();
    body.type = "triangle";
    body.frequency.setValueAtTime(freq, time);
    const bodyG = c.createGain();
    bodyG.gain.value = 0.22;
    body.connect(bodyG);
    bodyG.connect(mix);
    body.start(time);
    body.stop(stopAt);
  }

  function pianoNoteDuration(stepDuration) {
    return Math.max(stepDuration, 0.45);
  }

  function leadNoteDuration(stepDuration) {
    return Math.max(stepDuration, 0.58);
  }

  function melodicNoteDuration(voice, stepDuration) {
    if (voice === "piano") return pianoNoteDuration(stepDuration);
    if (voice === "violin") return Math.max(stepDuration, 0.68);
    if (voice === "cello") return Math.max(stepDuration, 0.72);
    if (voice === "lead") return leadNoteDuration(stepDuration);
    if (voice === "bass" || voice === "trombone") {
      return Math.max(stepDuration, 0.32);
    }
    if (voice === "sax" || voice === "trumpet") {
      return Math.max(stepDuration, 0.36);
    }
    return stepDuration;
  }

  function previewDurationForVoice(voice) {
    const map = {
      piano: 0.62,
      bass: 0.42,
      cello: 0.78,
      violin: 0.74,
      lead: 0.62,
      sax: 0.46,
      trumpet: 0.44,
      trombone: 0.48,
      eguitar: 0.34,
    };
    return map[voice] ?? 0.28;
  }

  /** 电贝斯 — 正弦低音 + 锯齿谐波，偏 Funk/R&B 电贝斯 */
  function playBassOn(c, out, time, midi, duration, gain = 0.5) {
    const freq = midiToFreq(midi);
    const noteLen = Math.max(duration, 0.32);
    const stopAt = time + noteLen + 0.1;

    const env = c.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(gain * 0.88, time + 0.008);
    env.gain.exponentialRampToValueAtTime(gain * 0.55, time + noteLen * 0.92);

    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(Math.min(1200, 180 + freq * 1.2), time);
    lp.Q.value = 1.1;

    const mix = c.createGain();
    mix.connect(lp);
    lp.connect(env);
    env.connect(out);

    const sub = c.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(freq, time);
    const subG = c.createGain();
    subG.gain.value = 0.55;
    sub.connect(subG);
    subG.connect(mix);
    sub.start(time);
    sub.stop(stopAt);

    const saw = c.createOscillator();
    saw.type = "sawtooth";
    saw.frequency.setValueAtTime(freq, time);
    const sawG = c.createGain();
    sawG.gain.value = 0.28;
    saw.connect(sawG);
    sawG.connect(mix);
    saw.start(time);
    saw.stop(stopAt);
  }

  /** 领奏 — 主旋律：明亮、延音足，适合唱句（非短促特效音） */
  function playLeadOn(c, out, time, midi, duration, gain = 0.52) {
    const freq = midiToFreq(midi);
    const noteLen = leadNoteDuration(duration);
    const stopAt = time + noteLen + 0.12;

    const env = c.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(gain * 0.88, time + 0.03);
    env.gain.setValueAtTime(gain * 0.84, time + noteLen * 0.45);
    env.gain.setValueAtTime(gain * 0.8, time + noteLen * 0.72);
    env.gain.exponentialRampToValueAtTime(0.001, time + noteLen * 0.98);

    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    const lpHz = Math.min(7200, 1600 + freq * 10);
    lp.frequency.setValueAtTime(lpHz, time);
    lp.Q.value = 0.85;

    const presence = c.createBiquadFilter();
    presence.type = "peaking";
    presence.frequency.value = Math.min(3800, freq * 3.2 + 1200);
    presence.Q.value = 0.9;
    presence.gain.value = 4.5;

    const mix = c.createGain();
    mix.connect(presence);
    presence.connect(lp);
    lp.connect(env);
    env.connect(out);

    const vib = c.createOscillator();
    vib.type = "sine";
    vib.frequency.value = 5.6;
    const vibG = c.createGain();
    vibG.gain.value = 14;
    vib.connect(vibG);
    const vibStart = time + 0.18;
    vib.start(vibStart);
    vib.stop(stopAt);

    [-8, 0, 8].forEach((cents, i) => {
      const osc = c.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, time);
      osc.detune.setValueAtTime(cents, time);
      if (i === 1) vibG.connect(osc.detune);
      const g = c.createGain();
      g.gain.value = i === 1 ? 0.42 : 0.22;
      osc.connect(g);
      g.connect(mix);
      osc.start(time);
      osc.stop(stopAt);
    });

    const shine = c.createOscillator();
    shine.type = "sine";
    shine.frequency.setValueAtTime(freq * 2, time);
    const shineG = c.createGain();
    shineG.gain.value = 0.12;
    shine.connect(shineG);
    shineG.connect(mix);
    shine.start(time);
    shine.stop(stopAt);
  }

  /** 电吉他 — 清音拨弦（起拨噪声 + 锯齿体、较快衰减） */
  function playEguitarOn(c, out, time, midi, duration, gain = 0.48) {
    const freq = midiToFreq(midi);
    const noteLen = Math.max(duration, 0.22);
    const stopAt = time + noteLen + 0.06;

    const pickLen = Math.floor(c.sampleRate * 0.006);
    const pick = c.createBuffer(1, pickLen, c.sampleRate);
    const pd = pick.getChannelData(0);
    for (let i = 0; i < pickLen; i++) pd[i] = (Math.random() * 2 - 1) * (1 - i / pickLen);
    const pickSrc = c.createBufferSource();
    pickSrc.buffer = pick;
    const pickF = c.createBiquadFilter();
    pickF.type = "highpass";
    pickF.frequency.value = 1200;
    const pickE = c.createGain();
    pickE.gain.setValueAtTime(gain * 0.2, time);
    pickE.gain.exponentialRampToValueAtTime(0.001, time + 0.012);
    pickSrc.connect(pickF);
    pickF.connect(pickE);
    pickE.connect(out);
    pickSrc.start(time);
    pickSrc.stop(time + 0.02);

    const env = c.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(gain * 0.75, time + 0.004);
    env.gain.exponentialRampToValueAtTime(0.001, time + noteLen * 0.85);

    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(Math.min(3800, 800 + freq * 5), time);
    lp.Q.value = 1.4;

    const osc = c.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, time);
    osc.connect(lp);
    lp.connect(env);
    env.connect(out);
    osc.start(time);
    osc.stop(stopAt);
  }

  /** 簧片管（萨克斯）— 锯齿激励 + 共振峰 */
  function playReedOn(c, out, time, midi, duration, gain, formantHz) {
    const freq = midiToFreq(midi);
    const stopAt = time + duration + 0.12;

    const exc = c.createOscillator();
    exc.type = "sawtooth";
    exc.frequency.setValueAtTime(freq, time);
    const excG = c.createGain();
    excG.gain.value = 0.35;

    const env = c.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(gain, time + 0.05);
    env.gain.setValueAtTime(gain * 0.78, time + duration * 0.4);
    env.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.85);

    const bus = c.createGain();
    bus.gain.value = 1;
    exc.connect(excG);
    excG.connect(bus);

    formantHz.forEach((hz, i) => {
      const f = c.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = hz;
      f.Q.value = i === 1 ? 9 : 6;
      const g = c.createGain();
      g.gain.value = i === 1 ? 0.55 : 0.38;
      bus.connect(f);
      f.connect(g);
      g.connect(env);
    });

    env.connect(out);
    exc.start(time);
    exc.stop(stopAt);
  }

  function playSaxOn(c, out, time, midi, duration, gain = 0.45) {
    const f = midiToFreq(midi);
    playReedOn(c, out, time, midi, duration, gain, [
      Math.min(700, f * 0.75),
      Math.min(1500, f * 1.1),
      Math.min(3200, f * 2.5),
    ]);
  }

  /** 铜管 — 小号 / 长号共用模型，参数区分 */
  function playBrassOn(c, out, time, midi, duration, gain, preset) {
    const freq = midiToFreq(midi);
    const stopAt = time + duration + 0.15;

    const env = c.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(gain, time + preset.attack);
    env.gain.setValueAtTime(gain * preset.sustain, time + duration * 0.42);
    env.gain.exponentialRampToValueAtTime(0.001, time + duration * preset.releaseMul);

    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(preset.lpStart, time);
    lp.frequency.exponentialRampToValueAtTime(preset.lpPeak, time + 0.045);
    lp.Q.value = preset.q ?? 2.4;

    const mix = c.createGain();
    mix.connect(lp);
    lp.connect(env);
    env.connect(out);

    const saw = c.createOscillator();
    saw.type = "sawtooth";
    saw.frequency.setValueAtTime(freq, time);
    const sawG = c.createGain();
    sawG.gain.value = 0.5;
    saw.connect(sawG);
    sawG.connect(mix);
    saw.start(time);
    saw.stop(stopAt);

    if (preset.squareMix > 0) {
      const sq = c.createOscillator();
      sq.type = "square";
      sq.frequency.setValueAtTime(freq, time);
      const sqG = c.createGain();
      sqG.gain.value = preset.squareMix;
      sq.connect(sqG);
      sqG.connect(mix);
      sq.start(time);
      sq.stop(stopAt);
    }

    if (preset.vibratoHz) {
      const vib = c.createOscillator();
      vib.type = "sine";
      vib.frequency.value = preset.vibratoHz;
      const depth = c.createGain();
      depth.gain.value = preset.vibratoCents ?? 10;
      vib.connect(depth);
      depth.connect(saw.detune);
      const t0 = time + (preset.vibratoDelay ?? 0.1);
      vib.start(t0);
      vib.stop(stopAt);
    }
  }

  const BRASS_TRUMPET = {
    attack: 0.032,
    sustain: 0.8,
    releaseMul: 0.82,
    lpStart: 480,
    lpPeak: 4600,
    squareMix: 0.18,
    vibratoHz: 5.2,
    vibratoCents: 11,
    vibratoDelay: 0.1,
  };

  const BRASS_TROMBONE = {
    attack: 0.055,
    sustain: 0.86,
    releaseMul: 0.9,
    lpStart: 260,
    lpPeak: 2600,
    q: 2,
    squareMix: 0.12,
    vibratoHz: 4.3,
    vibratoCents: 9,
    vibratoDelay: 0.16,
  };

  function playTrumpetOn(c, out, time, midi, duration, gain = 0.48) {
    playBrassOn(c, out, time, midi, duration, gain, BRASS_TRUMPET);
  }

  function playTromboneOn(c, out, time, midi, duration, gain = 0.46) {
    playBrassOn(c, out, time, midi, duration, gain, BRASS_TROMBONE);
  }

  /** 和弦轨：管风琴式垫音（慢起音、偏暗），与钢琴击弦模型区分 */
  function playChordPadTone(c, out, time, midi, duration, noteGain, detuneCents) {
    const freq = midiToFreq(midi);
    const bus = c.createGain();
    bus.gain.value = 1;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(720, time);
    lp.frequency.exponentialRampToValueAtTime(1100, time + 0.12);
    lp.frequency.exponentialRampToValueAtTime(850, time + duration * 0.7);
    lp.Q.value = 1.2;

    const drawbars = [
      { mult: 1, wave: "sawtooth", amp: 0.55 },
      { mult: 2, wave: "square", amp: 0.22 },
      { mult: 3, wave: "sine", amp: 0.12 },
    ];

    drawbars.forEach(({ mult, wave, amp }) => {
      const osc = c.createOscillator();
      const env = c.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq * mult, time);
      osc.detune.setValueAtTime(detuneCents, time);
      const rel = duration * 0.92;
      env.gain.setValueAtTime(0, time);
      env.gain.linearRampToValueAtTime(noteGain * amp, time + 0.07);
      env.gain.setValueAtTime(noteGain * amp * 0.82, time + duration * 0.35);
      env.gain.exponentialRampToValueAtTime(0.001, time + rel);
      osc.connect(env);
      env.connect(bus);
      osc.start(time);
      osc.stop(time + rel + 0.08);
    });

    bus.connect(lp);
    lp.connect(out);
  }

  function playChordOn(c, out, time, rootMidi, duration, gain) {
    const detunes = [-9, 0, 7];
    [0, 4, 7].forEach((semi, i) => {
      playChordPadTone(
        c,
        out,
        time,
        rootMidi + semi,
        duration,
        gain * (i === 0 ? 0.38 : 0.3),
        detunes[i]
      );
    });
  }

  function playMono(c, out, time, midi, duration, gain, cfg) {
    const freq = midiToFreq(midi);
    const osc = c.createOscillator();
    const env = c.createGain();
    const f = c.createBiquadFilter();
    osc.type = cfg.wave || "sawtooth";
    osc.frequency.value = freq;
    f.type = "lowpass";
    f.frequency.value = cfg.lp ?? 2500;
    f.Q.value = cfg.q ?? 2;
    const atk = cfg.attack ?? 0.02;
    const rel = duration * (cfg.releaseMul ?? 0.85);
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(gain, time + atk);
    env.gain.exponentialRampToValueAtTime(0.001, time + rel);
    osc.connect(f);
    f.connect(env);
    env.connect(out);
    osc.start(time);
    osc.stop(time + rel + 0.05);
  }

  function resolveVoice(trackId) {
    if (typeof Sequencer !== "undefined" && Sequencer.getTrack) {
      const t = Sequencer.getTrack(trackId);
      if (t?.voice) return t.voice;
    }
    return trackId;
  }

  function playMelodic(c, out, voice, time, noteMidi, stepDuration, gain) {
    if (noteMidi == null) return;
    const d = melodicNoteDuration(voice, stepDuration);
    switch (voice) {
      case "bass":
        playBassOn(c, out, time, noteMidi, d, gain);
        break;
      case "lead":
        playLeadOn(c, out, time, noteMidi, d, gain * 1.05);
        break;
      case "piano":
        playPianoOn(c, out, time, noteMidi, d, gain);
        break;
      case "eguitar":
        playEguitarOn(c, out, time, noteMidi, d, gain);
        break;
      case "sax":
        playSaxOn(c, out, time, noteMidi, d, gain);
        break;
      case "trumpet":
        playTrumpetOn(c, out, time, noteMidi, d, gain);
        break;
      case "trombone":
        playTromboneOn(c, out, time, noteMidi, d, gain);
        break;
      case "violin":
        playViolinOn(c, out, time, noteMidi, d, gain);
        break;
      case "cello":
        playCelloOn(c, out, time, noteMidi, d, gain);
        break;
      default:
        playMono(c, out, time, noteMidi, d, gain, { lp: 2600, attack: 0.02 });
        break;
    }
  }

  function playVoiceOn(c, out, voice, time, noteMidi, stepDuration) {
    switch (voice) {
      case "kick":
        playKickOn(c, out, time);
        break;
      case "snare":
      case "clap":
        playSnareOn(c, out, time);
        break;
      case "hihat":
        playHatOn(c, out, time, false);
        break;
      case "openhat":
        playHatOn(c, out, time, true, 0.55);
        break;
      case "cymbal":
      case "ride":
      case "splash":
        playCymbalOn(c, out, time, 0.42);
        break;
      case "tom":
      case "wood":
      case "tri":
      case "perc":
        playTomOn(c, out, time);
        break;
      case "chord":
        if (noteMidi != null) playChordOn(c, out, time, noteMidi, stepDuration * 0.9, 0.42);
        break;
      default:
        playMelodic(c, out, voice, time, noteMidi, stepDuration, 0.42);
        break;
    }
  }

  function playTrackSoundOn(c, outGetter, trackId, time, noteMidi, stepDuration) {
    playVoiceOn(c, outGetter(trackId), resolveVoice(trackId), time, noteMidi, stepDuration);
  }

  function ensureContext() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.85;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function getTrackGain(trackId, defaultVol = 0.8) {
    ensureContext();
    if (!trackGains[trackId]) {
      const g = ctx.createGain();
      g.gain.value = defaultVol;
      g.connect(masterGain);
      trackGains[trackId] = g;
    }
    return trackGains[trackId];
  }

  function setTrackVolume(trackId, vol) {
    getTrackGain(trackId).gain.setTargetAtTime(vol, ctx.currentTime, 0.02);
  }

  function playTrackSound(trackId, time, noteMidi, stepDuration) {
    playTrackSoundOn(ensureContext(), (id) => getTrackGain(id), trackId, time, noteMidi, stepDuration);
  }

  function previewTrackNote(trackId, midi, duration) {
    const voice = resolveVoice(trackId);
    const dur =
      duration != null ? duration : previewDurationForVoice(voice);
    const stepDur = melodicNoteDuration(voice, dur);
    playTrackSound(trackId, ensureContext().currentTime + 0.02, midi, stepDur);
  }

  function createOfflineScheduler(volumes) {
    const gains = {};
    return {
      schedule(c, master, trackId, time, noteMidi, stepDuration) {
        if (!gains[trackId]) {
          const g = c.createGain();
          g.gain.value = volumes[trackId] ?? 0.75;
          g.connect(master);
          gains[trackId] = g;
        }
        playTrackSoundOn(c, (id) => gains[id], trackId, time, noteMidi, stepDuration);
      },
    };
  }

  return {
    ensureContext,
    setTrackVolume,
    playTrackSound,
    playTrackSoundOn,
    playVoiceOn,
    previewTrackNote,
    createOfflineScheduler,
    midiToFreq,
    getContext: () => ctx,
  };
})();
