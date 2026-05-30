/**
 * 编曲项目文件导入 / 导出（.hfproj JSON）
 */
const ProjectIO = (() => {
  const FORMAT_VERSION = 2;
  const FILE_EXT = ".hfproj";
  const ACCEPT = ".hfproj,.json,application/json";

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

  function defaultFilename() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
    return `harmonyforge-${stamp}${FILE_EXT}`;
  }

  function exportToFile(project, options = {}) {
    const name =
      (options.name && String(options.name).trim()) ||
      defaultFilename().replace(FILE_EXT, "");
    const filename = name.endsWith(FILE_EXT) ? name : `${name}${FILE_EXT}`;
    const bundle = buildBundle(project, { title: options.title || name });
    const json = JSON.stringify(bundle, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { filename, bytes: json.length };
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
    buildBundle,
    extractProject,
    exportToFile,
    importFromFile,
  };
})();
