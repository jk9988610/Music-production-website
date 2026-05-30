/**
 * 版本管理与在线更新检测
 * 运行版本以 version.json 为准（避免 JS 文件被缓存后版本号不更新）
 */
const AppVersion = (() => {
  let activeVersion = "1.4.1";
  let activeBuild = "dev";
  const STORAGE_BUILD = "hf-last-build";
  const STORAGE_VERSION = "hf-last-version";

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
    const pa = String(a).split(".").map(Number);
    const pb = String(b).split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      const d = (pa[i] || 0) - (pb[i] || 0);
      if (d !== 0) return d;
    }
    return 0;
  }

  function getLocalBuild() {
    return sessionStorage.getItem(STORAGE_BUILD) || activeBuild;
  }

  function getLocalVersion() {
    return sessionStorage.getItem(STORAGE_VERSION) || activeVersion;
  }

  function applyManifest(manifest) {
    if (!manifest) return;
    if (manifest.version) activeVersion = manifest.version;
    if (manifest.build) activeBuild = manifest.build;
    sessionStorage.setItem(STORAGE_VERSION, activeVersion);
    sessionStorage.setItem(STORAGE_BUILD, activeBuild);
    syncVersionLabels();
  }

  function isNewer(remote) {
    if (!remote || !remote.version) return false;
    const localVer = getLocalVersion();
    const localBuild = getLocalBuild();
    if (compareVersion(remote.version, localVer) > 0) return true;
    if (remote.version === localVer && remote.build && remote.build !== localBuild) {
      return true;
    }
    return false;
  }

  async function hydrateFromManifest() {
    try {
      const remote = await fetchRemote();
      applyManifest(remote);
      return remote;
    } catch (err) {
      AppLogger.warn("无法读取 version.json", err.message);
      return null;
    }
  }

  async function checkUpdate() {
    AppLogger.info("开始检查更新…");
    try {
      const remote = await fetchRemote();
      AppLogger.info("远端版本", `${remote.version} · build ${remote.build}`);
      AppLogger.info("本地记录", `v${getLocalVersion()} · build ${getLocalBuild()}`);

      if (isNewer(remote)) {
        AppLogger.warn(`发现新版本 v${remote.version} (build ${remote.build})`);
        return { status: "available", remote };
      }
      AppLogger.info("当前已是最新版本", `v${getLocalVersion()}`);
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

    AppLogger.info("正在更新到最新版本…", `${remote.version} · ${remote.build}`);
    sessionStorage.setItem(STORAGE_VERSION, remote.version);
    sessionStorage.setItem(STORAGE_BUILD, remote.build);

    if (typeof caches !== "undefined") {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch {
        /* ignore */
      }
    }

    const url = new URL(location.href);
    url.searchParams.set("v", remote.build || remote.version);
    url.searchParams.set("_", String(Date.now()));
    location.replace(url.toString());
    return { status: "reloading" };
  }

  function syncVersionLabels() {
    document.querySelectorAll(".app-version-value").forEach((el) => {
      el.textContent = activeVersion;
    });
  }

  function initUI() {
    const btnUpdate = document.getElementById("btnUpdate");
    const btnLogs = document.getElementById("btnLogs");
    const btnCopyLogs = document.getElementById("btnCopyLogs");
    const logDialog = document.getElementById("logDialog");
    const logContent = document.getElementById("logContent");

    hydrateFromManifest().then((remote) => {
      if (remote) {
        AppLogger.info("运行版本", `v${activeVersion} · build ${activeBuild}`);
        const urlBuild = new URLSearchParams(location.search).get("v");
        if (urlBuild && urlBuild !== activeBuild) {
          AppLogger.warn(
            "页面资源可能未完全刷新",
            `建议 Ctrl+F5；线上 build=${activeBuild}`
          );
        }
        if (isNewer(remote) && document.getElementById("statusText")) {
          document.getElementById("statusText").textContent =
            `有新版本 v${remote.version} 可用 — 点击「更新」`;
        }
      }
    });

    if (btnLogs && logDialog) {
      btnLogs.addEventListener("click", () => {
        if (logContent) logContent.textContent = AppLogger.formatAll();
        logDialog.showModal();
        AppLogger.info("打开日志面板", `v${activeVersion}`);
      });
    }

    if (btnCopyLogs) {
      btnCopyLogs.addEventListener("click", async () => {
        const ok = await AppLogger.copyToClipboard();
        if (logContent) logContent.textContent = AppLogger.formatAll();
        if (ok && logDialog) {
          const prev = btnCopyLogs.textContent;
          btnCopyLogs.textContent = "已复制";
          setTimeout(() => {
            btnCopyLogs.textContent = prev;
          }, 1500);
        }
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
              `发现新版本 v${result.remote.version} (build ${result.remote.build})\n` +
                `当前 v${getLocalVersion()} (build ${getLocalBuild()})\n\n是否立即更新？`
            );
            if (ok) await applyUpdate(result.remote);
            else btnUpdate.textContent = prev;
          } else if (result.status === "latest") {
            alert(`已是最新版本 v${getLocalVersion()}`);
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
  }

  function getInfo() {
    return { version: activeVersion, build: activeBuild };
  }

  return {
    get CURRENT() {
      return activeVersion;
    },
    get BUILD() {
      return activeBuild;
    },
    getInfo,
    checkUpdate,
    applyUpdate,
    initUI,
    syncVersionLabels,
    hydrateFromManifest,
  };
})();
