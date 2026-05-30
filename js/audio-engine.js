/**
 * Web Audio 合成 — 乐队常用乐器；弓弦为物理简化模型，钢琴为现代流行合成（见各 play* 注释）
 */
const AudioEngine = (() => {
  let ctx = null;
  let masterGain = null;
  const trackGains = {};

  function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function playKickOn(c, out, time, gain = 0.9) {
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.08);
    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.35);
    osc.connect(env);
    env.connect(out);
    osc.start(time);
    osc.stop(time + 0.4);
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
    osc.frequency.setValueAtTime(220, time);
    osc.frequency.exponentialRampToValueAtTime(80, time + 0.12);
    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.28);
    osc.connect(env);
    env.connect(out);
    osc.start(time);
    osc.stop(time + 0.3);
  }

  /**
   * 弓弦合成（参考 bowed string 模型，非简单锯齿+低通）：
   * - 锯齿波模拟弓毛激励
   * - 起音短噪声模拟弓毛抓弦
   * - 低通扫频模拟琴身共鸣建立
   * - 延迟 LFO 揉弦（约 4–5.5 Hz）
   */
  function playBowedString(c, out, time, midi, duration, gain, preset) {
    const freq = midiToFreq(midi);
    const stopAt = time + duration + 0.2;

    const bowLen = preset.bowNoiseDur ?? 0.04;
    const bowBuf = Math.floor(c.sampleRate * bowLen);
    const bow = c.createBuffer(1, bowBuf, c.sampleRate);
    const bowData = bow.getChannelData(0);
    for (let i = 0; i < bowBuf; i++) {
      bowData[i] = (Math.random() * 2 - 1) * (1 - i / bowBuf);
    }
    const bowSrc = c.createBufferSource();
    bowSrc.buffer = bow;
    const bowF = c.createBiquadFilter();
    bowF.type = "bandpass";
    bowF.frequency.value = preset.bowFilterHz ?? 1800;
    bowF.Q.value = 0.9;
    const bowE = c.createGain();
    bowE.gain.setValueAtTime(gain * (preset.bowNoiseGain ?? 0.12), time);
    bowE.gain.exponentialRampToValueAtTime(0.001, time + bowLen);
    bowSrc.connect(bowF);
    bowF.connect(bowE);
    bowE.connect(out);
    bowSrc.start(time);
    bowSrc.stop(time + bowLen + 0.01);

    const partials = preset.detuneCents ?? [-7, 0, 7];
    const atk = preset.attack ?? 0.06;
    const rel = duration * (preset.releaseMul ?? 0.9);

    partials.forEach((cents, idx) => {
      const osc = c.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      osc.detune.value = cents;

      const vib = c.createOscillator();
      vib.type = "sine";
      vib.frequency.value = preset.vibratoHz ?? 5;
      const vibDepth = c.createGain();
      vibDepth.gain.value = preset.vibratoCents ?? 18;
      vib.connect(vibDepth);
      vibDepth.connect(osc.detune);
      const vibStart = time + (preset.vibratoDelay ?? 0.14);
      vib.start(vibStart);
      vib.stop(stopAt);

      const body = c.createBiquadFilter();
      body.type = "lowpass";
      body.Q.value = preset.resonance ?? 1.6;
      const lpLo = preset.lpAttackHz ?? 400;
      const lpHi = preset.lpSustainHz ?? 3500;
      body.frequency.setValueAtTime(lpLo, time);
      body.frequency.exponentialRampToValueAtTime(lpHi, time + atk);

      const amp = c.createGain();
      const pGain = gain * (idx === 1 ? 0.42 : 0.28);
      amp.gain.setValueAtTime(0, time);
      amp.gain.linearRampToValueAtTime(pGain, time + atk);
      amp.gain.setValueAtTime(pGain * (preset.sustain ?? 0.75), time + atk + 0.04);
      amp.gain.exponentialRampToValueAtTime(0.001, time + rel);

      osc.connect(body);
      body.connect(amp);
      amp.connect(out);
      osc.start(time);
      osc.stop(stopAt);
    });
  }

  const BOW_VIOLIN = {
    attack: 0.05,
    lpAttackHz: 520,
    lpSustainHz: 4800,
    vibratoHz: 5.4,
    vibratoCents: 20,
    vibratoDelay: 0.1,
    resonance: 2,
    releaseMul: 0.85,
    sustain: 0.7,
    bowNoiseGain: 0.14,
    bowFilterHz: 2200,
  };

  const BOW_CELLO = {
    attack: 0.07,
    lpAttackHz: 220,
    lpSustainHz: 1600,
    vibratoHz: 4.2,
    vibratoCents: 14,
    vibratoDelay: 0.16,
    resonance: 2.4,
    releaseMul: 0.92,
    sustain: 0.8,
    bowNoiseGain: 0.16,
    bowFilterHz: 900,
    detuneCents: [-5, 0, 5],
  };

  function playViolinOn(c, out, time, midi, duration, gain = 0.4) {
    playBowedString(c, out, time, midi, duration, gain, BOW_VIOLIN);
  }

  function playCelloOn(c, out, time, midi, duration, gain = 0.44) {
    playBowedString(c, out, time, midi, duration, gain, BOW_CELLO);
  }

  /**
   * 钢琴 — 现代流行 / 工作室贴皮取向（非古典击弦、非拨弦快衰）：
   * - 共享柔和 ADSR，三角主体 + 整数谐波，无琴槌噪声
   * - 稳定低通 + 轻微 presence，短延迟增加空间感
   */
  function playPianoOn(c, out, time, midi, duration, gain = 0.5) {
    const freq = midiToFreq(midi);
    const stopAt = time + duration + 0.25;

    const toneBus = c.createGain();
    toneBus.gain.value = 1;

    const masterEnv = c.createGain();
    const peak = gain * 0.82;
    masterEnv.gain.setValueAtTime(0, time);
    masterEnv.gain.linearRampToValueAtTime(peak, time + 0.032);
    masterEnv.gain.linearRampToValueAtTime(peak * 0.94, time + 0.12);
    masterEnv.gain.setValueAtTime(peak * 0.88, time + duration * 0.5);
    masterEnv.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.96);

    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    const lpHz = Math.min(4400, 380 + freq * 5.2);
    lp.frequency.setValueAtTime(lpHz, time);
    lp.Q.value = 0.4;

    const presence = c.createBiquadFilter();
    presence.type = "peaking";
    presence.frequency.value = Math.min(3200, freq * 2.8 + 900);
    presence.Q.value = 0.7;
    presence.gain.value = 2.2;

    toneBus.connect(presence);
    presence.connect(lp);
    lp.connect(masterEnv);

    const delay = c.createDelay(0.04);
    delay.delayTime.value = 0.016;
    const dlyLp = c.createBiquadFilter();
    dlyLp.type = "lowpass";
    dlyLp.frequency.value = 2400;
    const dlyGain = c.createGain();
    dlyGain.gain.value = 0.14;
    toneBus.connect(delay);
    delay.connect(dlyLp);
    dlyLp.connect(dlyGain);
    dlyGain.connect(masterEnv);

    masterEnv.connect(out);

    [-2.2, 2.2, 0].forEach((cents, i) => {
      const osc = c.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, time);
      if (cents) osc.detune.setValueAtTime(cents, time);
      const layer = c.createGain();
      layer.gain.value = i === 2 ? 0.28 : 0.36;
      osc.connect(layer);
      layer.connect(toneBus);
      osc.start(time);
      osc.stop(stopAt);
    });

    [
      { n: 2, amp: 0.18, wave: "sine" },
      { n: 3, amp: 0.1, wave: "sine" },
      { n: 4, amp: 0.055, wave: "triangle" },
      { n: 5, amp: 0.032, wave: "sine" },
    ].forEach(({ n, amp, wave }) => {
      const osc = c.createOscillator();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq * n, time);
      const layer = c.createGain();
      layer.gain.value = amp;
      osc.connect(layer);
      layer.connect(toneBus);
      osc.start(time);
      osc.stop(stopAt);
    });
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

  function playSaxOn(c, out, time, midi, duration, gain = 0.45) {
    const freq = midiToFreq(midi);
    const osc = c.createOscillator();
    const osc2 = c.createOscillator();
    const env = c.createGain();
    const f = c.createBiquadFilter();
    osc.type = "sawtooth";
    osc2.type = "square";
    osc.frequency.value = freq;
    osc2.frequency.value = freq;
    osc2.detune.value = 3;
    f.type = "lowpass";
    f.frequency.setValueAtTime(800, time);
    f.frequency.exponentialRampToValueAtTime(3200, time + 0.05);
    f.Q.value = 2;
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(gain, time + 0.045);
    env.gain.setValueAtTime(gain * 0.75, time + duration * 0.35);
    env.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.82);
    osc.connect(f);
    osc2.connect(f);
    f.connect(env);
    env.connect(out);
    osc.start(time);
    osc2.start(time);
    osc.stop(time + duration + 0.1);
    osc2.stop(time + duration + 0.1);
  }

  function playTrumpetOn(c, out, time, midi, duration, gain = 0.48) {
    const freq = midiToFreq(midi);
    const osc = c.createOscillator();
    const env = c.createGain();
    const f = c.createBiquadFilter();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    f.type = "lowpass";
    f.frequency.setValueAtTime(600, time);
    f.frequency.exponentialRampToValueAtTime(3800, time + 0.04);
    f.Q.value = 2.5;
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(gain, time + 0.035);
    env.gain.setValueAtTime(gain * 0.82, time + duration * 0.4);
    env.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.8);
    osc.connect(f);
    f.connect(env);
    env.connect(out);
    osc.start(time);
    osc.stop(time + duration + 0.1);
  }

  function playTromboneOn(c, out, time, midi, duration, gain = 0.46) {
    const freq = midiToFreq(midi);
    const osc = c.createOscillator();
    const env = c.createGain();
    const f = c.createBiquadFilter();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    f.type = "lowpass";
    f.frequency.setValueAtTime(350, time);
    f.frequency.exponentialRampToValueAtTime(2400, time + 0.055);
    f.Q.value = 2.2;
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(gain, time + 0.05);
    env.gain.setValueAtTime(gain * 0.85, time + duration * 0.45);
    env.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.88);
    osc.connect(f);
    f.connect(env);
    env.connect(out);
    osc.start(time);
    osc.stop(time + duration + 0.12);
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
    const d = stepDuration;
    switch (voice) {
      case "bass":
        playMono(c, out, time, noteMidi, d * 0.95, gain, {
          wave: "sawtooth",
          lp: 550,
          attack: 0.006,
          releaseMul: 0.88,
          q: 1.5,
        });
        break;
      case "lead":
        playMono(c, out, time, noteMidi, d * 0.85, gain, {
          wave: "square",
          lp: 3000,
          attack: 0.015,
          releaseMul: 0.82,
        });
        break;
      case "piano":
        playPianoOn(c, out, time, noteMidi, d * 0.92, gain);
        break;
      case "eguitar":
        playMono(c, out, time, noteMidi, d * 0.62, gain, {
          wave: "sawtooth",
          lp: 3400,
          attack: 0.006,
          releaseMul: 0.68,
          q: 1.8,
        });
        break;
      case "sax":
        playSaxOn(c, out, time, noteMidi, d * 0.82, gain);
        break;
      case "trumpet":
        playTrumpetOn(c, out, time, noteMidi, d * 0.8, gain);
        break;
      case "trombone":
        playTromboneOn(c, out, time, noteMidi, d * 0.88, gain);
        break;
      case "violin":
        playViolinOn(c, out, time, noteMidi, d, gain);
        break;
      case "cello":
        playCelloOn(c, out, time, noteMidi, d, gain);
        break;
      default:
        playMono(c, out, time, noteMidi, d * 0.8, gain, { lp: 2600, attack: 0.02 });
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
        playHatOn(c, out, time, true, 0.42, 5500);
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

  function previewTrackNote(trackId, midi, duration = 0.28) {
    playTrackSound(trackId, ensureContext().currentTime + 0.02, midi, duration);
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
