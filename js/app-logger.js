/**
 * 应用内日志 — 支持面板展示与控制台打印
 */
const AppLogger = (() => {
  const MAX_ENTRIES = 200;
  const entries = [];

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function timestamp() {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  function push(level, message, detail) {
    const entry = {
      time: timestamp(),
      level,
      message,
      detail: detail != null ? String(detail) : "",
    };
    entries.push(entry);
    if (entries.length > MAX_ENTRIES) entries.shift();

    const tag = `[HarmonyForge/${level}]`;
    if (detail !== undefined && detail !== null && typeof detail === "object") {
      console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](tag, message, detail);
    } else if (detail) {
      console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](tag, message, detail);
    } else {
      console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](tag, message);
    }
    return entry;
  }

  function formatEntry(e) {
    const extra = e.detail ? ` — ${e.detail}` : "";
    return `${e.time} [${e.level.toUpperCase()}] ${e.message}${extra}`;
  }

  function versionLine() {
    if (typeof AppVersion !== "undefined" && AppVersion.getInfo) {
      const v = AppVersion.getInfo();
      return `HarmonyForge v${v.version} · build ${v.build}`;
    }
    return "HarmonyForge (version unknown)";
  }

  function formatAll() {
    const header = `=== ${versionLine()} ===`;
    if (!entries.length) return header + "\n（暂无日志）";
    return header + "\n" + entries.map(formatEntry).join("\n");
  }

  return {
    info: (msg, detail) => push("info", msg, detail),
    warn: (msg, detail) => push("warn", msg, detail),
    error: (msg, detail) => push("error", msg, detail),
    formatAll,
    async copyToClipboard() {
      const text = formatAll();
      const header = versionLine();
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.cssText = "position:fixed;left:-9999px";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        push("info", "日志已复制到剪贴板", header);
        return true;
      } catch (err) {
        push("error", "复制日志失败", err.message);
        return false;
      }
    },
    clear() {
      entries.length = 0;
      push("info", "日志已清空");
    },
  };
})();
