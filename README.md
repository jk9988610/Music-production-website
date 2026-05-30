# HarmonyForge · 编曲工作站

基于 Web Audio 的在线音乐编曲网页，核心功能是**多轨步进音序**与**编曲时间轴**。

## 功能

- **步进音序器**：底鼓、军鼓、镲、贝斯、和弦、主旋律共 7 轨，16 步/小节
- **Pattern 库**：A–D 四个 Pattern，可独立编辑
- **编曲时间轴**：将 Pattern 编排为完整段落，播放时按顺序循环
- **调性与音阶**：大调、小调、五声、多利亚；旋律轨按音阶选音
- **混音**：每轨独立音量
- **保存/加载**：项目数据保存在浏览器 `localStorage`

## 本地预览

直接用浏览器打开 `index.html`，或使用本地静态服务：

```bash
python3 -m http.server 8080
```

然后访问 http://localhost:8080

## GitHub Pages

推送到 `main` 分支后，GitHub Actions 会自动将站点根目录部署到 Pages。

1. 仓库 **Settings → Pages → Build and deployment** 选择 **GitHub Actions**
2. 首次部署完成后，站点地址一般为：  
   `https://<用户名>.github.io/Music-production-website/`

## 文件结构

```
index.html          # 主页面
css/styles.css      # 界面样式
js/audio-engine.js  # Web Audio 合成
js/sequencer.js     # Pattern 与音序数据
js/arranger.js      # 编曲时间轴
js/app.js           # 应用逻辑与 UI
```

## 快捷键

| 按键 | 功能 |
|------|------|
| Space | 播放 / 暂停 |
| 1–4 | 切换 Pattern A–D |
