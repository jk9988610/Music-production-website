/**
 * 版本管理与在线更新检测
 * 以页面内嵌的 BUNDLED_* 为「当前运行版本」；与远端 version.json 比较决定是否可更新
 */
const AppVersion = (() => {
  let BUNDLED_VERSION = "2.2.0";
  let BUNDLED_BUILD = "dev";

  (function applyMetaBundled() {
    const mv = document.querySelector('meta[name="hf-app-version"]')?.content;
    const mb = document.querySelector('meta[name="hf-app-build"]')?.content;
    if (mv && mv !== "dev") BUNDLED_VERSION = mv;
    if (mb && mb !== "dev") BUNDLED_BUILD = mb;
  })();

  const scriptEl = document.currentScript;
  if (scriptEl?.src) {
    const m = scriptEl.src.match(/[?&]v=([^&]+)/);
    if (m) BUNDLED_BUILD = decodeURIComponent(m[1]);
  }

  let remoteVersion = null;
  let remoteBuild = null;

  function versionUrl() {
    return `version.json?t=${Date.now()}`;
  }

  async function fetchRemote() {
    const res = await fetch(versionUrl(), {
      cache: "no-store",
      headers: { Accept: "application/json", Pragma: "no-cache" },
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

  function getBundled() {
    return { version: BUNDLED_VERSION, build: BUNDLED_BUILD };
  }

  function isNewer(remote) {
    if (!remote?.version) return false;
    const { version: localVer, build: localBuild } = getBundled();
    if (compareVersion(remote.version, localVer) > 0) return true;
    if (remote.version === localVer && remote.build && remote.build !== localBuild) {
      return true;
    }
    return false;
  }

  function syncVersionLabels() {
    document.querySelectorAll(".app-version-value").forEach((el) => {
      el.textContent = BUNDLED_VERSION;
    });
    const buildShort =
      BUNDLED_BUILD && BUNDLED_BUILD !== "dev"
        ? ` · ${String(BUNDLED_BUILD).slice(-8)}`
        : "";
    document.querySelectorAll(".app-build-value").forEach((el) => {
      el.textContent = buildShort;
    });
    const home = document.querySelector(".home-version");
    if (!home) return;
    const hasUpdate =
      remoteVersion &&
      isNewer({ version: remoteVersion, build: remoteBuild });
    home.classList.toggle("has-update", !!hasUpdate);
    home.title = hasUpdate
      ? `运行 v${BUNDLED_VERSION} (build ${BUNDLED_BUILD}) · 可更新至 v${remoteVersion}`
      : `当前 v${BUNDLED_VERSION} · build ${BUNDLED_BUILD}`;
  }

  function noteRemote(remote) {
    if (!remote) return;
    remoteVersion = remote.version ?? remoteVersion;
    remoteBuild = remote.build ?? remoteBuild;
    syncVersionLabels();
  }

  async function hydrateFromManifest() {
    try {
      const remote = await fetchRemote();
      noteRemote(remote);
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
      noteRemote(remote);
      const bundled = getBundled();
      AppLogger.info("远端版本", `${remote.version} · build ${remote.build}`);
      AppLogger.info("当前运行", `v${bundled.version} · build ${bundled.build}`);

      if (isNewer(remote)) {
        AppLogger.warn(`发现新版本 v${remote.version} (build ${remote.build})`);
        return { status: "available", remote, bundled };
      }
      AppLogger.info("当前已是最新版本", `v${bundled.version}`);
      return { status: "latest", remote, bundled };
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

  function initUI() {
    syncVersionLabels();

    const btnUpdate = document.getElementById("btnUpdate");
    const btnLogs = document.getElementById("btnLogs");
    const btnCopyLogs = document.getElementById("btnCopyLogs");
    const logDialog = document.getElementById("logDialog");
    const logContent = document.getElementById("logContent");

    hydrateFromManifest().then((remote) => {
      const bundled = getBundled();
      if (remote) {
        AppLogger.info("运行版本", `v${bundled.version} · build ${bundled.build}`);
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
        AppLogger.info("打开日志面板", `v${BUNDLED_VERSION}`);
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
          const bundled = result.bundled || getBundled();
          if (result.status === "available") {
            btnUpdate.textContent = "更新中…";
            const ok = confirm(
              `发现新版本 v${result.remote.version} (build ${result.remote.build})\n` +
                `当前运行 v${bundled.version} (build ${bundled.build})\n\n是否立即更新？`
            );
            if (ok) await applyUpdate(result.remote);
            else btnUpdate.textContent = prev;
          } else if (result.status === "latest") {
            alert(
              `已是最新版本\n运行 v${bundled.version} (build ${bundled.build})\n` +
                `线上 v${result.remote?.version ?? bundled.version} (build ${result.remote?.build ?? bundled.build})`
            );
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
    return {
      version: BUNDLED_VERSION,
      build: BUNDLED_BUILD,
      remoteVersion,
      remoteBuild,
    };
  }

  return {
    get CURRENT() {
      return BUNDLED_VERSION;
    },
    get BUILD() {
      return BUNDLED_BUILD;
    },
    getInfo,
    checkUpdate,
    applyUpdate,
    initUI,
    syncVersionLabels,
    hydrateFromManifest,
    getBundled,
    isNewer,
  };
})();
