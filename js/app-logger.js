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

  function formatAll() {
    if (!entries.length) return "（暂无日志）";
    return entries.map(formatEntry).join("\n");
  }

  return {
    info: (msg, detail) => push("info", msg, detail),
    warn: (msg, detail) => push("warn", msg, detail),
    error: (msg, detail) => push("error", msg, detail),
    formatAll,
    printToConsole() {
      console.group("[HarmonyForge] 应用日志");
      entries.forEach((e) => {
        const line = formatEntry(e);
        if (e.level === "error") console.error(line);
        else if (e.level === "warn") console.warn(line);
        else console.log(line);
      });
      console.groupEnd();
      push("info", "已打印全部日志到控制台");
    },
    clear() {
      entries.length = 0;
      push("info", "日志已清空");
    },
  };
})();
