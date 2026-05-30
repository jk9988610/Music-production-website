/**
 * 版本管理与在线更新检测
 */
const AppVersion = (() => {
  const CURRENT = "1.3.1";
  const BUILD = "dev";
  const STORAGE_BUILD = "hf-last-build";

  function versionUrl() {
    return `version.json?t=${Date.now()}`;
  }

  async function fetchRemote() {
    const res = await fetch(versionUrl(), {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function compareVersion(a, b) {
    const pa = a.split(".").map(Number);
    const pb = b.split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d !== 0) return d;
    }
    return 0;
  }

  function isNewer(remote) {
    if (!remote || !remote.version) return false;
    if (compareVersion(remote.version, CURRENT) > 0) return true;
    if (remote.version === CURRENT && remote.build && remote.build !== BUILD) return true;
    return false;
  }

  async function checkUpdate() {
    AppLogger.info("开始检查更新…");
    try {
      const remote = await fetchRemote();
      AppLogger.info("远端版本", remote);

      if (isNewer(remote)) {
        AppLogger.warn(`发现新版本 v${remote.version} (build ${remote.build})`);
        return { status: "available", remote };
      }
      AppLogger.info("当前已是最新版本");
      return { status: "latest", remote };
    } catch (err) {
      AppLogger.error("检查更新失败", err.message);
      return { status: "error", message: err.message };
    }
  }

  async function applyUpdate(remote) {
    if (!remote) {
      const result = await checkUpdate();
      if (result.status !== "available") return result;
      remote = result.remote;
    }

    AppLogger.info("正在更新到最新版本…", remote);
    if (remote.build) sessionStorage.setItem(STORAGE_BUILD, remote.build);

    const url = new URL(location.href);
    url.searchParams.set("v", remote.build || remote.version);
    url.searchParams.set("_", String(Date.now()));
    location.replace(url.toString());
    return { status: "reloading" };
  }

  function markLoadedFromRemote(remote) {
    if (remote && remote.build) {
      sessionStorage.setItem(STORAGE_BUILD, remote.build);
    }
  }

  function syncVersionLabels() {
    document.querySelectorAll(".app-version-value").forEach((el) => {
      el.textContent = CURRENT;
    });
  }

  function bindDebugLogButtons() {
    const handler = () => {
      AppLogger.printToConsole();
      const logContent = document.getElementById("logContent");
      const logDialog = document.getElementById("logDialog");
      if (logContent) logContent.textContent = AppLogger.formatAll();
      if (logDialog && !logDialog.open) logDialog.showModal();
    };
    ["btnDebugLog", "btnDebugLogFooter"].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener("click", handler);
    });
  }

  function initUI() {
    syncVersionLabels();

    const btnUpdate = document.getElementById("btnUpdate");
    const btnLogs = document.getElementById("btnLogs");
    const btnPrintLogs = document.getElementById("btnPrintLogs");
    const logDialog = document.getElementById("logDialog");
    const logContent = document.getElementById("logContent");

    bindDebugLogButtons();

    if (btnLogs && logDialog) {
      btnLogs.addEventListener("click", () => {
        if (logContent) logContent.textContent = AppLogger.formatAll();
        logDialog.showModal();
        AppLogger.info("打开日志面板", `v${CURRENT}`);
      });
    }

    if (btnPrintLogs) {
      btnPrintLogs.addEventListener("click", () => {
        AppLogger.printToConsole();
        if (logContent) logContent.textContent = AppLogger.formatAll();
      });
    }

    const btnLogClose = document.getElementById("btnLogClose");
    const btnClearLogs = document.getElementById("btnClearLogs");
    if (btnLogClose && logDialog) {
      btnLogClose.addEventListener("click", () => logDialog.close());
    }
    if (btnClearLogs) {
      btnClearLogs.addEventListener("click", () => {
        AppLogger.clear();
        if (logContent) logContent.textContent = AppLogger.formatAll();
      });
    }

    if (btnUpdate) {
      btnUpdate.addEventListener("click", async () => {
        btnUpdate.disabled = true;
        const prev = btnUpdate.textContent;
        btnUpdate.textContent = "检测中…";
        try {
          const result = await checkUpdate();
          if (result.status === "available") {
            btnUpdate.textContent = "更新中…";
            const ok = confirm(
              `发现新版本 v${result.remote.version}\n` +
              `当前 v${CURRENT}\n\n是否立即更新？`
            );
            if (ok) await applyUpdate(result.remote);
            else btnUpdate.textContent = prev;
          } else if (result.status === "latest") {
            alert(`已是最新版本 v${CURRENT}`);
            btnUpdate.textContent = prev;
          } else {
            alert(`检查更新失败：${result.message || "未知错误"}`);
            btnUpdate.textContent = prev;
          }
        } finally {
          btnUpdate.disabled = false;
          if (btnUpdate.textContent === "检测中…" || btnUpdate.textContent === "更新中…") {
            btnUpdate.textContent = prev;
          }
        }
      });
    }

    fetchRemote()
      .then((remote) => {
        markLoadedFromRemote(remote);
        if (isNewer(remote) && document.getElementById("statusText")) {
          document.getElementById("statusText").textContent =
            `有新版本 v${remote.version} 可用 — 点击「检查更新」`;
        }
      })
      .catch(() => {});
  }

  function getInfo() {
    return { version: CURRENT, build: BUILD };
  }

  return {
    CURRENT,
    BUILD,
    getInfo,
    checkUpdate,
    applyUpdate,
    initUI,
    syncVersionLabels,
  };
})();
