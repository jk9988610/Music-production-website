/**
 * Web Audio 合成 — 乐队常用乐器（鼓组 / 电声 / 管乐 / 弓弦，见各 play* 注释）
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
   * 弓弦 — 琴身共振峰 + 三角主体（避免铜管式低通扫频）：
   * - 激励以三角波为主、少量锯齿
   * - 并行 peaking 模拟琴箱共鸣，不做 500→4kHz 号嘴扫频
   * - 持续弓毛摩擦噪声 + 延迟揉弦
   */
  function playBowedString(c, out, time, midi, duration, gain, preset) {
    const freq = midiToFreq(midi);
    const stopAt = time + duration + 0.3;
    const atk = preset.attack ?? 0.12;
    const rel = duration * (preset.releaseMul ?? 0.9);

    const master = c.createGain();
    master.gain.setValueAtTime(0, time);
    master.gain.linearRampToValueAtTime(gain, time + atk);
    master.gain.setValueAtTime(gain * (preset.sustain ?? 0.85), time + atk + 0.12);
    master.gain.exponentialRampToValueAtTime(0.001, time + rel);
    master.connect(out);

    const mix = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    const lpHz = Math.min(
      preset.lpMax ?? 5000,
      freq * (preset.lpFreqMul ?? 7) + (preset.lpBase ?? 350)
    );
    lp.frequency.setValueAtTime(lpHz * 0.92, time);
    lp.frequency.linearRampToValueAtTime(lpHz, time + atk * 2);
    lp.Q.value = 0.4;
    mix.connect(lp);
    lp.connect(master);

    const exciter = c.createGain();
    exciter.gain.value = 1;
    const waves = preset.waves ?? [
      { type: "triangle", amp: 0.55 },
      { type: "sawtooth", amp: 0.14 },
    ];

    (preset.detuneCents ?? [-6, 0, 6]).forEach((cents, idx) => {
      const spread = idx === 1 ? 1 : 0.68;
      waves.forEach(({ type, amp }) => {
        const osc = c.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, time);
        osc.detune.setValueAtTime(cents, time);

        const vib = c.createOscillator();
        vib.type = "sine";
        vib.frequency.value = preset.vibratoHz ?? 5;
        const vibDepth = c.createGain();
        vibDepth.gain.value = preset.vibratoCents ?? 12;
        vib.connect(vibDepth);
        vibDepth.connect(osc.detune);
        const vibStart = time + (preset.vibratoDelay ?? 0.2);
        vib.start(vibStart);
        vib.stop(stopAt);

        const vGain = c.createGain();
        vGain.gain.value = amp * spread;
        osc.connect(vGain);
        vGain.connect(exciter);
        osc.start(time);
        osc.stop(stopAt);
      });
    });

    (preset.bodyResonances ?? [{ ratio: 1, q: 2.5, gain: 5, mix: 0.38 }]).forEach((res) => {
      const peak = c.createBiquadFilter();
      peak.type = "peaking";
      peak.frequency.value = Math.max(
        90,
        Math.min(preset.peakMaxHz ?? 6500, freq * res.ratio)
      );
      peak.Q.value = res.q ?? 3;
      peak.gain.value = res.gain ?? 4;
      const branch = c.createGain();
      branch.gain.value = res.mix ?? 0.35;
      exciter.connect(peak);
      peak.connect(branch);
      branch.connect(mix);
    });

    const dry = c.createGain();
    dry.gain.value = preset.dryMix ?? 0.22;
    exciter.connect(dry);
    dry.connect(mix);

    const bowDur = Math.min(duration * 0.9, preset.bowSustainDur ?? 0.2);
    const bowLen = Math.max(8, Math.floor(c.sampleRate * bowDur));
    const bowBuf = c.createBuffer(1, bowLen, c.sampleRate);
    const bowData = bowBuf.getChannelData(0);
    for (let i = 0; i < bowLen; i++) {
      bowData[i] = (Math.random() * 2 - 1) * (0.65 + 0.35 * Math.random());
    }
    const bowSrc = c.createBufferSource();
    bowSrc.buffer = bowBuf;
    const bowF = c.createBiquadFilter();
    bowF.type = "bandpass";
    bowF.frequency.value = preset.bowFilterHz ?? 2000;
    bowF.Q.value = 1.4;
    const bowE = c.createGain();
    const bGain = gain * (preset.bowNoiseGain ?? 0.08);
    bowE.gain.setValueAtTime(0, time);
    bowE.gain.linearRampToValueAtTime(bGain, time + atk * 0.6);
    bowE.gain.setValueAtTime(bGain * 0.75, time + atk + 0.08);
    bowE.gain.exponentialRampToValueAtTime(0.001, time + atk + bowDur);
    bowSrc.connect(bowF);
    bowF.connect(bowE);
    bowE.connect(master);
    bowSrc.start(time);
    bowSrc.stop(time + bowDur + 0.02);
  }

  const BOW_VIOLIN = {
    attack: 0.11,
    sustain: 0.86,
    releaseMul: 0.92,
    vibratoHz: 5.1,
    vibratoCents: 12,
    vibratoDelay: 0.22,
    lpMax: 6500,
    lpFreqMul: 8.5,
    lpBase: 480,
    bowNoiseGain: 0.075,
    bowFilterHz: 2600,
    bowSustainDur: 0.24,
    detuneCents: [-7, 0, 7],
    dryMix: 0.2,
    waves: [
      { type: "triangle", amp: 0.6 },
      { type: "sawtooth", amp: 0.1 },
    ],
    bodyResonances: [
      { ratio: 1, q: 2.8, gain: 6, mix: 0.42 },
      { ratio: 2.6, q: 5, gain: 4, mix: 0.3 },
      { ratio: 5.2, q: 7, gain: -2, mix: 0.2 },
    ],
    peakMaxHz: 7500,
  };

  const BOW_CELLO = {
    attack: 0.15,
    sustain: 0.9,
    releaseMul: 0.95,
    vibratoHz: 4,
    vibratoCents: 9,
    vibratoDelay: 0.26,
    lpMax: 2600,
    lpFreqMul: 4.2,
    lpBase: 160,
    bowNoiseGain: 0.085,
    bowFilterHz: 1050,
    bowSustainDur: 0.3,
    detuneCents: [-5, 0, 5],
    dryMix: 0.28,
    waves: [
      { type: "triangle", amp: 0.65 },
      { type: "sawtooth", amp: 0.06 },
    ],
    bodyResonances: [
      { ratio: 1, q: 2.2, gain: 5, mix: 0.48 },
      { ratio: 2.1, q: 3.5, gain: 3, mix: 0.3 },
      { ratio: 3.6, q: 5, gain: -1, mix: 0.16 },
    ],
    peakMaxHz: 3800,
  };

  function playViolinOn(c, out, time, midi, duration, gain = 0.4) {
    playBowedString(c, out, time, midi, duration, gain, BOW_VIOLIN);
  }

  function playCelloOn(c, out, time, midi, duration, gain = 0.44) {
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

  function melodicNoteDuration(voice, stepDuration) {
    if (voice === "piano") return pianoNoteDuration(stepDuration);
    if (voice === "bass" || voice === "cello" || voice === "trombone") {
      return Math.max(stepDuration, 0.32);
    }
    if (voice === "violin" || voice === "cello") {
      return Math.max(stepDuration, 0.42);
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
      cello: 0.58,
      violin: 0.54,
      sax: 0.46,
      trumpet: 0.44,
      trombone: 0.48,
      eguitar: 0.34,
      lead: 0.32,
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

  /** 领奏 — 流行合成器 Lead（锯齿 + 扫频） */
  function playLeadOn(c, out, time, midi, duration, gain = 0.45) {
    const freq = midiToFreq(midi);
    const stopAt = time + duration + 0.08;

    const env = c.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(gain * 0.8, time + 0.012);
    env.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.88);

    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(900, time);
    lp.frequency.exponentialRampToValueAtTime(Math.min(5200, 1200 + freq * 8), time + 0.06);
    lp.Q.value = 2.2;

    const mix = c.createGain();
    mix.connect(lp);
    lp.connect(env);
    env.connect(out);

    [-7, 0, 7].forEach((cents, i) => {
      const osc = c.createOscillator();
      osc.type = i === 1 ? "sawtooth" : "square";
      osc.frequency.setValueAtTime(freq, time);
      osc.detune.setValueAtTime(cents, time);
      const g = c.createGain();
      g.gain.value = i === 1 ? 0.38 : 0.14;
      osc.connect(g);
      g.connect(mix);
      osc.start(time);
      osc.stop(stopAt);
    });
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
        playLeadOn(c, out, time, noteMidi, d * 0.9, gain);
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
