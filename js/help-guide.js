/**
 * 帮助中心 — 分标签页教学内容
 */
const HelpGuide = (() => {
  const PANELS = [
    {
      id: "workflow",
      label: "完整流程",
      html: `
        <h4>从零完成一首编曲</h4>
        <p>HarmonyForge 把「节奏 → 和声 → 旋律 → 段落」拆开，用 <strong>类型</strong> 存短循环，用 <strong>时间轴</strong> 拼成完整曲式。建议按下面顺序操作。</p>
        <ol class="help-steps">
          <li><strong>定调</strong>：点旋律格子打开选音弹窗，在弹窗里设「调」「阶」（未改时默认 C 大调）。节奏类音色无音高。</li>
          <li><strong>做节奏</strong>：在音序器选 Pattern A，用底鼓 / 军鼓 / 闭镲等，做出 1 小节节奏模板。</li>
          <li><strong>做贝斯</strong>：仍在 A（或新建 B），在电贝斯轨填根音 — 通常落在强拍，与底鼓对齐。</li>
          <li><strong>做和弦</strong>：在和弦铺底轨填块状和弦根音（见「音高与配器」），常每 4 步换一次。</li>
          <li><strong>做主旋律</strong>：在合成主音轨用音阶内音填句，避开与和弦铺底打架的密集区。</li>
          <li><strong>复制变型</strong>：用「+型」复制出 B/C/D，做加花、过门或副歌加密度。</li>
          <li><strong>排段落</strong>：在编曲模块用时间轴把 §1§2§… 指到 A/B/C/D；「+段」会弹窗选类型。</li>
          <li><strong>混音</strong>：平衡各轨音量；音序轨旁可设「密度」½×～4×。</li>
          <li><strong>播放检查</strong>：点播放走完整时间轴；不满意回到对应 Pattern 改步格。</li>
          <li><strong>保存</strong>：自动草稿 +「导出」.hfproj 备份。</li>
          <li><strong>参赛发布</strong>：先在评阅站加入赛季 → 本页「发布」到制作库（含 MP3 + 编曲 JSON）→ 回评阅站「制作库」提交参赛。</li>
          <li><strong>作品仓库</strong>：管理自己已发布作品 — 编辑、重新发布、改名、删除；编辑时无本地工程会从云端下载 JSON。</li>
          <li><strong>发布商店</strong>：浏览他人作品，「下载 JSON」或「下载并加载」（加载前自动存入草稿站）。</li>
          <li><strong>草稿站</strong>：本地多份备份；切换加载他人作品前自动归档当前编曲。</li>
        </ol>
        <p class="help-tip">小技巧：先 8～16 步做短循环，确认好听后再「+4步」扩展；时间轴先 4～8 段试结构，再加长。</p>
      `,
    },
    {
      id: "arrange",
      label: "编曲",
      html: `
        <h4>编曲模块</h4>
        <p><strong>工具栏两行：</strong></p>
        <ul class="help-list">
          <li><strong>类型行（在音序模块）</strong>：标签 A/B/C… 切换「正在编辑哪一型」；「−型」「+型」增减 Pattern（最多 16 个）。</li>
          <li><strong>段落 行</strong>：「−段」「+段」减少 / 增加时间轴小节段（<strong>+段</strong> 会弹窗选择该段使用的类型）；「复制」「剪切」「前插」「后插」编辑段落。</li>
        </ul>
        <p><strong>段落与音序联动：</strong>单击选中某段后，音序模块会自动切换到该段对应的类型（A/B/C…）并显示其步进网格，便于直接编辑该段内容。</p>
        <p><strong>段落编辑：</strong>单击选中；「复制」或「剪切」写入剪贴板；再选中另一格（可不选）后点「前插」或「后插」。未选中目标时，前插到开头、后插到末尾。剪切后只能粘贴一次。</p>
        <p><strong>时间轴：</strong>每个格子 = 播放时的一个小节。格上大字（A/B/C…）表示该段播放哪一型 Pattern。</p>
        <p><strong>与音序的关系：</strong>你在音序里编辑的是「某一型的 7 轨数据」；时间轴只负责「第几小节播放哪一型」。例如 §1–§4 用 A（主歌），§5–§8 用 B（副歌）。</p>
        <p>双击时间轴上的段落格，会弹出类型选择窗（A/B/C…），可自由选择该段使用的 Pattern。</p>
        <p><strong>音序跟随：</strong>勾选后播放编曲时，音序会自动切换到当前段落对应的类型；手动切换类型标签或调整模块显示时会自动取消跟随。播放时仅在「正在播放的类型」音序页显示步进黄框。</p>
        <p><strong>典型曲式示例：</strong></p>
        <ul class="help-list">
          <li>§1–§2 → A（前奏 / 主歌节奏）</li>
          <li>§3–§6 → B（主歌加贝斯与和弦铺底）</li>
          <li>§7–§8 → C（副歌更满）</li>
          <li>§9 → D（过门或 breakdown）</li>
        </ul>
      `,
    },
    {
      id: "sequencer",
      label: "音序",
      html: `
        <h4>步进音序器</h4>
        <p>默认 7 轨，可用「+轨」「−轨」增减（1～12 轨）。<strong>点击轨名</strong>切换音色（共 16 种标准制作用语命名）。</p>
        <ul class="help-list">
          <li><strong>节奏类</strong>：底鼓、军鼓、闭镲、开镲、通鼓、碎音镲</li>
          <li><strong>旋律类</strong>：电贝斯、钢琴、电吉他、和弦铺底、合成主音、萨克斯、小号、长号、小提琴、大提琴</li>
          <li><strong>底鼓</strong>：低频膜片合成 + 击点击</li>
          <li><strong>军鼓</strong>：噪声 + 体共鸣</li>
          <li><strong>闭镲 / 开镲 / 碎音镲</strong>：短、开、长亮金属镲片分层</li>
          <li><strong>电贝斯</strong>：锯齿低音 + 低通滤波</li>
          <li><strong>钢琴</strong>：按音高分参 FM（低音编钟非谐波、极短调制敲击）+ 高通/EQ</li>
          <li><strong>合成主音</strong>：MonoSynth 锯齿 + 滤波扫频</li>
          <li><strong>和弦铺底</strong>：PolySynth + AMSynth 方波垫音</li>
          <li><strong>电吉他</strong>：PluckSynth 拨弦</li>
          <li><strong>萨克斯</strong>：MonoSynth 带通滤波（管乐）</li>
          <li><strong>小号</strong>：FMSynth 亮铜管；<strong>长号</strong>：MonoSynth 低通厚铜</li>
          <li><strong>小提琴 / 大提琴</strong>：MonoSynth 慢起音弓弦；钢琴为快击 FM，勿混淆</li>
          <li><strong>换音色</strong>：点左侧轨名</li>
          <li><strong>密度</strong>：倍率按钮（½×～4×），弹窗选择。</li>
          <li><strong>±轨 / ±4步</strong>：增减轨道数与 Pattern 长度。</li>
        </ul>
        <p><strong>播放头：</strong>播放时当前步会高亮；编曲播放模式下时间轴对应段也会亮。</p>
        <p><strong>Pattern 切换：</strong>音序模块点类型标签 A/B/C，或快捷键 <kbd>1</kbd>–<kbd>9</kbd>，编辑的是不同 Pattern 副本；编曲时间轴点段落格可选该段类型。</p>
        <p><strong>类型循环：</strong>勾选后按 BPM 循环播放当前类型的完整 7 轨音序，并停止顶栏编曲播放。</p>
        <p><strong>单步循环：</strong>先点步进号（1、2、3…）选定列，勾选后按 BPM 循环播放该<strong>整列</strong>上已填内容。节奏轨点选时只响一次，取消不发声。</p>
      `,
    },
    {
      id: "mixer",
      label: "混音与密度",
      html: `
        <h4>轨音量与步进密度</h4>
        <p>顶栏 <strong>BPM</strong> 为全曲主时钟（编曲、类型循环、单步循环、导出均以此为准）。</p>
        <p>音序模块每轨名称旁的 <strong>密度</strong>（½× / 1× / 2× / 4×）表示相对主步进的触发倍率：</p>
        <ul class="help-list">
          <li><strong>1×</strong>：每个主步最多触发一次（默认）</li>
          <li><strong>2× / 4×</strong>：同一主步内细分多次（适合闭镲、装饰音）</li>
          <li><strong>½×</strong>：每隔一个主步才读该列格子（适合慢一倍的气垫）</li>
        </ul>
        <p>网格仍按主步编辑；密度只改变播放与导出时的触发时机，不改变段落长度。</p>
      `,
    },
    {
      id: "pitch",
      label: "音高与配器",
      html: `
        <h4>程序音高基础</h4>
        <p>旋律轨每格存一个 <strong>MIDI 音高</strong>（数字），界面写成 <code>音名+八度</code>（如 <code>G2</code>、<code>C4</code>）。点格子打开<strong>选音弹窗</strong>，在弹窗顶部设「调」「阶」——<strong>只决定可选音列表，不改变该轨音色</strong>。钢琴选音限定在 C3–G5，避免过低像电贝斯。未设时默认 <strong>C 大调</strong>。</p>
        <p>选音弹窗默认勾选 <strong>试听</strong>：点击音高会用该轨当前音色预听一次，并会停止编曲 / 类型循环 / 单步循环播放；满意后点「选用」写入格子。</p>

        <h4>底鼓 · 军鼓 · 镲片类</h4>
        <p><strong>无音高。</strong>只负责节奏框架。</p>
        <ul class="help-list">
          <li>底鼓：常放在第 1、5、9、13 步（四拍底）</li>
          <li>军鼓：常放在第 5、13 步（2、4 拍）</li>
          <li>闭镲：八分或十六分均匀；开镲：偶尔在第 16 步或反拍点缀</li>
        </ul>

        <h4>电贝斯轨</h4>
        <p><strong>单音</strong>，跟根音走。在 C 大调里优先选 C、F、G 等音阶音，低八度（如 C2–G2）。</p>
        <ul class="help-list">
          <li>强拍（1、3 拍）放根音，与底鼓对齐</li>
          <li>可每 4 步换一个音，形成 I–IV–V 进行（如 C → F → G → C）</li>
          <li>避免与和弦铺底轨音高完全重复同一八度，贝斯应更低</li>
        </ul>

        <h4>和弦铺底轨</h4>
        <p>格内音高是<strong>和弦根音</strong>。程序会自动叠 <strong>根音 + 大三度 + 纯五度</strong>（大三和弦）。</p>
        <ul class="help-list">
          <li>同一和弦常持续 4 步或 8 步再换</li>
          <li>C 大调：I=C，IV=F，V=G — 选对应根音即可</li>
          <li>和弦铺底偏中低区（如 C3–G3），不要比贝斯还低</li>
        </ul>

        <h4>合成主音轨</h4>
        <p><strong>单音</strong>，最亮。常用比和弦铺底高一个八度以上（如 C4–G4）。</p>
        <ul class="help-list">
          <li>从音阶音开始，先写短 motive（3～5 个音）再重复变奏</li>
          <li>强拍可用音阶 1 度或 5 度，弱拍用经过音</li>
          <li>一句结束音落在 1 度或 3 度更稳</li>
          <li>格内字被边框挡住时：缩小步进或略增模块下内边距；播放检查听感为主</li>
        </ul>

        <h4>搭配总表（C 大调示例）</h4>
        <table class="help-table">
          <thead><tr><th>音色</th><th>音区</th><th>节奏</th><th>作用</th></tr></thead>
          <tbody>
            <tr><td>底鼓</td><td>—</td><td>四拍</td><td>节奏底座</td></tr>
            <tr><td>军鼓</td><td>—</td><td>2/4 拍</td><td>节奏骨架</td></tr>
            <tr><td>电贝斯</td><td>C2–G2</td><td>根音在强拍</td><td>和声底座</td></tr>
            <tr><td>和弦铺底</td><td>C3–G3</td><td>每 4 步换根</td><td>和声填充</td></tr>
            <tr><td>合成主音</td><td>C4–G4</td><td>句型</td><td>记忆点</td></tr>
          </tbody>
        </table>

        <h4>不同调式</h4>
        <p>换「阶」为五声时选音变少；蓝调适合爵士句；小调时贝斯 / 和弦铺底优先 i、iv、V 级。每格可单独选调/阶。改调/阶后已填音不会自动移调，需手动重选。</p>
      `,
    },
    {
      id: "mixer-play",
      label: "混音播放",
      html: `
        <h4>混音</h4>
        <p>混音模块各轨一条音量滑条。建议起点：</p>
        <ul class="help-list">
          <li>节奏类合计最大（底鼓、军鼓、镲片约 80～90%）</li>
          <li>电贝斯次之（约 75%），再和弦铺底（约 70%）</li>
          <li>合成主音略低于节奏、高于和弦铺底（约 65～75%），避免盖过主唱想象位</li>
        </ul>
        <p>随草稿自动保存。</p>
        <h4>播放</h4>
        <ul class="help-list">
          <li><kbd>Space</kbd> 播放 / 暂停编曲时间轴（按段顺序）</li>
          <li>BPM：顶栏调节速度</li>
          <li>播放时音序当前 Pattern 高亮；时间轴当前段高亮</li>
        </ul>
      `,
    },
    {
      id: "project",
      label: "项目布局",
      html: `
        <h4>保存与文件</h4>
        <ul class="help-list">
          <li><strong>自动草稿</strong>：改动后约 0.6 秒写入浏览器</li>
          <li><strong>存 / 读</strong>：浏览器内项目槽</li>
          <li><strong>导出 / 导入</strong>：导出可选 JSON（默认）、WAV、MP3；导入仍为 <code>.hfproj</code> JSON 工程文件</li>
          <li><strong>清</strong>：重置演示数据（慎用）</li>
        </ul>
        <h4>布局</h4>
        <p>顶栏「布局」可改模块顺序、间距、格子大小；「主区域行距」= 模块间距。默认：混音 → 音序 → 编曲。</p>
        <h4>版本</h4>
        <p>顶栏版本号；「更新」检查线上版本；「日志」排错。</p>
      `,
    },
    {
      id: "shortcuts",
      label: "快捷键",
      html: `
        <h4>快捷键</h4>
        <ul class="help-list">
          <li><kbd>Space</kbd> 播放 / 暂停</li>
          <li><kbd>1</kbd>–<kbd>9</kbd> 切换 Pattern 1～9</li>
        </ul>
        <p>在输入框内时光标不会触发上述快捷键。</p>
      `,
    },
  ];

  function init() {
    if (init._done) return;
    init._done = true;
    const dialog = document.getElementById("helpDialog");
    if (!dialog) return;

    const nav = dialog.querySelector(".help-tabs");
    const body = dialog.querySelector(".help-tab-panels");
    if (!nav || !body) return;

    nav.innerHTML = "";
    body.innerHTML = "";

    PANELS.forEach((panel, i) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = "help-tab" + (i === 0 ? " active" : "");
      tab.dataset.helpTab = panel.id;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", i === 0 ? "true" : "false");
      tab.textContent = panel.label;
      nav.appendChild(tab);

      const article = document.createElement("article");
      article.className = "help-panel";
      article.dataset.panel = panel.id;
      article.setAttribute("role", "tabpanel");
      article.hidden = i !== 0;
      article.innerHTML = panel.html;
      body.appendChild(article);
    });

    nav.addEventListener("click", (e) => {
      const tab = e.target.closest(".help-tab");
      if (!tab) return;
      const id = tab.dataset.helpTab;
      nav.querySelectorAll(".help-tab").forEach((t) => {
        const on = t === tab;
        t.classList.toggle("active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });
      body.querySelectorAll(".help-panel").forEach((p) => {
        p.hidden = p.dataset.panel !== id;
      });
    });
  }

  return { init, PANELS };
})();
