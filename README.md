# HarmonyForge · 编曲工作站

基于 Web Audio 的在线音乐编曲网页，核心功能是**多轨步进音序**与**编曲时间轴**。

**线上地址**：https://jk9988610.github.io/Music-production-website/

## 功能

- **步进音序器**：默认 7 轨、可 ±轨 增至 12 轨，16 种音色可切换（听感命名，非乐器名）；步数可 ±4 调整（4–64 步）
- **Pattern 库**：默认 4 个，可 ± 增减（1–16 个），编曲栏与时间轴分配
- **编曲时间轴**：多段编排，± 段增减，末尾「+段」；播放按段循环
- **调性与音阶**：在选音弹窗设置（默认 C 大调）；大调、小调、五声、蓝调
- **混音**：每轨独立音量
- **步进密度**：音序轨名旁 ½× / 1× / 2× / 4×（相对顶栏主 BPM，不改变段落长度）
- **编曲段落**：+段弹窗选类型；单击选中同步音序；复制、剪切、前插、后插
- **布局**：顶栏「布局」可调模块顺序、显示、间距与格子尺寸（随草稿保存）
- **草稿 / 存读**：自动保存草稿；顶栏存、读、清
- **导出格式**：JSON 工程（默认）、WAV、MP3 音频（编曲时间轴混音）
- **Beat Battle 联动**（v2.2.0+）：发布 / **作品仓库**（管理自己的云端作品）/ **发布商店** / **草稿站**（本地多份备份，加载他人作品前自动归档）
- **音序跟随**：播放编曲时自动切换至当前段落的 Pattern，仅在对应类型页显示播放头

## 本地预览

直接用浏览器打开 `index.html`，或使用本地静态服务：

```bash
python3 -m http.server 8080
```

然后访问 http://localhost:8080

## GitHub Pages 与发布流程

站点由 **GitHub Actions** 在 **`main` 分支有 push 时**自动部署到 Pages（workflow：`.github/workflows/deploy-pages.yml`）。

### 仓库首次配置

1. **Settings → Pages → Build and deployment** 选择 **GitHub Actions**
2. 部署完成后访问：`https://jk9988610.github.io/Music-production-website/`

### 更新后默认必做一步（重要）

> **仅推送到功能分支不会更新线上站点。**  
> 功能开发、修 bug、改版本号之后，**默认必须合并进 `main` 并推送**，才会触发 Pages 重新部署。

推荐流程：

1. 修改代码，并更新根目录 **`VERSION`**（如 `1.4.5`）
2. 提交到功能分支（可选）或直接在 `main` 上提交
3. **合并到 `main`**（本地或 GitHub PR 合并均可）
4. **推送 `main`**：
   ```bash
   git checkout main
   git pull origin main
   git merge <你的功能分支>   # 若已在 main 开发可跳过
   git push origin main
   ```
5. 在 GitHub **Actions** 中确认 `Deploy to GitHub Pages` 成功（约 1–2 分钟）
6. 验证线上版本（应显示新版本号与新的 build）：
   ```bash
   curl -s "https://jk9988610.github.io/Music-production-website/version.json"
   ```
7. 浏览器打开站点后使用 **Ctrl+F5**（Mac：**Cmd+Shift+R**）强刷，避免旧 JS/CSS 缓存

**给 Cursor / Cloud Agent 的约定**：每次完成用户请求的代码更新后，若无特别说明，应默认执行「合并到 `main` + `git push origin main` + 确认 Pages 部署」，而不仅是推功能分支或只开 PR。

部署时会自动：

- 根据 `VERSION` 生成 `version.json` 与内嵌的 `js/version.js`（`BUNDLED_VERSION` / `BUNDLED_BUILD`）
- 为 `index.html` 引用的 CSS/JS 追加 `?v=<build>` 缓存破坏参数

### 用户端「更新」按钮

- 顶栏显示的是**当前页面实际运行**的版本（内嵌 `BUNDLED_*`）
- 「更新」会拉取线上 `version.json`，与运行版本对比；有新版本时确认后强制刷新
- 若已部署新版本但界面仍像旧版，请先 **强刷** 再点「更新」

## 文件结构

```
index.html          # 主页面
css/styles.css      # 基础样式
css/layout.css      # 布局与模块外壳
js/tone.min.js      # Tone.js 音频引擎（v14）
js/audio-engine.js  # 音色合成与轨道路由
js/sequencer.js     # Pattern 与音序数据
js/arranger.js      # 编曲时间轴
js/app.js           # 应用逻辑与 UI
js/version.js       # 版本检测与更新
js/app-logger.js    # 运行日志
VERSION             # 发布版本号（部署时同步到 version.json）
version.json        # 本地占位；线上由 CI 生成
```

## 快捷键

| 按键 | 功能 |
|------|------|
| Space | 播放 / 暂停 |
| 1–9 | 切换前 9 个 Pattern |
