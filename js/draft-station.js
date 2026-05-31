/**
 * 草稿站 — 本地多份编曲草稿（localStorage）
 */
const DraftStation = (() => {
  const LS_KEY = "harmonyforge-draft-station";
  const MAX_DRAFTS = 40;

  function readStore() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.drafts)) return parsed;
      }
    } catch {
      /* ignore */
    }
    return { drafts: [] };
  }

  function writeStore(store) {
    localStorage.setItem(LS_KEY, JSON.stringify(store));
  }

  function formatNow() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function isProjectMostlyEmpty(project) {
    if (!project?.sequencer?.patterns?.length) return true;
    const patterns = project.sequencer.patterns;
    for (const pattern of patterns) {
      if (!pattern || typeof pattern !== "object") continue;
      for (const trackId of Object.keys(pattern)) {
        const row = pattern[trackId];
        if (!Array.isArray(row)) continue;
        for (const cell of row) {
          if (cell?.on) return false;
        }
      }
    }
    const sections = project.arranger?.sections;
    if (Array.isArray(sections) && sections.length > 0) return false;
    return true;
  }

  function listDrafts() {
    return readStore()
      .drafts.slice()
      .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  }

  function saveDraft(name, project, meta = {}) {
    if (!project) throw new Error("无法保存空工程");
    const store = readStore();
    const entry = {
      id: crypto.randomUUID(),
      name: String(name || `草稿 ${formatNow()}`).trim().slice(0, 120),
      savedAt: Date.now(),
      project,
      meta: meta || {},
    };
    store.drafts.unshift(entry);
    if (store.drafts.length > MAX_DRAFTS) {
      store.drafts = store.drafts.slice(0, MAX_DRAFTS);
    }
    writeStore(store);
    return entry;
  }

  function deleteDraft(id) {
    const store = readStore();
    const next = store.drafts.filter((d) => d.id !== id);
    if (next.length === store.drafts.length) return false;
    store.drafts = next;
    writeStore(store);
    return true;
  }

  function getDraft(id) {
    return readStore().drafts.find((d) => d.id === id) || null;
  }

  /**
   * 加载他人作品前，将当前编辑器内容存入草稿站
   * @returns {object|null} 新建的草稿条目
   */
  function archiveBeforeLoad(getProjectData, reason = "切换前自动保存") {
    if (typeof getProjectData !== "function") return null;
    let project;
    try {
      project = getProjectData();
    } catch {
      return null;
    }
    if (isProjectMostlyEmpty(project)) return null;
    const name = `${reason} · ${formatNow()}`;
    return saveDraft(name, project, { auto: true, reason });
  }

  function initUI({ getProjectData, onLoadDraft, setStatus }) {
    const btn = document.getElementById("btnDraftStation");
    const dialog = document.getElementById("draftStationDialog");
    const listEl = document.getElementById("draftStationList");
    const btnSaveCurrent = document.getElementById("btnDraftStationSaveCurrent");
    const btnClose = document.getElementById("btnDraftStationClose");

    if (!btn || !dialog || !listEl) return;

    function render() {
      const drafts = listDrafts();
      listEl.innerHTML = "";
      if (!drafts.length) {
        const li = document.createElement("li");
        li.className = "publish-store-empty";
        li.textContent = "草稿站为空。加载他人作品时会自动保存当前编曲。";
        listEl.appendChild(li);
        return;
      }
      drafts.forEach((draft) => {
        const li = document.createElement("li");
        li.className = "publish-store-item";

        const head = document.createElement("div");
        head.className = "publish-store-item-head";
        const title = document.createElement("div");
        title.className = "publish-store-item-title";
        title.textContent = draft.name;
        const time = document.createElement("div");
        time.className = "publish-store-item-meta";
        time.textContent = new Date(draft.savedAt).toLocaleString("zh-CN", {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
        head.append(title, time);

        const tag = document.createElement("div");
        tag.className = "publish-store-item-author";
        tag.textContent = draft.meta?.auto ? "自动归档" : "手动保存";

        const actions = document.createElement("div");
        actions.className = "publish-store-item-actions";

        const btnLoad = document.createElement("button");
        btnLoad.type = "button";
        btnLoad.className = "btn btn-xs";
        btnLoad.textContent = "加载";
        btnLoad.addEventListener("click", () => {
          if (typeof onLoadDraft !== "function") return;
          const ok = onLoadDraft(draft.project, {
            draftId: draft.id,
            name: draft.name,
            fromDraftStation: true,
          });
          if (ok !== false) dialog.close();
        });

        const btnDel = document.createElement("button");
        btnDel.type = "button";
        btnDel.className = "btn btn-xs btn-ghost";
        btnDel.textContent = "删除";
        btnDel.addEventListener("click", () => {
          if (!confirm(`删除草稿「${draft.name}」？`)) return;
          deleteDraft(draft.id);
          render();
          setStatus?.("已删除草稿");
        });

        actions.append(btnLoad, btnDel);
        li.append(head, tag, actions);
        listEl.appendChild(li);
      });
    }

    btn.addEventListener("click", () => {
      dialog.showModal();
      render();
    });

    btnSaveCurrent?.addEventListener("click", () => {
      try {
        const name = prompt("草稿名称", `草稿 ${formatNow()}`);
        if (name == null) return;
        const entry = saveDraft(name, getProjectData(), { auto: false });
        render();
        setStatus?.(`已存入草稿站：${entry.name}`);
        AppLogger?.info("草稿站", entry.name);
      } catch (err) {
        alert(err.message);
      }
    });

    btnClose?.addEventListener("click", () => dialog.close());
  }

  return {
    listDrafts,
    saveDraft,
    deleteDraft,
    getDraft,
    archiveBeforeLoad,
    isProjectMostlyEmpty,
    initUI,
  };
})();
