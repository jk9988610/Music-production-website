/**
 * 模块布局 — 顺序、可见性、间距与内容尺寸，随项目草稿保存
 */
const LayoutManager = (() => {
  const MODULE_IDS = ["arrange", "sequencer", "mixer"];

  const DEFAULTS = {
    order: ["arrange", "sequencer", "mixer"],
    visible: { arrange: true, sequencer: true, mixer: true },
    autoGap: true,
    moduleGap: 6,
    mainGap: 6,
    columns: 1,
    appMaxWidth: 920,
    chromeModulePadX: 4,
    chromeModulePadB: 2,
    chromeLegendSize: 0.6,
    chromeToolbarGap: 2,
    moduleRadius: 3,
    contentSeqStep: 0.95,
    contentSeqLabel: 3.25,
    contentArrangeSlotW: 40,
    contentArrangeSlotH: 30,
    contentMixerTrackW: 3.35,
    compactHeader: false,
  };

  const PRESETS = {
    default: { ...DEFAULTS },
    compact: {
      ...DEFAULTS,
      autoGap: false,
      moduleGap: 2,
      mainGap: 2,
      chromeModulePadX: 2,
      chromeModulePadB: 1,
      chromeLegendSize: 0.55,
      contentSeqStep: 0.85,
      contentArrangeSlotW: 36,
      contentArrangeSlotH: 26,
      contentMixerTrackW: "3rem",
      compactHeader: true,
    },
    comfortable: {
      ...DEFAULTS,
      autoGap: true,
      moduleGap: 8,
      mainGap: 8,
      chromeModulePadX: 8,
      chromeModulePadB: 6,
      contentSeqStep: 1.05,
      contentArrangeSlotW: 48,
      contentArrangeSlotH: 36,
      contentMixerTrackW: "3.75rem",
    },
    wide: {
      ...DEFAULTS,
      columns: 2,
      appMaxWidth: 1100,
      autoGap: true,
      contentSeqStep: 1,
      contentArrangeSlotW: 44,
    },
  };

  let state = clone(DEFAULTS);
  let editMode = false;
  let onChange = null;
  let mainEl = null;

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function normalizeState(raw) {
    const s = { ...clone(DEFAULTS), ...raw };
    if (!Array.isArray(s.order)) s.order = [...DEFAULTS.order];
    s.order = s.order.filter((id) => MODULE_IDS.includes(id));
    MODULE_IDS.forEach((id) => {
      if (!s.order.includes(id)) s.order.push(id);
    });
    s.visible = { ...DEFAULTS.visible, ...(s.visible || {}) };
    MODULE_IDS.forEach((id) => {
      if (s.visible[id] == null) s.visible[id] = true;
    });
    s.columns = s.columns === 2 ? 2 : 1;
    s.appMaxWidth = clamp(Number(s.appMaxWidth) || DEFAULTS.appMaxWidth, 640, 1400);
    s.moduleGap = clamp(Number(s.moduleGap) ?? DEFAULTS.moduleGap, 0, 24);
    s.mainGap = clamp(Number(s.mainGap) ?? DEFAULTS.mainGap, 0, 24);
    return s;
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function remPx(rem) {
    return `${rem}rem`;
  }

  function applyCssVars() {
    const r = document.documentElement;
    const gap = state.autoGap ? null : state.moduleGap;
    if (!state.autoGap) {
      r.style.setProperty("--chrome-module-gap", `${state.moduleGap}px`);
      r.style.setProperty("--main-module-gap", `${state.mainGap}px`);
    }
    r.style.setProperty("--layout-manual-gap", state.autoGap ? "" : `${state.moduleGap}px`);
    r.style.setProperty("--chrome-module-pad-x", `${state.chromeModulePadX}px`);
    r.style.setProperty("--chrome-module-pad-b", `${state.chromeModulePadB}px`);
    r.style.setProperty("--chrome-legend-size", remPx(state.chromeLegendSize));
    r.style.setProperty("--chrome-toolbar-gap", `${state.chromeToolbarGap}px`);
    r.style.setProperty("--content-seq-step", remPx(state.contentSeqStep));
    r.style.setProperty("--content-seq-label", remPx(state.contentSeqLabel));
    r.style.setProperty("--content-arrange-slot-w", `${state.contentArrangeSlotW}px`);
    r.style.setProperty("--content-arrange-slot-h", `${state.contentArrangeSlotH}px`);
    r.style.setProperty("--content-mixer-track-w", typeof state.contentMixerTrackW === "string" ? state.contentMixerTrackW : remPx(state.contentMixerTrackW));
    r.style.setProperty("--layout-app-max-width", `${state.appMaxWidth}px`);
    r.style.setProperty("--layout-module-radius", `${state.moduleRadius}px`);
    r.dataset.layoutColumns = String(state.columns);
    r.dataset.layoutCompactHeader = state.compactHeader ? "1" : "0";
    r.dataset.layoutAutoGap = state.autoGap ? "1" : "0";
  }

  function applyModuleDom() {
    if (!mainEl) return;
    const map = {};
    mainEl.querySelectorAll("fieldset.module[data-module]").forEach((el) => {
      map[el.dataset.module] = el;
    });
    state.order.forEach((id) => {
      const el = map[id];
      if (el) mainEl.appendChild(el);
    });
    MODULE_IDS.forEach((id) => {
      const el = map[id];
      if (!el) return;
      const show = state.visible[id] !== false;
      el.hidden = !show;
      el.classList.toggle("layout-module-hidden", !show);
    });
  }

  function apply() {
    applyCssVars();
    applyModuleDom();
    document.documentElement.classList.toggle("layout-edit-mode", editMode);
  }

  function notifyChange() {
    if (typeof onChange === "function") onChange(exportState());
  }

  function setState(partial, silent) {
    state = normalizeState({ ...state, ...partial });
    apply();
    if (!silent) notifyChange();
  }

  function applyPreset(name) {
    const p = PRESETS[name];
    if (!p) return;
    setState(clone(p));
  }

  function moveModule(id, delta) {
    const order = [...state.order];
    const i = order.indexOf(id);
    if (i < 0) return;
    const j = i + delta;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    setState({ order });
  }

  function setEditMode(on) {
    editMode = !!on;
    document.documentElement.classList.toggle("layout-edit-mode", editMode);
    refreshDragHandles();
  }

  function refreshDragHandles() {
    if (!mainEl) return;
    mainEl.querySelectorAll("fieldset.module[data-module]").forEach((fs) => {
      fs.draggable = editMode;
    });
  }

  function initDragDrop() {
    if (!mainEl) return;
    let dragId = null;

    mainEl.addEventListener("dragstart", (e) => {
      if (!editMode) return;
      const fs = e.target.closest("fieldset.module[data-module]");
      if (!fs) return;
      dragId = fs.dataset.module;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", dragId);
      fs.classList.add("layout-dragging");
    });

    mainEl.addEventListener("dragend", (e) => {
      const fs = e.target.closest("fieldset.module[data-module]");
      if (fs) fs.classList.remove("layout-dragging");
      dragId = null;
      mainEl.querySelectorAll(".layout-drop-target").forEach((el) => el.classList.remove("layout-drop-target"));
    });

    mainEl.addEventListener("dragover", (e) => {
      if (!editMode || !dragId) return;
      e.preventDefault();
      const fs = e.target.closest("fieldset.module[data-module]");
      mainEl.querySelectorAll(".layout-drop-target").forEach((el) => el.classList.remove("layout-drop-target"));
      if (fs) fs.classList.add("layout-drop-target");
    });

    mainEl.addEventListener("drop", (e) => {
      if (!editMode) return;
      e.preventDefault();
      const target = e.target.closest("fieldset.module[data-module]");
      const fromId = e.dataTransfer.getData("text/plain") || dragId;
      if (!target || !fromId || target.dataset.module === fromId) return;
      const order = [...state.order];
      const from = order.indexOf(fromId);
      const to = order.indexOf(target.dataset.module);
      if (from < 0 || to < 0) return;
      order.splice(from, 1);
      order.splice(to, 0, fromId);
      setState({ order });
      target.classList.remove("layout-drop-target");
    });
  }

  function bindControl(id, key, parser = Number) {
    const el = document.getElementById(id);
    if (!el) return;
    const applyFromEl = () => {
      let v = el.type === "checkbox" ? el.checked : parser(el.value);
      if (key === "autoGap") v = el.checked;
      if (key === "compactHeader") v = el.checked;
      if (key === "columns") v = Number(el.value);
      const patch = { [key]: v };
      setState(patch);
    };
    el.addEventListener("input", applyFromEl);
    el.addEventListener("change", applyFromEl);
  }

  function syncDialogControls() {
    const map = {
      layoutAutoGap: { key: "autoGap", type: "checkbox" },
      layoutModuleGap: { key: "moduleGap" },
      layoutMainGap: { key: "mainGap" },
      layoutColumns: { key: "columns" },
      layoutAppWidth: { key: "appMaxWidth" },
      layoutPadX: { key: "chromeModulePadX" },
      layoutPadB: { key: "chromeModulePadB" },
      layoutLegendSize: { key: "chromeLegendSize", parse: parseFloat },
      layoutToolbarGap: { key: "chromeToolbarGap" },
      layoutRadius: { key: "moduleRadius" },
      layoutSeqStep: { key: "contentSeqStep", parse: parseFloat },
      layoutSeqLabel: { key: "contentSeqLabel", parse: parseFloat },
      layoutArrangeW: { key: "contentArrangeSlotW" },
      layoutArrangeH: { key: "contentArrangeSlotH" },
      layoutMixerW: { key: "contentMixerTrackW", parse: (v) => v },
      layoutCompactHeader: { key: "compactHeader", type: "checkbox" },
    };
    Object.entries(map).forEach(([id, cfg]) => {
      const el = document.getElementById(id);
      if (!el) return;
      const v = state[cfg.key];
      if (cfg.type === "checkbox") el.checked = !!v;
      else el.value = String(v);
      const out = document.getElementById(`${id}Val`);
      if (out && cfg.type !== "checkbox") out.textContent = String(v);
    });
    MODULE_IDS.forEach((id) => {
      const cb = document.getElementById(`layoutVis_${id}`);
      if (cb) cb.checked = state.visible[id] !== false;
    });
    renderOrderList();
  }

  function renderOrderList() {
    const list = document.getElementById("layoutOrderList");
    if (!list) return;
    list.innerHTML = "";
    const labels = { arrange: "编曲", sequencer: "音序", mixer: "混音" };
    state.order.forEach((id, idx) => {
      const li = document.createElement("li");
      li.className = "layout-order-item";
      li.innerHTML = `
        <span class="layout-order-grip" title="拖拽排序">⋮⋮</span>
        <span class="layout-order-name">${labels[id] || id}</span>
        <span class="layout-order-actions">
          <button type="button" class="btn btn-ghost btn-xs" data-move-up="${id}" ${idx === 0 ? "disabled" : ""}>↑</button>
          <button type="button" class="btn btn-ghost btn-xs" data-move-down="${id}" ${idx === state.order.length - 1 ? "disabled" : ""}>↓</button>
        </span>`;
      list.appendChild(li);
    });
    list.querySelectorAll("[data-move-up]").forEach((btn) => {
      btn.addEventListener("click", () => moveModule(btn.dataset.moveUp, -1));
    });
    list.querySelectorAll("[data-move-down]").forEach((btn) => {
      btn.addEventListener("click", () => moveModule(btn.dataset.moveDown, 1));
    });
  }

  function initUI() {
    const dialog = document.getElementById("layoutDialog");
    const btnLayout = document.getElementById("btnLayout");
    const btnClose = document.getElementById("btnLayoutClose");
    const btnReset = document.getElementById("btnLayoutReset");
    const btnEdit = document.getElementById("btnLayoutEdit");
    const preset = document.getElementById("layoutPreset");

    if (btnLayout && dialog) {
      btnLayout.addEventListener("click", () => {
        syncDialogControls();
        dialog.showModal();
      });
    }
    if (btnClose && dialog) btnClose.addEventListener("click", () => dialog.close());
    if (btnReset) {
      btnReset.addEventListener("click", () => {
        if (confirm("恢复默认布局？模块顺序与尺寸将重置。")) {
          setState(clone(DEFAULTS));
          syncDialogControls();
        }
      });
    }
    if (btnEdit) {
      btnEdit.addEventListener("click", () => {
        setEditMode(!editMode);
        btnEdit.textContent = editMode ? "完成拖拽" : "拖拽排序";
        btnEdit.classList.toggle("active", editMode);
        if (editMode && dialog) dialog.close();
        const st = document.getElementById("statusText"); if (st) st.textContent = editMode ? "拖拽模块标题栏可调整顺序" : "布局编辑已结束";
      });
    }
    if (preset) {
      preset.addEventListener("change", () => {
        if (preset.value) applyPreset(preset.value);
        syncDialogControls();
        preset.value = "";
      });
    }

    MODULE_IDS.forEach((id) => {
      const cb = document.getElementById(`layoutVis_${id}`);
      if (cb) {
        cb.addEventListener("change", () => {
          setState({ visible: { ...state.visible, [id]: cb.checked } });
        });
      }
    });

    const sliders = [
      ["layoutModuleGap", "moduleGap"],
      ["layoutMainGap", "mainGap"],
      ["layoutAppWidth", "appMaxWidth"],
      ["layoutPadX", "chromeModulePadX"],
      ["layoutPadB", "chromeModulePadB"],
      ["layoutLegendSize", "chromeLegendSize", parseFloat],
      ["layoutToolbarGap", "chromeToolbarGap"],
      ["layoutRadius", "moduleRadius"],
      ["layoutSeqStep", "contentSeqStep", parseFloat],
      ["layoutSeqLabel", "contentSeqLabel", parseFloat],
      ["layoutArrangeW", "contentArrangeSlotW"],
      ["layoutArrangeH", "contentArrangeSlotH"],
    ];
    sliders.forEach(([id, key, parse]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", () => {
        const v = (parse || Number)(el.value);
        const patch = { [key]: v };
        setState(patch);
        const out = document.getElementById(`${id}Val`);
        if (out) out.textContent = el.value;
      });
    });

    const auto = document.getElementById("layoutAutoGap");
    if (auto) {
      auto.addEventListener("change", () => {
        setState({ autoGap: auto.checked });
        if (typeof window.syncModuleSpacing === "function") window.syncModuleSpacing();
      });
    }

    const cols = document.getElementById("layoutColumns");
    if (cols) {
      cols.addEventListener("change", () => setState({ columns: Number(cols.value) }));
    }

    const compact = document.getElementById("layoutCompactHeader");
    if (compact) {
      compact.addEventListener("change", () => setState({ compactHeader: compact.checked }));
    }

    const mixerW = document.getElementById("layoutMixerW");
    if (mixerW) {
      mixerW.addEventListener("input", () => {
        const v = mixerW.value;
        setState({ contentMixerTrackW: v.includes("rem") ? v : `${v}rem` });
        const out = document.getElementById("layoutMixerWVal");
        if (out) out.textContent = mixerW.value;
      });
    }
  }

  function init(options = {}) {
    mainEl = document.querySelector(".main");
    onChange = options.onChange || null;
    state = normalizeState(options.initial || DEFAULTS);
    initDragDrop();
    initUI();
    apply();
    refreshDragHandles();
  }

  function exportState() {
    return clone(state);
  }

  function importState(raw) {
    state = normalizeState(raw || DEFAULTS);
    apply();
    if (typeof window.syncModuleSpacing === "function") window.syncModuleSpacing();
  }

  function isAutoGap() {
    return !!state.autoGap;
  }

  function getManualGaps() {
    return { moduleGap: state.moduleGap, mainGap: state.mainGap };
  }

  return {
    init,
    apply,
    exportState,
    importState,
    applyPreset,
    setState,
    setEditMode,
    isAutoGap,
    getManualGaps,
    MODULE_IDS,
    PRESETS,
    DEFAULTS,
  };
})();
