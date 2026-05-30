/**
 * 模块布局 — 顺序、可见性、间距与内容尺寸，随项目草稿保存
 */
const LayoutManager = (() => {
  const MODULE_IDS = ["arrange", "sequencer", "mixer"];

  const DEFAULTS = {
    order: ["mixer", "sequencer", "arrange"],
    visible: { arrange: true, sequencer: true, mixer: true },
    autoGap: false,
    moduleGap: 0,
    mainGap: 11,
    columns: 1,
    appMaxWidth: 960,
    chromeModulePadX: 16,
    chromeModulePadB: 12,
    chromeLegendSize: 0.9,
    chromeToolbarGap: 8,
    moduleRadius: 12,
    contentSeqStep: 1.3,
    contentSeqLabel: 3.75,
    contentArrangeSlotW: 51,
    contentArrangeSlotH: 38,
    contentMixerTrackW: "3rem",
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
    if (typeof s.contentMixerTrackW === "number") {
      s.contentMixerTrackW = `${s.contentMixerTrackW}rem`;
    } else if (typeof s.contentMixerTrackW === "string") {
      const n = parseFloat(s.contentMixerTrackW);
      if (Number.isFinite(n) && !s.contentMixerTrackW.includes("rem")) {
        s.contentMixerTrackW = `${n}rem`;
      }
    }
    s.appMaxWidth = clamp(Number(s.appMaxWidth) || DEFAULTS.appMaxWidth, 640, 1400);
    s.moduleGap = clamp(Number(s.moduleGap) ?? DEFAULTS.moduleGap, 0, 48);
    s.mainGap = clamp(Number(s.mainGap) ?? DEFAULTS.mainGap, 0, 48);
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
    /* 模块间距仅由 .main 的 gap（mainGap）控制；moduleGap 保留兼容，默认 0 */
    r.style.setProperty("--chrome-module-gap", `${state.moduleGap}px`);
    r.style.setProperty("--main-module-gap", `${state.mainGap}px`);
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
    if (typeof window.syncModuleSpacing === "function") window.syncModuleSpacing();
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
      let v = state[cfg.key];
      if (cfg.key === "contentMixerTrackW" && typeof v === "string") {
        v = v.replace(/rem$/, "");
      }
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

  const MODULE_LABELS = { arrange: "编曲", sequencer: "音序", mixer: "混音" };

  const CSS_VAR_KEYS = [
    "--chrome-module-gap",
    "--main-module-gap",
    "--chrome-module-pad-x",
    "--chrome-module-pad-b",
    "--chrome-legend-size",
    "--chrome-toolbar-gap",
    "--content-seq-step",
    "--content-seq-label",
    "--content-arrange-slot-w",
    "--content-arrange-slot-h",
    "--content-mixer-track-w",
    "--layout-app-max-width",
    "--layout-module-radius",
  ];


  function formatLayoutCssBlock(s) {
    const gapNote = s.autoGap ? "/* 间距自适应开启，运行时由视口计算 */" : `${s.moduleGap}px`;
    const mainGap = s.autoGap ? "/* auto */" : `${s.mainGap}px`;
    const mixerW =
      typeof s.contentMixerTrackW === "string"
        ? s.contentMixerTrackW
        : `${s.contentMixerTrackW}rem`;
    return [
      ":root {",
      s.autoGap ? "  /* --chrome-module-gap: 自适应 */" : `  --chrome-module-gap: ${s.moduleGap}px;`,
      s.autoGap ? "  /* --main-module-gap: 自适应 */" : `  --main-module-gap: ${s.mainGap}px;`,
      `  --chrome-module-pad-x: ${s.chromeModulePadX}px;`,
      `  --chrome-module-pad-b: ${s.chromeModulePadB}px;`,
      `  --chrome-legend-size: ${s.chromeLegendSize}rem;`,
      `  --chrome-toolbar-gap: ${s.chromeToolbarGap}px;`,
      `  --content-seq-step: ${s.contentSeqStep}rem;`,
      `  --content-seq-label: ${s.contentSeqLabel}rem;`,
      `  --content-arrange-slot-w: ${s.contentArrangeSlotW}px;`,
      `  --content-arrange-slot-h: ${s.contentArrangeSlotH}px;`,
      `  --content-mixer-track-w: ${mixerW};`,
      `  --layout-app-max-width: ${s.appMaxWidth}px;`,
      `  --layout-module-radius: ${s.moduleRadius}px;`,
      "}",
      "",
      "/* html 属性（由 LayoutManager 自动设置，参考用） */",
      `/* data-layout-columns="${s.columns}" data-layout-compact-header="${s.compactHeader ? "1" : "0"}" data-layout-auto-gap="${s.autoGap ? "1" : "0"}" */`,
    ].join("\n");
  }

  /** 可粘贴的布局代码：JSON + 控制台恢复 + CSS */
  function formatLayoutCode() {
    const s = exportState();
    const layoutJson = JSON.stringify(s, null, 2);
    const projectSnippet = JSON.stringify({ layout: s }, null, 2);
    return [
      "// HarmonyForge 布局代码 — 复制后可用于存盘或恢复",
      "",
      "// --- 1. 项目文件中的 layout 字段（与「存/读」一致）---",
      projectSnippet,
      "",
      "// --- 2. 浏览器控制台立即应用 ---",
      `LayoutManager.importState(${layoutJson});`,
      "",
      "// --- 3. CSS 变量参考（可粘贴到自定义样式 :root）---",
      formatLayoutCssBlock(s),
      "",
    ].join("\n");
  }

  function formatLayoutReport() {
    const lines = [];
    const ver =
      typeof AppVersion !== "undefined" && AppVersion.getInfo
        ? `v${AppVersion.getInfo().version} · build ${AppVersion.getInfo().build}`
        : "unknown";
    lines.push("=== HarmonyForge 模块布局报告 ===");
    lines.push(ver);
    lines.push(`时间 ${new Date().toLocaleString("zh-CN")}`);
    lines.push("");

    lines.push("【模块顺序与可见性】");
    state.order.forEach((id, i) => {
      const on = state.visible[id] !== false;
      lines.push(`${i + 1}. ${MODULE_LABELS[id] || id} (${id}) · ${on ? "显示" : "隐藏"}`);
    });
    lines.push("");

    lines.push("【布局参数】");
    lines.push(`间距自适应: ${state.autoGap ? "是" : "否"}`);
    lines.push(`模块间距: ${state.moduleGap}px · 主区域行距: ${state.mainGap}px`);
    lines.push(`分栏: ${state.columns} · 页面最大宽度: ${state.appMaxWidth}px`);
    lines.push(`紧凑顶栏: ${state.compactHeader ? "是" : "否"}`);
    lines.push(
      `外壳 padding: ${state.chromeModulePadX}/${state.chromeModulePadB}px · 标题: ${state.chromeLegendSize}rem · 工具条间距: ${state.chromeToolbarGap}px · 圆角: ${state.moduleRadius}px`
    );
    lines.push(
      `音序格: ${state.contentSeqStep}rem · 轨名: ${state.contentSeqLabel}rem · 编曲格: ${state.contentArrangeSlotW}×${state.contentArrangeSlotH}px · 混音轨: ${state.contentMixerTrackW}`
    );
    lines.push("");

    lines.push("【已应用 CSS 变量】");
    const rootStyle = getComputedStyle(document.documentElement);
    CSS_VAR_KEYS.forEach((key) => {
      const val = rootStyle.getPropertyValue(key).trim();
      if (val) lines.push(`${key}: ${val}`);
    });
    lines.push(`data-layout-columns: ${document.documentElement.dataset.layoutColumns || "1"}`);
    lines.push(`data-layout-auto-gap: ${document.documentElement.dataset.layoutAutoGap || "0"}`);
    lines.push("");

    lines.push("【DOM 实测尺寸】");
    if (mainEl) {
      const mr = mainEl.getBoundingClientRect();
      lines.push(`main: ${Math.round(mr.width)}×${Math.round(mr.height)}px`);
    }
    const app = document.querySelector(".app");
    if (app) {
      const ar = app.getBoundingClientRect();
      lines.push(`app: ${Math.round(ar.width)}×${Math.round(ar.height)}px · viewport ${window.innerWidth}×${window.innerHeight}`);
    }
    (mainEl || document).querySelectorAll("fieldset.module[data-module]").forEach((fs) => {
      const id = fs.dataset.module;
      const r = fs.getBoundingClientRect();
      const body = fs.querySelector(".module-body");
      const chrome = fs.querySelector(".module-chrome");
      const br = body?.getBoundingClientRect();
      const cr = chrome?.getBoundingClientRect();
      lines.push(
        `[${MODULE_LABELS[id] || id}] fieldset ${Math.round(r.width)}×${Math.round(r.height)}px` +
          ` · body ${body ? Math.round(br.width) + "×" + Math.round(br.height) : "—"}` +
          ` · 工具条 ${chrome ? Math.round(cr.height) : 0}px` +
          ` · ${fs.hidden ? "隐藏" : "显示"}`
      );
    });
    lines.push("");

    lines.push("【布局 JSON（可存入项目）】");
    lines.push(JSON.stringify(exportState(), null, 2));

    return lines.join("\n");
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;left:-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }

  function printLayout() {
    const report = formatLayoutReport();
    const code = formatLayoutCode();
    console.log(report);
    console.log("\n--- 布局代码 ---\n", code);
    if (typeof AppLogger !== "undefined") {
      AppLogger.info("模块布局报告", "已输出；布局代码见弹窗文本框");
    }
    const panel = document.getElementById("layoutPrintPanel");
    const codeEl = document.getElementById("layoutCodeOutput");
    const pre = document.getElementById("layoutPrintOutput");
    if (panel) panel.hidden = false;
    if (codeEl) codeEl.value = code;
    if (pre) pre.textContent = report;
    const st = document.getElementById("statusText");
    if (st) st.textContent = "已生成布局代码，可点「复制布局代码」或全选下方文本框";
    return { report, code };
  }

  async function copyLayoutCode() {
    const code = formatLayoutCode();
    const codeEl = document.getElementById("layoutCodeOutput");
    if (codeEl && !codeEl.value) codeEl.value = code;
    try {
      await copyText(code);
      if (typeof AppLogger !== "undefined") AppLogger.info("布局代码已复制到剪贴板");
      const st = document.getElementById("statusText");
      if (st) st.textContent = "布局代码已复制，可粘贴到项目或控制台";
      return true;
    } catch (err) {
      if (typeof AppLogger !== "undefined") AppLogger.error("复制布局代码失败", err.message);
      return false;
    }
  }

  async function copyLayoutReport() {
    const report = formatLayoutReport();
    try {
      await copyText(report);
      if (typeof AppLogger !== "undefined") AppLogger.info("布局报告已复制到剪贴板");
      const st = document.getElementById("statusText");
      if (st) st.textContent = "布局报告已复制";
      return true;
    } catch (err) {
      if (typeof AppLogger !== "undefined") AppLogger.error("复制布局失败", err.message);
      return false;
    }
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

    const btnPrint = document.getElementById("btnLayoutPrint");
    const btnCopy = document.getElementById("btnLayoutCopy");
    const btnCopyCode = document.getElementById("btnLayoutCopyCode");
    const btnSelectCode = document.getElementById("btnLayoutSelectCode");
    const codeEl = document.getElementById("layoutCodeOutput");

    if (btnPrint) {
      btnPrint.addEventListener("click", () => {
        printLayout();
        btnPrint.classList.add("active-flash");
        setTimeout(() => btnPrint.classList.remove("active-flash"), 1200);
      });
    }
    if (btnCopyCode) {
      btnCopyCode.addEventListener("click", async () => {
        const panel = document.getElementById("layoutPrintPanel");
        if (panel?.hidden) printLayout();
        await copyLayoutCode();
        btnCopyCode.classList.add("active-flash");
        setTimeout(() => btnCopyCode.classList.remove("active-flash"), 1200);
      });
    }
    if (btnCopy) {
      btnCopy.addEventListener("click", async () => {
        const panel = document.getElementById("layoutPrintPanel");
        if (panel?.hidden) printLayout();
        await copyLayoutReport();
        btnCopy.classList.add("active-flash");
        setTimeout(() => btnCopy.classList.remove("active-flash"), 1200);
      });
    }
    if (btnSelectCode && codeEl) {
      btnSelectCode.addEventListener("click", () => {
        if (!codeEl.value) printLayout();
        codeEl.focus();
        codeEl.select();
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

  function getSpacingConfig() {
    return {
      autoGap: !!state.autoGap,
      moduleGap: state.moduleGap,
      mainGap: state.mainGap,
    };
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
    getSpacingConfig,
    getManualGaps,
    formatLayoutReport,
    formatLayoutCode,
    printLayout,
    copyLayoutCode,
    copyLayoutReport,
    MODULE_IDS,
    PRESETS,
    DEFAULTS,
  };
})();
