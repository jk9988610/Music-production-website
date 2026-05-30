/**
 * HarmonyForge 主应用 — UI 与播放调度
 */
(() => {
  const STORAGE_KEY = "harmonyforge-project";
  const DRAFT_KEY = "harmonyforge-draft";
  let autosaveTimer = null;

  let playing = false;
  let playMode = "pattern";
  let currentStep = -1;
  let currentArrangeSection = -1;
  let schedulerTimer = null;
  let nextStepTime = 0;
  let stepCounter = 0;
  let bpm = 120;
  let swing = 0;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const els = {
    btnPlay: $("#btnPlay"),
    btnStop: $("#btnStop"),
    bpm: $("#bpm"),
    bpmValue: $("#bpmValue"),
    swing: $("#swing"),
    swingValue: $("#swingValue"),
    keySelect: $("#keySelect"),
    scaleSelect: $("#scaleSelect"),
    patternTabs: $("#patternTabs"),
    btnRemovePattern: $("#btnRemovePattern"),
    btnAddPattern: $("#btnAddPattern"),
    tracks: $("#tracks"),
    stepLabels: $("#stepLabels"),
    arrangeTimeline: $("#arrangeTimeline"),
    btnRemoveSection: $("#btnRemoveSection"),
    arrangeInfo: $("#arrangeInfo"),
    btnRemoveSteps: $("#btnRemoveSteps"),
    btnAddSteps: $("#btnAddSteps"),
    stepCountInfo: $("#stepCountInfo"),
    mixer: $("#mixer"),
    statusText: $("#statusText"),
    btnExport: $("#btnExport"),
    btnImport: $("#btnImport"),
    projectFileInput: $("#projectFileInput"),
    btnSave: $("#btnSave"),
    btnLoad: $("#btnLoad"),
    btnClear: $("#btnClear"),
    noteDialog: $("#noteDialog"),
    noteGrid: $("#noteGrid"),
    noteClear: $("#noteClear"),
  };

  let noteEditContext = null;

  function patternLabel(index) {
    if (index < 26) return String.fromCharCode(65 + index);
    return `P${index + 1}`;
  }

  function syncSequencerLayout() {
    const wrap = document.querySelector(".module-sequencer .sequencer-wrap");
    if (wrap) wrap.style.setProperty("--seq-step-count", String(Sequencer.steps));
  }

  let moduleSpacingRaf = null;

  window.syncModuleSpacing = function syncModuleSpacing() {
    const cfg =
      typeof LayoutManager !== "undefined" && LayoutManager.getSpacingConfig
        ? LayoutManager.getSpacingConfig()
        : { autoGap: true, moduleGap: 0, mainGap: 15 };

    const main = document.querySelector(".main");
    const mainGapPx = Math.max(0, Number(cfg.mainGap) || 0);
    const moduleGapPx = Math.max(0, Number(cfg.moduleGap) || 0);

    document.documentElement.style.setProperty("--main-module-gap", `${mainGapPx}px`);
    document.documentElement.style.setProperty("--chrome-module-gap", `${moduleGapPx}px`);

    if (!main) return;

    if (!cfg.autoGap) {
      main.style.removeProperty("padding-bottom");
      document.documentElement.style.setProperty("--layout-main-pad-bottom", "0");
      return;
    }

    if (moduleSpacingRaf) cancelAnimationFrame(moduleSpacingRaf);
    moduleSpacingRaf = requestAnimationFrame(() => {
      moduleSpacingRaf = null;
      const visible = [...main.querySelectorAll("fieldset.module[data-module]:not([hidden])")];
      if (!visible.length) {
        main.style.paddingBottom = "0";
        document.documentElement.style.setProperty("--layout-main-pad-bottom", "0");
        return;
      }
      const mainRect = main.getBoundingClientRect();
      const last = visible[visible.length - 1];
      const lastBottom = last.getBoundingClientRect().bottom;
      const used = lastBottom - mainRect.top;
      const pad = Math.max(0, Math.round(mainRect.height - used));
      main.style.paddingBottom = `${pad}px`;
      document.documentElement.style.setProperty("--layout-main-pad-bottom", `${pad}px`);
    });
  }

  function logModuleShellMetrics() {
    document.querySelectorAll("fieldset.module").forEach((fs) => {
      const body = fs.querySelector(".module-body");
      const chrome = fs.querySelector(".module-chrome");
      const name = fs.querySelector("legend")?.textContent || "?";
      const r = fs.getBoundingClientRect();
      const br = body?.getBoundingClientRect();
      AppLogger.info(
        `外壳[${name}]`,
        `fieldset ${Math.round(r.height)}px · body ${body ? Math.round(br.height) : 0}px` +
          (chrome ? ` · 工具条 ${Math.round(chrome.getBoundingClientRect().height)}px` : "")
      );
    });
  }

  function init() {
    if (new URLSearchParams(location.search).get("debug") === "layers") {
      document.documentElement.setAttribute("data-debug-layers", "");
      requestAnimationFrame(() => logModuleShellMetrics());
    }

    AppLogger.info("HarmonyForge 启动", `v${AppVersion.CURRENT} · build ${AppVersion.BUILD}`);
    AppVersion.initUI();
    LayoutManager.init({
      onChange: () => scheduleAutosave(),
    });
    populateKeySelect();
    if (!loadDraft()) {
      Sequencer.loadDemoPatterns();
    }
    renderPatternTabs();
    renderStepLabels();
    renderSequencer();
    renderArrangement();
    renderMixer();
    bindEvents();
    applyVolumesToEngine();
    updateStepCountUI();
    syncSequencerLayout();
    syncModuleSpacing();
    window.addEventListener("resize", syncModuleSpacing);
    if (typeof ResizeObserver !== "undefined") {
      const main = document.querySelector(".main");
      if (main) new ResizeObserver(syncModuleSpacing).observe(main);
    }
    setStatus("就绪 — 草稿将自动保存");
    scheduleAutosave();
  }

  function populateKeySelect() {
    Sequencer.KEYS.forEach((key, i) => {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = key;
      if (i === Sequencer.rootKey()) opt.selected = true;
      els.keySelect.appendChild(opt);
    });
  }

  function renderPatternTabs() {
    els.patternTabs.innerHTML = "";
    for (let i = 0; i < Sequencer.patternCount; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pattern-tab" + (i === Sequencer.currentPattern() ? " active" : "");
      btn.textContent = patternLabel(i);
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", i === Sequencer.currentPattern());
      btn.dataset.pattern = i;
      btn.addEventListener("click", () => selectPattern(i));
      els.patternTabs.appendChild(btn);
    }
    if (els.btnAddPattern) {
      els.btnAddPattern.disabled = Sequencer.patternCount >= Sequencer.MAX_PATTERNS;
    }
    if (els.btnRemovePattern) {
      els.btnRemovePattern.disabled = Sequencer.patternCount <= Sequencer.MIN_PATTERNS;
    }
  }

  function selectPattern(index) {
    Sequencer.setCurrentPattern(index);
    renderPatternTabs();
    renderSequencer();
    setStatus(`Pattern ${patternLabel(index)}`);
    scheduleAutosave();
  }

  function updateStepCountUI() {
    if (els.stepCountInfo) {
      els.stepCountInfo.textContent = `${Sequencer.steps}步`;
    }
    if (els.btnAddSteps) {
      els.btnAddSteps.disabled = Sequencer.steps >= Sequencer.MAX_STEPS;
    }
    if (els.btnRemoveSteps) {
      els.btnRemoveSteps.disabled = Sequencer.steps <= Sequencer.MIN_STEPS;
    }
  }

  function renderStepLabels() {
    els.stepLabels.innerHTML = '<span class="step-label"></span>';
    for (let s = 0; s < Sequencer.steps; s++) {
      const span = document.createElement("span");
      span.className = "step-label" + (s % 4 === 0 ? " beat" : "");
      span.textContent = s + 1;
      els.stepLabels.appendChild(span);
    }
    syncSequencerLayout();
  }

  function renderSequencer() {
    const pattern = Sequencer.getPattern(Sequencer.currentPattern());
    els.tracks.innerHTML = "";

    Sequencer.TRACKS.forEach((track) => {
      const row = document.createElement("div");
      row.className = "track-row";

      const name = document.createElement("span");
      name.className = `track-name ${track.type === "drum" ? "drum" : track.class}`;
      name.textContent = track.name;
      row.appendChild(name);

      for (let step = 0; step < Sequencer.steps; step++) {
        const cell = pattern[track.id][step];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `step-cell ${cell.on ? "on " + track.class : ""}`;
        btn.dataset.track = track.id;
        btn.dataset.step = step;
        btn.setAttribute("aria-label", `${track.name} 第 ${step + 1} 步`);

        if (cell.on && track.type === "melodic" && cell.note != null) {
          const lbl = document.createElement("span");
          lbl.className = "note-label";
          lbl.textContent = Sequencer.noteLabel(cell.note);
          btn.appendChild(lbl);
        }

        btn.addEventListener("click", () => onStepClick(track, step));
        row.appendChild(btn);
      }
      els.tracks.appendChild(row);
    });
    syncSequencerLayout();
    syncModuleSpacing();
  }

  function onStepClick(track, step) {
    const pi = Sequencer.currentPattern();
    if (track.type === "melodic") {
      const cell = Sequencer.getPattern(pi)[track.id][step];
      if (!cell.on) {
        openNoteDialog(track.id, step, pi);
      } else {
        openNoteDialog(track.id, step, pi);
      }
    } else {
      Sequencer.toggleStep(pi, track.id, step);
      renderSequencer();
      scheduleAutosave();
    }
  }

  function openNoteDialog(trackId, step, patternIndex) {
    noteEditContext = { trackId, step, patternIndex };
    const notes = Sequencer.getScaleNotes();
    els.noteGrid.innerHTML = "";
    notes.forEach((midi) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "note-btn";
      btn.textContent = Sequencer.noteLabel(midi);
      btn.addEventListener("click", () => {
        Sequencer.toggleStep(patternIndex, trackId, step, midi);
        els.noteDialog.close();
        renderSequencer();
        scheduleAutosave();
      });
      els.noteGrid.appendChild(btn);
    });
    els.noteDialog.showModal();
  }

  function renderArrangement() {
    const sections = Arranger.getSections();
    els.arrangeTimeline.innerHTML = "";

    sections.forEach((sec, i) => {
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = "arrange-slot";
      slot.innerHTML = `
        <span class="arrange-slot-index">§${i + 1}</span>
        <span class="arrange-slot-pattern">${patternLabel(sec.patternIndex)}</span>
      `;
      slot.addEventListener("click", () => {
        Arranger.cycleSectionPattern(i, Sequencer.patternCount);
        renderArrangement();
        scheduleAutosave();
      });
      els.arrangeTimeline.appendChild(slot);
    });

    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.id = "btnAddSection";
    addBtn.className = "arrange-slot arrange-slot-add";
    addBtn.title = "在末尾增加一个编曲段落";
    addBtn.innerHTML = '<span class="arrange-slot-add-label">+段</span>';
    els.arrangeTimeline.appendChild(addBtn);

    els.arrangeInfo.textContent = `${sections.length}段 · ${Sequencer.patternCount}型 · ${Sequencer.steps}步/段`;
    if (els.btnRemoveSection) {
      els.btnRemoveSection.disabled = sections.length <= Arranger.MIN_SECTIONS;
    }
    syncModuleSpacing();
  }

  function renderMixer() {
    els.mixer.innerHTML = "";
    const vols = Sequencer.volumes();
    Sequencer.TRACKS.forEach((track) => {
      const wrap = document.createElement("div");
      wrap.className = "mixer-track";
      const pct = Math.round((vols[track.id] ?? 0.8) * 100);
      wrap.innerHTML = `
        <label>
          <span>${track.name}</span>
          <span data-vol-display="${track.id}">${pct}%</span>
        </label>
        <input type="range" min="0" max="100" value="${pct}" data-track="${track.id}">
      `;
      const range = wrap.querySelector("input");
      range.addEventListener("input", () => {
        const v = range.value / 100;
        Sequencer.setVolume(track.id, v);
        AudioEngine.setTrackVolume(track.id, v);
        wrap.querySelector(`[data-vol-display="${track.id}"]`).textContent = `${range.value}%`;
        scheduleAutosave();
      });
      els.mixer.appendChild(wrap);
    });
  }

  function applyVolumesToEngine() {
    Object.entries(Sequencer.volumes()).forEach(([id, v]) => {
      AudioEngine.setTrackVolume(id, v);
    });
  }

  function bindEvents() {
    els.btnPlay.addEventListener("click", togglePlay);
    els.btnStop.addEventListener("click", stop);
    els.bpm.addEventListener("input", () => {
      bpm = Number(els.bpm.value);
      els.bpmValue.textContent = bpm;
      scheduleAutosave();
    });
    els.swing.addEventListener("input", () => {
      swing = Number(els.swing.value);
      els.swingValue.textContent = `${swing}%`;
      scheduleAutosave();
    });
    els.keySelect.addEventListener("change", () => {
      Sequencer.setRootKey(Number(els.keySelect.value));
      scheduleAutosave();
    });
    els.scaleSelect.addEventListener("change", () => {
      Sequencer.setScaleName(els.scaleSelect.value);
      scheduleAutosave();
    });

    if (els.btnRemoveSection) {
      els.btnRemoveSection.addEventListener("click", () => {
        const r = Arranger.removeSection();
        if (!r.ok) {
          setStatus("至少保留 1 个编曲段");
          return;
        }
        renderArrangement();
        scheduleAutosave();
        setStatus(`已减少至 ${r.count} 段`);
      });
    }

    if (els.arrangeTimeline) {
      els.arrangeTimeline.addEventListener("click", (e) => {
        if (e.target.closest("#btnAddSection")) {
          Arranger.addSection();
          renderArrangement();
          scheduleAutosave();
        }
      });
    }

    if (els.btnAddSteps) {
      els.btnAddSteps.addEventListener("click", () => {
        const r = Sequencer.addSteps(Sequencer.STEP_ADD);
        if (!r.ok) {
          setStatus(`已达最大 ${Sequencer.MAX_STEPS} 步`);
          return;
        }
        renderStepLabels();
        renderSequencer();
        updateStepCountUI();
        scheduleAutosave();
        setStatus(`已增加至 ${Sequencer.steps} 步`);
      });
    }
    if (els.btnRemoveSteps) {
      els.btnRemoveSteps.addEventListener("click", () => {
        const r = Sequencer.removeSteps(Sequencer.STEP_ADD);
        if (!r.ok) {
          setStatus(`最少保留 ${Sequencer.MIN_STEPS} 步`);
          return;
        }
        renderStepLabels();
        renderSequencer();
        updateStepCountUI();
        renderArrangement();
        scheduleAutosave();
        setStatus(`已减少至 ${Sequencer.steps} 步`);
      });
    }

    if (els.btnAddPattern) {
      els.btnAddPattern.addEventListener("click", () => {
        const r = Sequencer.addPattern();
        if (!r.ok) {
          setStatus(`已达最大 ${Sequencer.MAX_PATTERNS} 个 Pattern`);
          return;
        }
        renderPatternTabs();
        renderArrangement();
        scheduleAutosave();
        setStatus(`已增加至 ${r.count} 个 Pattern（${patternLabel(r.count - 1)}）`);
      });
    }
    if (els.btnRemovePattern) {
      els.btnRemovePattern.addEventListener("click", () => {
        const r = Sequencer.removePattern();
        if (!r.ok) {
          setStatus(`至少保留 ${Sequencer.MIN_PATTERNS} 个 Pattern`);
          return;
        }
        Arranger.getSections().forEach((sec) => {
          if (sec.patternIndex >= Sequencer.patternCount) {
            sec.patternIndex = Sequencer.patternCount - 1;
          }
        });
        renderPatternTabs();
        renderArrangement();
        scheduleAutosave();
        setStatus(`已减少至 ${r.count} 个 Pattern`);
      });
    }



    if (els.btnExport) {
      els.btnExport.addEventListener("click", () => {
        try {
          const suggested = prompt("导出文件名（不含扩展名，留空用时间戳）", "");
          if (suggested === null) return;
          const { filename } = ProjectIO.exportToFile(getProjectData(), {
            name: suggested.trim() || undefined,
          });
          AppLogger.info("项目已导出", filename);
          setStatus(`已导出 ${filename}`);
        } catch (err) {
          AppLogger.error("导出失败", err.message);
          setStatus("导出失败：" + err.message);
        }
      });
    }

    if (els.btnImport && els.projectFileInput) {
      els.btnImport.addEventListener("click", () => els.projectFileInput.click());
      els.projectFileInput.addEventListener("change", async () => {
        const file = els.projectFileInput.files?.[0];
        els.projectFileInput.value = "";
        if (!file) return;
        try {
          if (!confirm(`导入「${file.name}」将覆盖当前编曲与布局，是否继续？`)) return;
          const project = await ProjectIO.importFromFile(file);
          applyProjectData(project);
          scheduleAutosave();
          AppLogger.info("项目已导入", file.name);
          setStatus(`已导入 ${file.name}`);
        } catch (err) {
          AppLogger.error("导入失败", err.message);
          setStatus("导入失败：" + err.message);
        }
      });
    }

    els.btnSave.addEventListener("click", saveProject);
    els.btnLoad.addEventListener("click", loadProject);
    els.btnClear.addEventListener("click", clearProject);
    els.noteClear.addEventListener("click", () => {
      if (noteEditContext) {
        const { trackId, step, patternIndex } = noteEditContext;
        const cell = Sequencer.getPattern(patternIndex)[trackId][step];
        cell.on = false;
        cell.note = null;
        els.noteDialog.close();
        renderSequencer();
        scheduleAutosave();
      }
    });

    const btnHelp = document.getElementById("btnHelp");
    const helpDialog = document.getElementById("helpDialog");
    const btnHelpClose = document.getElementById("btnHelpClose");
    if (btnHelp && helpDialog) {
      btnHelp.addEventListener("click", () => helpDialog.showModal());
    }
    if (btnHelpClose && helpDialog) {
      btnHelpClose.addEventListener("click", () => helpDialog.close());
    }

    window.addEventListener("beforeunload", saveDraftNow);

    document.addEventListener("keydown", (e) => {
      if (e.target.matches("input, select, textarea")) return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      }
      if (e.key >= "1" && e.key <= "9") {
        const pi = Number(e.key) - 1;
        if (pi < Sequencer.patternCount) selectPattern(pi);
      }
    });
  }

  function getStepDuration() {
    return 60 / bpm / 4;
  }

  function getStepDelay(stepInPattern) {
    const base = getStepDuration();
    if (swing <= 0) return base;
    const isOff = stepInPattern % 2 === 1;
    const factor = 1 + (swing / 100) * (isOff ? 0.33 : -0.15);
    return base * factor;
  }

  function togglePlay() {
    if (playing) {
      pause();
    } else {
      AppLogger.info("开始播放编曲");
      startPlay("arrange");
    }
  }

  function startPlay(mode) {
    AudioEngine.ensureContext();
    playing = true;
    playMode = mode;
    stepCounter = 0;
    currentStep = -1;
    currentArrangeSection = 0;
    nextStepTime = AudioEngine.getContext().currentTime + 0.05;
    els.btnPlay.classList.add("playing");
    els.btnPlay.textContent = "⏸";
    schedule();
    setStatus(mode === "arrange" ? "播放编曲时间轴…" : "播放 Pattern…");
  }

  function pause() {
    playing = false;
    if (schedulerTimer) {
      clearTimeout(schedulerTimer);
      schedulerTimer = null;
    }
    els.btnPlay.classList.remove("playing");
    els.btnPlay.textContent = "▶";
    clearPlayhead();
    setStatus("已暂停");
  }

  function stop() {
    AppLogger.info("停止播放");
    pause();
    currentStep = -1;
    currentArrangeSection = -1;
    stepCounter = 0;
    setStatus("已停止");
  }

  function schedule() {
    if (!playing) return;
    const ctx = AudioEngine.getContext();
    const lookAhead = 0.1;

    while (nextStepTime < ctx.currentTime + lookAhead) {
      playStepAt(nextStepTime);
      const stepInPattern = stepCounter % Sequencer.steps;
      nextStepTime += getStepDelay(stepInPattern);
      stepCounter++;
    }

    schedulerTimer = setTimeout(schedule, 25);
  }

  function playStepAt(time) {
    let patternIndex;
    let step;
    const sections = Arranger.getSections();

    if (playMode === "arrange") {
      const totalSteps = sections.length * Sequencer.steps;
      const globalStep = stepCounter % totalSteps;
      currentArrangeSection = Math.floor(globalStep / Sequencer.steps);
      step = globalStep % Sequencer.steps;
      patternIndex = sections[currentArrangeSection]?.patternIndex ?? 0;
    } else {
      patternIndex = Sequencer.currentPattern();
      step = stepCounter % Sequencer.steps;
    }

    currentStep = step;
    updatePlayhead(step, currentArrangeSection);

    const pattern = Sequencer.getPattern(patternIndex);
    const stepDur = getStepDuration();

    Sequencer.TRACKS.forEach((track) => {
      const cell = pattern[track.id][step];
      if (cell.on) {
        AudioEngine.playTrackSound(track.id, time, cell.note, stepDur);
      }
    });

    if (playMode === "arrange" && step === Sequencer.steps - 1) {
      const nextSec = (currentArrangeSection + 1) % sections.length;
      if (nextSec === 0 && stepCounter > 0) {
        setStatus("编曲循环播放中…");
      }
    }
  }

  function updatePlayhead(step, sectionIndex) {
    $$(".step-cell.current").forEach((el) => el.classList.remove("current"));
    $$(".arrange-slot.playing").forEach((el) => el.classList.remove("playing"));

    const rows = els.tracks.querySelectorAll(".track-row");
    rows.forEach((row) => {
      const cells = row.querySelectorAll(".step-cell");
      if (cells[step]) cells[step].classList.add("current");
    });

    if (playMode === "arrange" && sectionIndex >= 0) {
      const slots = els.arrangeTimeline.querySelectorAll(".arrange-slot:not(.arrange-slot-add)");
      if (slots[sectionIndex]) slots[sectionIndex].classList.add("playing");
    }
  }

  function clearPlayhead() {
    $$(".step-cell.current").forEach((el) => el.classList.remove("current"));
    $$(".arrange-slot.playing").forEach((el) => el.classList.remove("playing"));
  }

  function getProjectData() {
    return {
      version: 1,
      savedAt: Date.now(),
      sequencer: Sequencer.exportState(),
      arranger: Arranger.exportState(),
      bpm: Number(els.bpm.value),
      swing: Number(els.swing.value),
      layout: typeof LayoutManager !== "undefined" ? LayoutManager.exportState() : undefined,
    };
  }

  function applyProjectData(data, silent) {
    if (!data) return false;
    if (data.sequencer) Sequencer.importState(data.sequencer);
    if (data.layout && typeof LayoutManager !== "undefined") {
      LayoutManager.importState(data.layout);
    }
    if (data.arranger) Arranger.importState(data.arranger, Sequencer.patternCount);
    if (data.bpm) {
      els.bpm.value = data.bpm;
      bpm = data.bpm;
      els.bpmValue.textContent = bpm;
    }
    if (data.swing != null) {
      els.swing.value = data.swing;
      swing = data.swing;
      els.swingValue.textContent = `${swing}%`;
    }
    els.keySelect.value = String(Sequencer.rootKey());
    els.scaleSelect.value = Sequencer.scaleName();
    renderPatternTabs();
    renderStepLabels();
    renderSequencer();
    renderArrangement();
    updateStepCountUI();
    syncSequencerLayout();
    syncModuleSpacing();
    renderMixer();
    applyVolumesToEngine();
    if (!silent) AppLogger.info("项目数据已应用");
    return true;
  }

  function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(getProjectData()));
        AppLogger.info("草稿已自动保存");
      } catch (err) {
        AppLogger.error("草稿保存失败", err.message);
      }
    }, 600);
  }

  function saveDraftNow() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(getProjectData()));
    } catch (err) {
      AppLogger.error("草稿保存失败", err.message);
    }
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY) || localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      applyProjectData(data, true);
      AppLogger.info("已恢复草稿");
      return true;
    } catch (err) {
      AppLogger.warn("草稿恢复失败", err.message);
      return false;
    }
  }

  function saveProject() {
    const data = getProjectData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    AppLogger.info("项目已保存");
    setStatus("已保存（含草稿）");
  }

  function loadProject() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setStatus("没有已保存的项目");
        return;
      }
      applyProjectData(JSON.parse(raw));
      scheduleAutosave();
      AppLogger.info("项目已加载");
      setStatus("项目已加载");
    } catch (err) {
      AppLogger.error("加载失败", err.message);
      setStatus("加载失败：" + err.message);
    }
  }

  function clearProject() {
    if (!confirm("确定清空所有 Pattern 与编曲？此操作不可撤销。")) return;
    Sequencer.importState({ steps: 16, patterns: Sequencer.createEmptyPatterns(Sequencer.DEFAULT_PATTERN_COUNT) });
    Arranger.init(Sequencer.patternCount);
    Sequencer.loadDemoPatterns();
    if (typeof LayoutManager !== "undefined") LayoutManager.importState(null);
    localStorage.removeItem(DRAFT_KEY);
    renderStepLabels();
    renderSequencer();
    renderArrangement();
    updateStepCountUI();
    scheduleAutosave();
    setStatus("已重置为演示 Pattern");
  }

  function setStatus(msg) {
    els.statusText.textContent = msg;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();