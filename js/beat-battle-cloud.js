/**
 * HarmonyForge ↔ Beat Battle 云发布与会话（与评阅站同域 localStorage）
 */
const BeatBattleCloud = (() => {
  const BEAT_BATTLE_URL = "https://jk9988610.github.io/Beat-Battle/";
  const LS_SESSION = "beat-battle-cloud-session";
  const LS_CLOUD_CONFIG = "beat-battle-cloud-config";

  const DEFAULT_CLOUD_CONFIG = {
    url: "https://yjqkotqmglxjhlrhynsu.supabase.co",
    anonKey:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlqcWtvdHFtZ2x4amhscmh5bnN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxOTMzNDQsImV4cCI6MjA5NTc2OTM0NH0.Cm4WjiR4NXS4RrA15frLVMZPbGUyGyjaIYQXSRua8Ew",
  };

  let client = null;
  let cachedUser = null;

  function getCloudConfig() {
    try {
      const raw = localStorage.getItem(LS_CLOUD_CONFIG);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.url && parsed?.anonKey) return parsed;
      }
    } catch {
      /* ignore */
    }
    if (DEFAULT_CLOUD_CONFIG.url && DEFAULT_CLOUD_CONFIG.anonKey) {
      return { ...DEFAULT_CLOUD_CONFIG };
    }
    return { url: "", anonKey: "" };
  }

  function isCloudEnabled() {
    const c = getCloudConfig();
    return Boolean(c.url && c.anonKey);
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(LS_SESSION);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.userId && parsed?.userName) return parsed;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  function saveSession({ userId, userName }) {
    if (!userId || !userName) return;
    localStorage.setItem(
      LS_SESSION,
      JSON.stringify({ userId, userName, savedAt: Date.now() })
    );
    localStorage.setItem("beat-battle-current-user-id", userId);
  }

  async function loadSupabase() {
    const { createClient } = await import(
      "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm"
    );
    return createClient;
  }

  async function ensureClient() {
    if (!isCloudEnabled()) {
      throw new Error("云同步未配置，请先在评阅站完成云同步设置");
    }
    if (!client) {
      const createClient = await loadSupabase();
      const { url, anonKey } = getCloudConfig();
      client = createClient(url, anonKey);
    }
    return client;
  }

  async function findOrCreateUser(name) {
    const sb = await ensureClient();
    const trimmed = name.trim();
    const { data: existing } = await sb.from("users").select("*").eq("name", trimmed).maybeSingle();
    if (existing) return existing;
    const { data, error } = await sb.from("users").insert({ name: trimmed }).select().single();
    if (error) throw error;
    return data;
  }

  async function ensureUser(userName) {
    const session = loadSession();
    if (session?.userId && session?.userName) {
      if (!userName || session.userName === userName.trim()) {
        cachedUser = { id: session.userId, name: session.userName };
        return cachedUser;
      }
    }
    const name = (userName || session?.userName || "").trim();
    if (!name) throw new Error("请先在评阅站加入赛季，或填写参赛者昵称");
    const user = await findOrCreateUser(name);
    saveSession({ userId: user.id, userName: user.name });
    cachedUser = { id: user.id, name: user.name };
    return cachedUser;
  }

  const MAX_PROJECT_JSON_BYTES = 2 * 1024 * 1024;

  async function uploadAudioToCloud(path, blob) {
    const sb = await ensureClient();
    const { error } = await sb.storage.from("audio").upload(path, blob, {
      upsert: true,
      contentType: blob.type || "audio/mpeg",
    });
    if (error) throw error;
    return path;
  }

  /** 与 Beat Battle project-json-utils 一致：bundle 或裸 project */
  function normalizeProjectJsonPayload(data) {
    if (!data || typeof data !== "object") {
      throw new Error("编曲工程内容无效");
    }
    if (data.harmonyforge != null && data.project) return data;
    if (data.sequencer || data.arranger) {
      return {
        harmonyforge: 2,
        kind: "project",
        project: data,
      };
    }
    throw new Error("不是有效的 HarmonyForge 编曲工程");
  }

  function buildPublishProjectJson(project, meta = {}) {
    if (typeof ProjectIO !== "undefined" && ProjectIO.buildBundle) {
      return normalizeProjectJsonPayload(ProjectIO.buildBundle(project, meta));
    }
    return normalizeProjectJsonPayload({
      harmonyforge: 2,
      kind: "project",
      meta: { exportedAt: new Date().toISOString(), ...meta },
      project,
    });
  }

  async function listMyPublishedWorks(userName) {
    const user = await ensureUser(userName);
    const sb = await ensureClient();
    const { data, error } = await sb
      .from("published_works")
      .select("id,user_id,user_name,title,audio_path,published_at,project_json")
      .eq("user_id", user.id)
      .order("published_at", { ascending: false })
      .limit(80);
    if (error) throw error;
    return (data || []).map(mapPublishedRow);
  }

  async function fetchMyPublishedWork(workId, userName) {
    const user = await ensureUser(userName);
    const sb = await ensureClient();
    const { data, error } = await sb
      .from("published_works")
      .select("id,user_id,user_name,title,audio_path,published_at,project_json")
      .eq("id", workId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("作品不存在或无权访问");
    return mapPublishedRow(data);
  }

  async function deletePublishedWork(workId, userName) {
    const user = await ensureUser(userName);
    const sb = await ensureClient();
    const { data: row, error: fetchErr } = await sb
      .from("published_works")
      .select("audio_path,user_id")
      .eq("id", workId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!row) throw new Error("作品不存在或无权删除");
    if (row.audio_path) {
      await sb.storage.from("audio").remove([row.audio_path]).catch(() => {});
    }
    const { error } = await sb.from("published_works").delete().eq("id", workId).eq("user_id", user.id);
    if (error) throw error;
  }

  async function renamePublishedWork(workId, title, userName) {
    const user = await ensureUser(userName);
    const trimmed = title?.trim();
    if (!trimmed) throw new Error("标题不能为空");
    const sb = await ensureClient();
    const { data, error } = await sb
      .from("published_works")
      .update({ title: trimmed })
      .eq("id", workId)
      .eq("user_id", user.id)
      .select()
      .single();
    if (error) throw error;
    return mapPublishedRow(data);
  }

  async function republishWork(workId, { title, project, userName }) {
    const user = await ensureUser(userName);
    const sb = await ensureClient();
    const { data: existing, error: fetchErr } = await sb
      .from("published_works")
      .select("id,audio_path,user_id,title")
      .eq("id", workId)
      .eq("user_id", user.id)
      .single();
    if (fetchErr) throw fetchErr;

    if (typeof AudioExport === "undefined" || !AudioExport.renderExportBlob) {
      throw new Error("音频导出模块未加载");
    }
    const projectJson = buildPublishProjectJson(project, {
      title: title || existing.title,
      source: "republish",
      workId,
    });
    const bytes = new TextEncoder().encode(JSON.stringify(projectJson)).length;
    if (bytes > MAX_PROJECT_JSON_BYTES) {
      throw new Error(`编曲 JSON 过大（上限 ${MAX_PROJECT_JSON_BYTES / 1024 / 1024}MB）`);
    }

    const blob = await AudioExport.renderExportBlob(project, "mp3");
    const ext = (blob.type || "audio/mpeg").split("/")[1]?.split(";")[0] || "mp3";
    let audioPath = existing.audio_path;
    if (!audioPath) {
      audioPath = `published/${user.id}/${workId}.${ext}`;
    }
    await uploadAudioToCloud(audioPath, blob);

    const updates = {
      title: (title || existing.title).trim(),
      audio_path: audioPath,
      project_json: projectJson,
      published_at: new Date().toISOString(),
    };
    const { data, error } = await sb
      .from("published_works")
      .update(updates)
      .eq("id", workId)
      .eq("user_id", user.id)
      .select()
      .single();
    if (error) throw error;
    return mapPublishedRow(data);
  }

  async function publishWork({ title, audioBlob, userName, projectJson }) {
    const user = await ensureUser(userName);
    if (!title?.trim()) throw new Error("请填写作品标题");
    if (!(audioBlob instanceof Blob)) throw new Error("音频无效");

    let jsonPayload = null;
    if (projectJson != null) {
      jsonPayload = normalizeProjectJsonPayload(projectJson);
      const bytes = new TextEncoder().encode(JSON.stringify(jsonPayload)).length;
      if (bytes > MAX_PROJECT_JSON_BYTES) {
        throw new Error(
          `编曲 JSON 过大（${Math.round(bytes / 1024)}KB，上限 ${MAX_PROJECT_JSON_BYTES / 1024 / 1024}MB）`
        );
      }
    }

    const workId = crypto.randomUUID();
    const ext = (audioBlob.type || "audio/mpeg").split("/")[1]?.split(";")[0] || "mp3";
    const audioPath = `published/${user.id}/${workId}.${ext}`;
    await uploadAudioToCloud(audioPath, audioBlob);

    const insertRow = {
      id: workId,
      user_id: user.id,
      user_name: user.name,
      title: title.trim(),
      audio_path: audioPath,
    };
    if (jsonPayload) insertRow.project_json = jsonPayload;

    const sb = await ensureClient();
    const { data, error } = await sb.from("published_works").insert(insertRow).select().single();
    if (error) throw error;
    return {
      id: data.id,
      title: data.title,
      userName: data.user_name,
      publishedAt: new Date(data.published_at).getTime(),
      hasProjectJson: data.project_json != null,
    };
  }

  function getPublicAudioUrl(audioPath) {
    if (!audioPath) return "";
    const { url } = getCloudConfig();
    const base = String(url || "").replace(/\/$/, "");
    return `${base}/storage/v1/object/public/audio/${audioPath}`;
  }

  function mapPublishedRow(row) {
    const audioPath = row.audio_path;
    return {
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      title: row.title,
      audioPath,
      publishedAt: new Date(row.published_at).getTime(),
      audioUrl: getPublicAudioUrl(audioPath),
      hasProjectJson: row.project_json != null,
      projectJson: row.project_json ?? null,
    };
  }

  function projectJsonToProject(bundle) {
    if (typeof ProjectIO !== "undefined" && ProjectIO.extractProject) {
      return ProjectIO.extractProject(bundle);
    }
    if (bundle?.harmonyforge != null && bundle.project) return bundle.project;
    if (bundle?.sequencer || bundle?.arranger) return bundle;
    throw new Error("编曲工程格式无效");
  }

  function safeStoreFilename(work) {
    const raw = `${work.title || "work"}-${work.userName || "player"}`
      .replace(/[<>:"/\\|?*\s]+/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 72);
    const base = raw || work.id.slice(0, 8);
    return `${base}.hfproj`;
  }

  function formatStoreTime(ts) {
    try {
      return new Date(ts).toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  /** 发布商店：列出含 project_json 的公开作品 */
  async function listPublishStoreWorks(limit = 60) {
    const sb = await ensureClient();
    const { data, error } = await sb
      .from("published_works")
      .select("id,user_id,user_name,title,audio_path,published_at,project_json")
      .not("project_json", "is", null)
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []).map(mapPublishedRow);
  }

  function downloadPublishedJson(work) {
    if (!work?.projectJson) throw new Error("该作品没有编曲 JSON");
    const bundle = normalizeProjectJsonPayload(work.projectJson);
    const json = JSON.stringify(bundle, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const name = safeStoreFilename(work);
    if (typeof FileSave !== "undefined" && FileSave.saveBlob) {
      FileSave.saveBlob(blob, name);
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
    return name;
  }

  function initWorksRepoUI({
    setStatus,
    getProjectData,
    onLoadPublishedProject,
    getEditingWorkId,
    setEditingWorkId,
  }) {
    const btn = document.getElementById("btnWorksRepo");
    const dialog = document.getElementById("worksRepoDialog");
    const listEl = document.getElementById("worksRepoList");
    const statusEl = document.getElementById("worksRepoStatus");
    const btnRefresh = document.getElementById("btnWorksRepoRefresh");
    const btnClose = document.getElementById("btnWorksRepoClose");

    if (!btn || !dialog || !listEl) return;

    let loading = false;

    function setRepoStatus(text) {
      if (statusEl) statusEl.textContent = text || "";
    }

    function renderEmpty(msg) {
      listEl.innerHTML = "";
      const li = document.createElement("li");
      li.className = "publish-store-empty";
      li.textContent = msg;
      listEl.appendChild(li);
    }

    async function ensureWorkJson(work) {
      if (work.projectJson) return work;
      const session = loadSession();
      const full = await fetchMyPublishedWork(work.id, session?.userName);
      if (!full.projectJson) throw new Error("该作品没有编曲 JSON，无法编辑");
      return full;
    }

    async function refreshRepo() {
      if (loading) return;
      const session = loadSession();
      if (!session?.userId) {
        renderEmpty("请先在评阅站加入赛季并登录昵称");
        setRepoStatus("");
        return;
      }
      loading = true;
      btnRefresh.disabled = true;
      setRepoStatus("加载中…");
      renderEmpty("正在加载…");
      try {
        const works = await listMyPublishedWorks(session.userName);
        listEl.innerHTML = "";
        if (!works.length) {
          renderEmpty("你还没有发布作品，请先点「发布」");
          setRepoStatus("0 个作品");
          return;
        }
        const editingId = getEditingWorkId?.();
        works.forEach((work) => {
          const li = document.createElement("li");
          li.className = "publish-store-item";
          if (work.id === editingId) li.classList.add("works-repo-item-active");

          const head = document.createElement("div");
          head.className = "publish-store-item-head";
          const titleEl = document.createElement("div");
          titleEl.className = "publish-store-item-title";
          titleEl.textContent = work.title || "未命名";
          const time = document.createElement("div");
          time.className = "publish-store-item-meta";
          time.textContent = formatStoreTime(work.publishedAt);
          head.append(titleEl, time);

          const sub = document.createElement("div");
          sub.className = "publish-store-item-author";
          sub.textContent = work.hasProjectJson ? "含编曲 JSON" : "仅音频";

          const actions = document.createElement("div");
          actions.className = "publish-store-item-actions";

          const btnEdit = document.createElement("button");
          btnEdit.type = "button";
          btnEdit.className = "btn btn-xs";
          btnEdit.textContent = "编辑编曲";
          btnEdit.disabled = !work.hasProjectJson;
          btnEdit.addEventListener("click", async () => {
            try {
              setStatus?.("正在获取工程…");
              const full = await ensureWorkJson(work);
              const project = projectJsonToProject(full.projectJson);
              const ok = onLoadPublishedProject?.(project, {
                title: full.title,
                workId: full.id,
                archiveReason: `编辑「${full.title}」前备份`,
              });
              if (ok !== false) {
                setEditingWorkId?.(full.id);
                dialog.close();
                setStatus?.(`正在编辑「${full.title}」— 修改后可点「重新发布」`);
              }
            } catch (err) {
              alert(err.message);
            }
          });

          const btnRepublish = document.createElement("button");
          btnRepublish.type = "button";
          btnRepublish.className = "btn btn-xs btn-ghost";
          btnRepublish.textContent = "重新发布";
          btnRepublish.addEventListener("click", async () => {
            try {
              if (typeof getProjectData !== "function") throw new Error("无法读取当前工程");
              const session = loadSession();
              let project = getProjectData();
              if (getEditingWorkId?.() !== work.id) {
                if (!confirm(`当前编辑器不是「${work.title}」。是否先从云端加载该作品再发布？`)) return;
                const full = await ensureWorkJson(work);
                project = projectJsonToProject(full.projectJson);
                onLoadPublishedProject?.(project, {
                  title: full.title,
                  workId: full.id,
                  skipConfirm: true,
                  archiveReason: `重新发布「${full.title}」前备份`,
                });
                setEditingWorkId?.(full.id);
              }
              if (!confirm(`用当前编曲覆盖云端作品「${work.title}」？`)) return;
              setStatus?.("正在重新发布…");
              btnRepublish.disabled = true;
              await republishWork(work.id, {
                title: work.title,
                project: getProjectData(),
                userName: session.userName,
              });
              setStatus?.(`已更新「${work.title}」`);
              AppLogger?.info("重新发布", work.title);
              refreshRepo();
            } catch (err) {
              alert("重新发布失败：\n" + err.message);
            } finally {
              btnRepublish.disabled = false;
            }
          });

          const btnRename = document.createElement("button");
          btnRename.type = "button";
          btnRename.className = "btn btn-xs btn-ghost";
          btnRename.textContent = "改名";
          btnRename.addEventListener("click", async () => {
            const next = prompt("作品名称", work.title || "");
            if (next == null) return;
            try {
              const session = loadSession();
              await renamePublishedWork(work.id, next, session.userName);
              refreshRepo();
              setStatus?.("已改名");
            } catch (err) {
              alert(err.message);
            }
          });

          const btnDel = document.createElement("button");
          btnDel.type = "button";
          btnDel.className = "btn btn-xs btn-ghost";
          btnDel.textContent = "删除";
          btnDel.addEventListener("click", async () => {
            if (!confirm(`确定删除「${work.title}」？不可恢复。`)) return;
            try {
              const session = loadSession();
              await deletePublishedWork(work.id, session.userName);
              if (getEditingWorkId?.() === work.id) setEditingWorkId?.(null);
              refreshRepo();
              setStatus?.("已删除作品");
            } catch (err) {
              alert(err.message);
            }
          });

          if (work.hasProjectJson) {
            const btnDown = document.createElement("button");
            btnDown.type = "button";
            btnDown.className = "btn btn-xs btn-ghost";
            btnDown.textContent = "下载 JSON";
            btnDown.addEventListener("click", async () => {
              try {
                const full = await ensureWorkJson(work);
                downloadPublishedJson(full);
              } catch (err) {
                alert(err.message);
              }
            });
            actions.append(btnDown);
          }

          if (work.audioUrl) {
            const link = document.createElement("a");
            link.className = "btn btn-xs btn-ghost";
            link.href = work.audioUrl;
            link.target = "_blank";
            link.rel = "noopener";
            link.textContent = "试听";
            actions.append(link);
          }

          actions.prepend(btnEdit, btnRepublish, btnRename, btnDel);
          li.append(head, sub, actions);
          listEl.appendChild(li);
        });
        setRepoStatus(`共 ${works.length} 个作品`);
      } catch (err) {
        renderEmpty("加载失败");
        AppLogger?.error("作品仓库", err.message);
        alert(err.message);
      } finally {
        loading = false;
        btnRefresh.disabled = false;
      }
    }

    btn.addEventListener("click", () => {
      if (!isCloudEnabled()) {
        alert("请先在评阅站配置云同步");
        return;
      }
      if (!loadSession()?.userId) {
        alert("请先在评阅站用昵称加入赛季");
        return;
      }
      dialog.showModal();
      refreshRepo();
    });

    btnRefresh?.addEventListener("click", refreshRepo);
    btnClose?.addEventListener("click", () => dialog.close());
  }

  function initPublishStoreUI({ setStatus, onLoadPublishedProject }) {
    const btnStore = document.getElementById("btnPublishStore");
    const dialog = document.getElementById("publishStoreDialog");
    const listEl = document.getElementById("publishStoreList");
    const statusEl = document.getElementById("publishStoreStatus");
    const btnRefresh = document.getElementById("btnPublishStoreRefresh");
    const btnClose = document.getElementById("btnPublishStoreClose");

    if (!btnStore || !dialog || !listEl) return;

    let loading = false;
    let cachedWorks = [];

    function setStoreStatus(text) {
      if (statusEl) statusEl.textContent = text || "";
    }

    function renderEmpty(message) {
      listEl.innerHTML = "";
      const li = document.createElement("li");
      li.className = "publish-store-empty";
      li.textContent = message;
      listEl.appendChild(li);
    }

    function renderWorks(works) {
      listEl.innerHTML = "";
      if (!works.length) {
        renderEmpty("暂无含编曲 JSON 的公开作品");
        return;
      }
      works.forEach((work) => {
        const li = document.createElement("li");
        li.className = "publish-store-item";
        li.setAttribute("role", "listitem");

        const head = document.createElement("div");
        head.className = "publish-store-item-head";
        const title = document.createElement("div");
        title.className = "publish-store-item-title";
        title.textContent = work.title || "未命名";
        const time = document.createElement("div");
        time.className = "publish-store-item-meta";
        time.textContent = formatStoreTime(work.publishedAt);
        head.append(title, time);

        const author = document.createElement("div");
        author.className = "publish-store-item-author";
        author.textContent = `作者：${work.userName || "—"}`;

        const actions = document.createElement("div");
        actions.className = "publish-store-item-actions";

        const btnDown = document.createElement("button");
        btnDown.type = "button";
        btnDown.className = "btn btn-xs btn-ghost";
        btnDown.textContent = "下载 JSON";
        btnDown.addEventListener("click", () => {
          try {
            const name = downloadPublishedJson(work);
            AppLogger?.info("已下载商店工程", name);
            setStatus?.(`已下载 ${name}`);
          } catch (err) {
            alert(err.message);
          }
        });

        const btnLoad = document.createElement("button");
        btnLoad.type = "button";
        btnLoad.className = "btn btn-xs";
        btnLoad.textContent = "下载并加载";
        btnLoad.addEventListener("click", () => {
          try {
            if (typeof onLoadPublishedProject !== "function") {
              throw new Error("加载接口未就绪");
            }
            const name = downloadPublishedJson(work);
            const project = projectJsonToProject(work.projectJson);
            const ok = onLoadPublishedProject(project, {
              title: work.title,
              userName: work.userName,
              filename: name,
              archiveReason: `加载「${work.title}」前备份`,
            });
            if (ok !== false) {
              dialog.close();
              AppLogger?.info("已从商店加载工程", work.title);
              setStatus?.(`已加载「${work.title}」`);
            }
          } catch (err) {
            AppLogger?.error("加载商店工程失败", err.message);
            alert("加载失败：\n" + err.message);
          }
        });

        actions.append(btnDown, btnLoad);

        if (work.audioUrl) {
          const link = document.createElement("a");
          link.className = "btn btn-xs btn-ghost";
          link.href = work.audioUrl;
          link.target = "_blank";
          link.rel = "noopener";
          link.textContent = "试听 MP3";
          actions.append(link);
        }

        li.append(head, author, actions);
        listEl.appendChild(li);
      });
    }

    async function refreshStore() {
      if (loading) return;
      if (!isCloudEnabled()) {
        renderEmpty("请先在评阅站配置云同步");
        setStoreStatus("未连接云端");
        return;
      }
      loading = true;
      btnRefresh.disabled = true;
      setStoreStatus("加载中…");
      renderEmpty("正在加载…");
      try {
        cachedWorks = await listPublishStoreWorks();
        renderWorks(cachedWorks);
        setStoreStatus(`共 ${cachedWorks.length} 个作品`);
      } catch (err) {
        renderEmpty("加载失败，请稍后重试");
        setStoreStatus("");
        AppLogger?.error("发布商店", err.message);
        alert("无法加载发布商店：\n" + err.message);
      } finally {
        loading = false;
        btnRefresh.disabled = false;
      }
    }

    btnStore.addEventListener("click", () => {
      if (!isCloudEnabled()) {
        alert("请先在评阅站打开「设置」完成云同步，与发布功能使用同一 Supabase 项目。");
        return;
      }
      dialog.showModal();
      refreshStore();
    });

    btnRefresh?.addEventListener("click", refreshStore);
    btnClose?.addEventListener("click", () => dialog.close());
  }

  function syncHeaderBadge() {
    const badge = document.getElementById("reviewSessionBadge");
    const nameEl = document.getElementById("reviewSessionName");
    const session = loadSession();
    if (!badge || !nameEl) return;
    if (session?.userName) {
      badge.hidden = false;
      nameEl.textContent = session.userName;
      badge.title = `评阅站昵称：${session.userName}`;
    } else {
      badge.hidden = true;
      nameEl.textContent = "—";
    }
  }

  function initUI({
    getProjectData,
    setStatus,
    onLoadPublishedProject,
    getEditingWorkId,
    setEditingWorkId,
  }) {
    syncHeaderBadge();
    window.addEventListener("storage", (e) => {
      if (e.key === LS_SESSION) syncHeaderBadge();
    });

    const link = document.getElementById("linkBeatBattle");
    if (link) link.href = BEAT_BATTLE_URL;

    const btnPublish = document.getElementById("btnPublish");
    const publishDialog = document.getElementById("publishDialog");
    const publishForm = document.getElementById("publishForm");
    const publishTitle = document.getElementById("publishTitle");
    const publishNickname = document.getElementById("publishNickname");

    if (!btnPublish || !publishDialog) return;

    const session = loadSession();
    if (publishNickname && session?.userName) {
      publishNickname.value = session.userName;
      publishNickname.disabled = true;
    }

    btnPublish.addEventListener("click", () => {
      const s = loadSession();
      if (publishTitle) publishTitle.value = "";
      if (publishNickname) {
        publishNickname.value = s?.userName || "";
        publishNickname.disabled = Boolean(s?.userName);
      }
      publishDialog.showModal();
    });

    if (publishForm) {
      publishForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const submitter = e.submitter;
        if (!submitter || submitter.value !== "ok") {
          publishDialog.close();
          return;
        }
        const title = publishTitle?.value?.trim();
        const nick = publishNickname?.value?.trim();
        publishDialog.close();
        try {
          if (!isCloudEnabled()) {
            throw new Error("云同步未配置，请先在评阅站打开「设置」完成云同步");
          }
          if (typeof getProjectData !== "function") {
            throw new Error("无法读取当前工程");
          }
          if (typeof AudioExport === "undefined" || !AudioExport.renderExportBlob) {
            throw new Error("音频导出模块未加载");
          }
          setStatus?.("正在渲染音频与工程 JSON，并发布到制作库…");
          btnPublish.disabled = true;
          const project = getProjectData();
          const projectJson = buildPublishProjectJson(project, {
            title,
            source: "publish",
          });
          const blob = await AudioExport.renderExportBlob(project, "mp3");
          const work = await publishWork({
            title,
            audioBlob: blob,
            userName: nick,
            projectJson,
          });
          const jsonNote = work.hasProjectJson ? "（含编曲 JSON）" : "";
          AppLogger.info("已发布到制作库", `${work.title} · ${work.id.slice(0, 8)}${jsonNote}`);
          setStatus?.(`已发布「${work.title}」${jsonNote} — 请到评阅站制作库提交参赛`);
          syncHeaderBadge();
        } catch (err) {
          AppLogger.error("发布失败", err.message);
          setStatus?.("发布失败：" + err.message);
          alert("发布失败：\n" + err.message);
        } finally {
          btnPublish.disabled = false;
        }
      });
    }

    initPublishStoreUI({ setStatus, onLoadPublishedProject });
    initWorksRepoUI({
      setStatus,
      getProjectData,
      onLoadPublishedProject,
      getEditingWorkId,
      setEditingWorkId,
    });
  }

  return {
    BEAT_BATTLE_URL,
    loadSession,
    saveSession,
    isCloudEnabled,
    ensureUser,
    publishWork,
    buildPublishProjectJson,
    listPublishStoreWorks,
    listMyPublishedWorks,
    fetchMyPublishedWork,
    deletePublishedWork,
    renamePublishedWork,
    republishWork,
    downloadPublishedJson,
    syncHeaderBadge,
    initUI,
  };
})();
