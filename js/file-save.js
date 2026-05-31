/**
 * 文件保存 — 优先 File System Access API，回退 <a download>
 * 音频导出需在用户手势有效期内先弹出保存位置，再异步写入。
 */
const FileSave = (() => {
  function extOf(filename) {
    const i = filename.lastIndexOf(".");
    return i >= 0 ? filename.slice(i) : "";
  }

  function downloadAnchor(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    window.setTimeout(() => {
      a.remove();
      URL.revokeObjectURL(url);
    }, 60_000);
  }

  /**
   * 在用户点击后尽快调用（渲染/编码之前），预留保存目标。
   * @returns {Promise<{ type: 'handle', handle: FileSystemFileHandle, filename: string } | { type: 'anchor', filename: string }>}
   */
  async function prepareTarget(filename, mimeType) {
    const ext = extOf(filename);
    if (typeof window.showSaveFilePicker === "function") {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [
            {
              description: mimeType?.startsWith("audio/") ? "音频" : "文件",
              accept: { [mimeType || "application/octet-stream"]: ext ? [ext] : [] },
            },
          ],
        });
        return { type: "handle", handle, filename };
      } catch (err) {
        if (err?.name === "AbortError") throw new Error("已取消保存");
      }
    }
    return { type: "anchor", filename };
  }

  function createManualDownloadLink(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.textContent = `点击下载 ${filename}`;
    a.className = "btn btn-sm export-manual-download";
    a.addEventListener("click", () => {
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    });
    return a;
  }

  /**
   * @returns {Promise<{ saved: boolean, manualLink?: HTMLAnchorElement }>}
   */
  async function writeTarget(target, blob) {
    if (!target) throw new Error("无效的保存目标");
    if (target.type === "handle") {
      const writable = await target.handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { saved: true };
    }
    downloadAnchor(blob, target.filename);
    return {
      saved: true,
      manualLink: createManualDownloadLink(blob, target.filename),
    };
  }

  /** 同步小文件（JSON）直接下载 */
  function saveBlob(blob, filename) {
    downloadAnchor(blob, filename);
  }

  return { prepareTarget, writeTarget, saveBlob, downloadAnchor };
})();
