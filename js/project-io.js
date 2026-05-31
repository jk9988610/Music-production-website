/**
 * 编曲项目文件导入 / 导出（.hfproj JSON · WAV · MP3）
 */
const ProjectIO = (() => {
  const FORMAT_VERSION = 2;
  const FILE_EXT = ".hfproj";
  const ACCEPT = ".hfproj,.json,application/json";

  const EXPORT_FORMATS = [
    { id: "json", label: "JSON 项目 (.hfproj)", ext: FILE_EXT },
    { id: "wav", label: "WAV 音频", ext: ".wav" },
    { id: "mp3", label: "MP3 音频", ext: ".mp3" },
  ];

  function buildBundle(project, extraMeta = {}) {
    const appVer =
      typeof AppVersion !== "undefined" && AppVersion.getInfo
        ? AppVersion.getInfo()
        : { version: "?", build: "?" };
    return {
      harmonyforge: FORMAT_VERSION,
      kind: "project",
      meta: {
        appVersion: appVer.version,
        appBuild: appVer.build,
        exportedAt: new Date().toISOString(),
        ...extraMeta,
      },
      project,
    };
  }

  function extractProject(parsed) {
    if (!parsed || typeof parsed !== "object") {
      throw new Error("文件内容无效");
    }
    if (parsed.harmonyforge != null && parsed.project) {
      const fv = Number(parsed.harmonyforge);
      if (fv > FORMAT_VERSION) {
        throw new Error(`文件格式 v${fv} 较新，请更新应用后再导入`);
      }
      return parsed.project;
    }
    if (parsed.sequencer || parsed.arranger) {
      return parsed;
    }
    throw new Error("不是 HarmonyForge 项目文件");
  }

  function defaultBasename() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `harmonyforge-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  }

  function resolveBasename(options = {}) {
    const raw =
      (options.name && String(options.name).trim()) || defaultBasename();
    return raw.replace(/\.(hfproj|json|wav|mp3)$/i, "");
  }

  function exportJsonToFile(project, options = {}) {
    const base = resolveBasename(options);
    const filename = base.endsWith(FILE_EXT) ? base : `${base}${FILE_EXT}`;
    const bundle = buildBundle(project, { title: options.title || base });
    const json = JSON.stringify(bundle, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    if (typeof FileSave !== "undefined") {
      FileSave.saveBlob(blob, filename);
    } else {
      throw new Error("文件保存模块未加载");
    }
    return { filename, bytes: json.length };
  }

  async function exportProject(project, options = {}) {
    const format = (options.format || "json").toLowerCase();
    const base = resolveBasename(options);

    if (format === "json") {
      return exportJsonToFile(project, options);
    }
    if (format === "wav" || format === "mp3") {
      if (typeof AudioExport === "undefined") {
        throw new Error("音频导出模块未加载");
      }
      return AudioExport.exportAudio(project, format, base);
    }
    throw new Error(`不支持的导出格式：${format}`);
  }

  /** @deprecated 使用 exportProject */
  function exportToFile(project, options = {}) {
    return exportProject(project, { ...options, format: "json" });
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("读取文件失败"));
      reader.readAsText(file, "UTF-8");
    });
  }

  async function importFromFile(file) {
    if (!file) throw new Error("未选择文件");
    const text = await readFileAsText(file);
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("JSON 解析失败，请确认是 .hfproj 或导出的 JSON");
    }
    return extractProject(parsed);
  }

  return {
    FORMAT_VERSION,
    FILE_EXT,
    ACCEPT,
    EXPORT_FORMATS,
    buildBundle,
    extractProject,
    exportProject,
    exportToFile,
    importFromFile,
  };
})();
