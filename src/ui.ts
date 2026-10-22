/**
 * 管理面板。单文件、无外部依赖，直接由 Worker 返回。
 * 登录态使用 HttpOnly Cookie，页面不保存密码。
 */
export const DASHBOARD_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="description" content="基于 Cloudflare Workers 与 R2 的图床">
<title>Flare Image · 图床</title>
<style>
  :root{
    --paper:#ebe7dd;
    --paper-2:#f5f2ea;
    --white:#fbfaf6;
    --ink:#1b1f1c;
    --muted:#73776c;
    --rule:#c7c1b2;
    --cyan:#1d4d63;
    --cyan-soft:#dae6e4;
    --safelight:#b5381f;
    --serif:"Iowan Old Style","Palatino Linotype",Palatino,"Songti SC","Noto Serif SC",Georgia,serif;
    --sans:"Avenir Next","Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif;
    --mono:ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace;
  }
  *{box-sizing:border-box}
  html,body{margin:0}
  body{
    min-height:100vh;
    background-color:var(--paper);
    background-image:
      radial-gradient(circle at 12% 4%,rgba(255,255,255,.62),transparent 42%),
      radial-gradient(circle at 88% 92%,rgba(255,255,255,.34),transparent 38%),
      repeating-linear-gradient(0deg,rgba(27,31,28,.016) 0 1px,transparent 1px 3px);
    color:var(--ink);
    font-family:var(--sans);
    font-size:16px;
    line-height:1.5;
  }
  .masthead{
    max-width:1280px;
    margin:0 auto;
    padding:20px 28px;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:16px;
    border-bottom:1px solid var(--rule);
  }
  .wordmark{
    font-family:var(--serif);
    font-size:20px;
    font-weight:600;
    letter-spacing:.05em;
    color:inherit;
    text-decoration:none;
    white-space:nowrap;
  }
  .wordmark .spark{color:var(--safelight);font-style:normal}
  .wordmark .slash{color:var(--muted);font-weight:400;margin:0 .12em}
  .mast-meta{
    display:flex;
    align-items:center;
    gap:9px;
    font-family:var(--mono);
    font-size:11px;
    letter-spacing:.04em;
    color:var(--muted);
  }
  .user-name{color:var(--ink)}
  .role-badge{
    padding:2px 6px;
    border:1px solid var(--rule);
    color:var(--muted);
    font-size:10px;
    white-space:nowrap;
  }
  .role-badge.admin{border-color:var(--safelight);color:var(--safelight)}
  main{max-width:1280px;margin:0 auto;padding:0 28px 64px}
  .boot{
    padding:90px 0;
    text-align:center;
    font-family:var(--mono);
    font-size:12px;
    color:var(--muted);
  }
  .auth-wrap{display:flex;justify-content:center;padding:48px 0 20px}
  .auth-card{
    width:min(440px,100%);
    padding:34px;
    border:2px solid var(--ink);
    background:var(--paper-2);
  }
  .auth-card h1{
    margin:0 0 10px;
    font-family:var(--serif);
    font-size:38px;
    font-weight:500;
    letter-spacing:-.02em;
  }
  .auth-sub{margin:0 0 26px;font-size:14px;color:#454a42}
  .auth-field{margin-bottom:16px}
  .auth-field label{
    display:block;
    margin-bottom:7px;
    font-family:var(--mono);
    font-size:10px;
    letter-spacing:.1em;
    color:var(--muted);
  }
  .auth-field input{
    width:100%;
    padding:11px 12px;
    border:1px solid var(--ink);
    border-radius:0;
    background:var(--white);
    color:var(--ink);
    font-family:var(--sans);
    font-size:15px;
    outline:none;
  }
  .auth-field input:focus{box-shadow:inset 0 0 0 2px var(--cyan)}
  .auth-error{min-height:20px;margin:0 0 12px;color:var(--safelight);font-size:13px}
  .auth-btn{
    width:100%;
    padding:12px;
    border:1px solid var(--ink);
    border-radius:0;
    background:var(--ink);
    color:var(--paper-2);
    font-family:var(--sans);
    font-size:15px;
    font-weight:600;
    cursor:pointer;
    transition:background .15s,border-color .15s;
  }
  .auth-btn:hover{background:var(--cyan);border-color:var(--cyan)}
  .auth-btn:disabled{opacity:.5;cursor:default}
  .auth-note{margin:18px 0 0;font-size:12px;line-height:1.6;color:var(--muted)}
  .kicker{
    margin:0 0 18px;
    font-family:var(--mono);
    font-size:11px;
    letter-spacing:.1em;
    color:var(--muted);
  }
  .intro{padding:56px 0 42px;max-width:920px}
  .intro h1{
    margin:0 0 22px;
    font-family:var(--serif);
    font-weight:500;
    font-size:clamp(44px,7vw,86px);
    line-height:.98;
    letter-spacing:-.035em;
  }
  .lede{margin:0;max-width:52ch;font-size:17px;color:#454a42}
  .workbench{
    display:grid;
    grid-template-columns:minmax(300px,.82fr) minmax(0,1.35fr);
    gap:2px;
    border:2px solid var(--ink);
    background:var(--ink);
  }
  .easel,.sheet{background:var(--paper-2);padding:26px}
  .panel-head{
    display:flex;
    align-items:baseline;
    justify-content:space-between;
    gap:16px;
    margin-bottom:18px;
  }
  .panel-head h2{margin:0;font-family:var(--serif);font-size:22px;font-weight:600}
  .lamp{
    display:flex;
    align-items:center;
    gap:7px;
    font-family:var(--mono);
    font-size:11px;
    color:var(--muted);
    white-space:nowrap;
  }
  .lamp i{
    display:block;
    width:9px;
    height:9px;
    border-radius:50%;
    background:var(--rule);
    transition:background .2s,box-shadow .2s;
  }
  .lamp.busy{color:var(--safelight)}
  .lamp.busy i{background:var(--safelight);box-shadow:0 0 0 4px rgba(181,56,31,.14)}
  .drop{
    position:relative;
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    gap:4px;
    min-height:252px;
    padding:30px 22px;
    border:1px dashed #9a968a;
    background:
      repeating-linear-gradient(45deg,rgba(27,31,28,.032) 0 8px,transparent 8px 16px),
      var(--paper-2);
    text-align:center;
    cursor:pointer;
    transition:background .2s,border-color .2s,transform .2s;
  }
  .drop:hover,.drop.drag{border-color:var(--cyan);background:var(--cyan-soft)}
  .drop.drag{transform:scale(.995)}
  .drop:focus-within{outline:2px solid var(--cyan);outline-offset:3px}
  .drop input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
  .drop-icon{
    display:grid;
    place-items:center;
    width:58px;
    height:58px;
    margin-bottom:8px;
    border:1px solid var(--cyan);
    border-radius:50%;
    color:var(--cyan);
    font-family:var(--serif);
    font-size:34px;
    line-height:1;
  }
  .drop-title{font-size:17px;font-weight:600}
  .drop-hint{font-size:13px;color:var(--muted)}
  .drop-formats{
    max-width:36ch;
    margin-top:10px;
    font-family:var(--mono);
    font-size:10px;
    letter-spacing:.03em;
    color:#8a8d82;
  }
  .progress{margin-top:20px;font-family:var(--mono);font-size:11px;color:var(--cyan)}
  .progress-bar{display:block;height:4px;margin-top:7px;background:var(--rule);overflow:hidden}
  .progress-bar i{display:block;width:0;height:100%;background:var(--safelight);transition:width .25s}
  .sheet-head{
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap:16px;
    margin-bottom:20px;
    padding-bottom:14px;
    border-bottom:1px solid var(--rule);
  }
  .sheet-head h2{margin:0 0 3px;font-family:var(--serif);font-size:22px;font-weight:600}
  .sheet-sub{margin:0;font-size:12px;color:var(--muted)}
  .grid{
    display:grid;
    grid-template-columns:repeat(auto-fill,minmax(150px,1fr));
    gap:20px 18px;
    align-content:start;
  }
  .frame{margin:0;min-width:0}
  .thumb{
    position:relative;
    display:block;
    aspect-ratio:1;
    overflow:hidden;
    border:6px solid var(--white);
    background:#d8d4c9;
    box-shadow:0 0 0 1px var(--rule),0 2px 0 rgba(27,31,28,.06);
    transition:box-shadow .2s,transform .2s;
  }
  .thumb img{
    display:block;
    width:100%;
    height:100%;
    object-fit:cover;
    transition:transform .45s cubic-bezier(.2,.7,.2,1);
  }
  .thumb:hover{box-shadow:0 0 0 1px var(--ink),0 6px 18px rgba(27,31,28,.14);transform:translateY(-2px)}
  .thumb:hover img{transform:scale(1.035)}
  .frame figcaption{margin-top:8px}
  .name{
    display:block;
    overflow:hidden;
    font-family:var(--mono);
    font-size:10px;
    white-space:nowrap;
    text-overflow:ellipsis;
    color:var(--ink);
  }
  .frame-no{color:var(--muted)}
  .actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px}
  .actions button{
    padding:0;
    border:0;
    background:none;
    color:var(--cyan);
    font-family:var(--mono);
    font-size:10px;
    letter-spacing:.02em;
    text-decoration:underline;
    text-underline-offset:2px;
    cursor:pointer;
  }
  .actions button:hover{color:var(--ink)}
  .actions .danger{color:var(--safelight)}
  .empty{
    padding:46px 24px;
    border:1px dashed var(--rule);
    color:var(--muted);
    font-size:13px;
    text-align:center;
  }
  .empty p{margin:0}
  .empty p + p{margin-top:4px}
  .more-wrap{margin-top:24px;text-align:center}
  .text-btn{
    padding:2px 0;
    border:0;
    border-bottom:1px solid var(--ink);
    background:none;
    color:var(--ink);
    font-family:var(--mono);
    font-size:11px;
    letter-spacing:.06em;
    cursor:pointer;
  }
  .ghost{
    padding:8px 13px;
    border:1px solid var(--ink);
    border-radius:0;
    background:transparent;
    color:var(--ink);
    font-family:var(--sans);
    font-size:12px;
    cursor:pointer;
    transition:background .15s,color .15s;
  }
  .ghost:hover{background:var(--ink);color:var(--paper-2)}
  .ghost:disabled{opacity:.45;cursor:default}
  .ghost.small{padding:5px 10px;font-size:11px}
  footer{
    max-width:1280px;
    margin:0 auto;
    padding:0 28px 40px;
    display:flex;
    justify-content:space-between;
    gap:16px;
    flex-wrap:wrap;
    font-family:var(--mono);
    font-size:10px;
    letter-spacing:.05em;
    color:var(--muted);
  }
  footer a{color:inherit;text-decoration:none;border-bottom:1px solid var(--rule)}
  footer a:hover{color:var(--ink);border-color:var(--ink)}
  .toast{
    position:fixed;
    left:50%;
    bottom:26px;
    z-index:20;
    max-width:calc(100vw - 32px);
    padding:10px 16px;
    background:var(--ink);
    color:var(--paper-2);
    font-size:13px;
    opacity:0;
    pointer-events:none;
    transform:translate(-50%,16px);
    transition:opacity .2s,transform .2s;
  }
  .toast.show{opacity:1;transform:translate(-50%,0)}
  :focus-visible{outline:2px solid var(--cyan);outline-offset:2px}
  @media (prefers-reduced-motion:no-preference){
    .intro,.workbench{animation:rise .7s cubic-bezier(.2,.7,.2,1) both}
    .workbench{animation-delay:.08s}
    @keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  }
  @media (max-width:860px){
    .masthead{padding:16px 18px}
    main{padding:0 18px 48px}
    .auth-wrap{padding:30px 0 10px}
    .auth-card{padding:24px}
    .intro{padding:40px 0 30px}
    .workbench{grid-template-columns:1fr}
    .easel,.sheet{padding:20px}
    .grid{grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:16px 12px}
    footer{padding:0 18px 32px}
  }
</style>
</head>
<body>
<header class="masthead">
  <a class="wordmark" href="/"><span class="spark">*</span> FLARE<span class="slash">/</span>IMAGE</a>
  <div class="mast-meta" id="userBar" hidden>
    <span class="user-name" id="userName"></span>
    <span class="role-badge" id="roleBadge"></span>
    <button id="logout" class="ghost small" type="button">退出</button>
  </div>
</header>

<main>
  <div class="boot" id="boot">正在检查登录状态…</div>

  <section class="auth-wrap" id="auth" hidden>
    <div class="auth-card">
      <p class="kicker">Cloudflare Workers / R2</p>
      <h1>登录图床</h1>
      <p class="auth-sub">使用部署时配置的管理员或用户账号。</p>
      <form id="loginForm" novalidate>
        <div class="auth-field">
          <label for="username">用户名</label>
          <input id="username" name="username" type="text" autocomplete="username" spellcheck="false" required>
        </div>
        <div class="auth-field">
          <label for="password">密码</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required>
        </div>
        <p class="auth-error" id="loginError" role="alert"></p>
        <button class="auth-btn" id="loginBtn" type="submit">登录</button>
      </form>
      <p class="auth-note">账号和密码由部署者在环境变量中配置，登录状态保存在 HttpOnly Cookie 中。</p>
    </div>
  </section>

  <div id="app" hidden>
    <section class="intro">
      <p class="kicker">Cloudflare Workers / R2</p>
      <h1>让图片变成<br>一条链接。</h1>
      <p class="lede">拖入、粘贴或选择图片。上传后得到永久链接，可以直接放进博客、文档或聊天窗口。</p>
    </section>

    <div class="workbench">
      <section class="easel" aria-labelledby="uploadHeading">
        <div class="panel-head">
          <h2 id="uploadHeading">曝光台</h2>
          <span class="lamp" id="lamp"><i aria-hidden="true"></i><span id="lampText">待机</span></span>
        </div>

        <label class="drop" id="drop" for="fileInput" tabindex="0" role="button" aria-label="选择或拖入图片">
          <input id="fileInput" type="file" accept="image/*" multiple>
          <span class="drop-icon" aria-hidden="true">+</span>
          <span class="drop-title">拖入图片，或点击选择</span>
          <span class="drop-hint">也可以直接按 Ctrl / ⌘ + V 粘贴截图</span>
          <span class="drop-formats">JPG · PNG · GIF · WEBP · AVIF · SVG · BMP · ICO · TIFF · HEIC</span>
        </label>

        <div class="progress" id="progress" hidden>
          <span id="progressText">上传中</span>
          <span class="progress-bar"><i id="progressBar"></i></span>
        </div>
      </section>

      <section class="sheet" aria-labelledby="sheetHeading">
        <div class="sheet-head">
          <div>
            <h2 id="sheetHeading">图片列表</h2>
            <p class="sheet-sub" id="sheetSub">正在载入</p>
          </div>
          <button id="refresh" class="ghost" type="button">刷新</button>
        </div>

        <div class="grid" id="grid"></div>
        <div class="empty" id="empty">
          <p>还没有图片。</p>
          <p>上传第一张后，链接会出现在这里。</p>
        </div>
        <div class="more-wrap" id="moreWrap" hidden>
          <button id="more" class="text-btn" type="button">加载更多</button>
        </div>
      </section>
    </div>
  </div>
</main>

<footer>
  <span>图片存储于 R2 · 读取经 Worker 缓存</span>
  <span><a href="/api">API</a> · <a href="/health">状态</a> · flare-image</span>
</footer>

<div class="toast" id="toast" role="status" aria-live="polite"></div>

<script>
(function () {
  "use strict";

  var boot = document.getElementById("boot");
  var auth = document.getElementById("auth");
  var app = document.getElementById("app");
  var userBar = document.getElementById("userBar");
  var userName = document.getElementById("userName");
  var roleBadge = document.getElementById("roleBadge");
  var logoutBtn = document.getElementById("logout");
  var loginForm = document.getElementById("loginForm");
  var loginBtn = document.getElementById("loginBtn");
  var loginError = document.getElementById("loginError");
  var usernameInput = document.getElementById("username");
  var passwordInput = document.getElementById("password");
  var drop = document.getElementById("drop");
  var fileInput = document.getElementById("fileInput");
  var progress = document.getElementById("progress");
  var progressText = document.getElementById("progressText");
  var progressBar = document.getElementById("progressBar");
  var lamp = document.getElementById("lamp");
  var lampText = document.getElementById("lampText");
  var grid = document.getElementById("grid");
  var empty = document.getElementById("empty");
  var moreWrap = document.getElementById("moreWrap");
  var moreBtn = document.getElementById("more");
  var refreshBtn = document.getElementById("refresh");
  var sheetHeading = document.getElementById("sheetHeading");
  var sheetSub = document.getElementById("sheetSub");
  var toastEl = document.getElementById("toast");
  var currentUser = null;
  var cursor = null;
  var loading = false;
  var toastTimer = null;

  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("show");
    }, 2400);
  }

  function formatBytes(bytes) {
    if (typeof bytes !== "number") return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function fileName(key) {
    var parts = key.split("/");
    return parts[parts.length - 1] || key;
  }

  function setEmptyMessage(text) {
    empty.textContent = "";
    var paragraph = document.createElement("p");
    paragraph.textContent = text;
    empty.appendChild(paragraph);
  }

  function actionButton(label, handler) {
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", handler);
    return button;
  }

  function addCard(item, prepend) {
    var figure = document.createElement("figure");
    figure.className = "frame";

    var link = document.createElement("a");
    link.className = "thumb";
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener";
    link.title = "打开原图";

    var image = document.createElement("img");
    image.src = item.url;
    image.alt = fileName(item.key);
    image.loading = "lazy";
    image.decoding = "async";
    link.appendChild(image);

    var caption = document.createElement("figcaption");
    var name = document.createElement("span");
    name.className = "name";
    var number = document.createElement("span");
    number.className = "frame-no";
    number.textContent = fileName(item.key).slice(0, 6) + " ";
    name.appendChild(number);
    name.appendChild(document.createTextNode(fileName(item.key) + " · " + formatBytes(item.size)));

    var actions = document.createElement("div");
    actions.className = "actions";
    actions.appendChild(actionButton("复制链接", function () {
      copyText(item.url);
    }));
    actions.appendChild(actionButton("Markdown", function () {
      copyText("![" + fileName(item.key) + "](" + item.url + ")");
    }));
    var removeButton = actionButton("删除", function () {
      removeItem(item, figure);
    });
    removeButton.className = "danger";
    actions.appendChild(removeButton);

    caption.appendChild(name);
    caption.appendChild(actions);
    figure.appendChild(link);
    figure.appendChild(caption);

    if (prepend && grid.firstChild) grid.insertBefore(figure, grid.firstChild);
    else grid.appendChild(figure);
    empty.hidden = true;
  }

  function copyText(text) {
    function done() {
      toast("已复制");
    }
    function fallback() {
      var area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand("copy");
        done();
      } catch (error) {
        toast("复制失败，请手动选择链接");
      }
      document.body.removeChild(area);
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  }

  function showLogin(message) {
    currentUser = null;
    boot.hidden = true;
    app.hidden = true;
    auth.hidden = false;
    userBar.hidden = true;
    grid.textContent = "";
    cursor = null;
    moreWrap.hidden = true;
    sheetSub.textContent = "请先登录";
    if (message) loginError.textContent = message;
    window.setTimeout(function () {
      usernameInput.focus();
    }, 0);
  }

  function showApp(user) {
    currentUser = user;
    boot.hidden = true;
    auth.hidden = true;
    app.hidden = false;
    userBar.hidden = false;
    loginError.textContent = "";
    userName.textContent = user.username;
    var isAdmin = user.role === "admin";
    roleBadge.textContent = isAdmin ? "管理员" : "用户";
    roleBadge.classList.toggle("admin", isAdmin);
    sheetHeading.textContent = isAdmin ? "全部图片" : "我的图片";
    loadList(true);
  }

  async function removeItem(item, element) {
    if (!window.confirm("删除这张图片？此操作不可撤销。")) return;
    try {
      var response = await fetch("/api/delete?key=" + encodeURIComponent(item.key), {
        method: "DELETE",
        credentials: "same-origin"
      });
      if (response.status === 401) {
        showLogin("登录已过期，请重新登录。");
        return;
      }
      var data = await response.json().catch(function () {
        return {};
      });
      if (!response.ok || !data.ok) {
        throw new Error(data.error || ("HTTP " + response.status));
      }
      element.remove();
      var count = grid.children.length;
      sheetSub.textContent = count === 0 ? "没有图片" : "已载入 " + count + " 张";
      if (count === 0) {
        setEmptyMessage("还没有图片。上传第一张后，链接会出现在这里。");
        empty.hidden = false;
      }
      toast("已删除");
    } catch (error) {
      toast(error.message || "删除失败");
    }
  }

  async function loadList(reset) {
    if (loading || !currentUser) return;
    loading = true;
    refreshBtn.disabled = true;
    if (reset) cursor = null;

    try {
      var query = "/api/list?limit=60";
      if (cursor) query += "&cursor=" + encodeURIComponent(cursor);
      var response = await fetch(query, { credentials: "same-origin" });
      if (response.status === 401) {
        showLogin("登录已过期，请重新登录。");
        return;
      }
      var data = await response.json().catch(function () {
        return {};
      });
      if (!response.ok || !data.ok) {
        throw new Error(data.error || ("HTTP " + response.status));
      }

      if (reset) grid.textContent = "";
      data.objects.forEach(function (object) {
        addCard(object, false);
      });
      cursor = data.cursor || null;
      moreWrap.hidden = !data.truncated;

      var count = grid.children.length;
      if (count === 0) {
        sheetSub.textContent = "没有图片";
        setEmptyMessage("还没有图片。上传第一张后，链接会出现在这里。");
        empty.hidden = false;
      } else {
        sheetSub.textContent = "已载入 " + count + " 张" + (data.truncated ? " · 还有更多" : "");
        empty.hidden = true;
      }
    } catch (error) {
      if (reset && grid.children.length === 0) {
        setEmptyMessage(error.message || "载入失败");
        empty.hidden = false;
      }
      sheetSub.textContent = "载入失败";
      moreWrap.hidden = true;
      toast(error.message || "载入失败");
    } finally {
      loading = false;
      refreshBtn.disabled = false;
    }
  }

  function setLamp(busy, text) {
    lamp.classList.toggle("busy", busy);
    lampText.textContent = text;
  }

  function showProgress(current, total) {
    if (total === 0) {
      progress.hidden = true;
      return;
    }
    progress.hidden = false;
    progressText.textContent = "上传中 · " + current + " / " + total;
    progressBar.style.width = Math.round((current / total) * 100) + "%";
  }

  function guessExtension(type) {
    var map = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/gif": ".gif",
      "image/webp": ".webp",
      "image/avif": ".avif",
      "image/svg+xml": ".svg",
      "image/bmp": ".bmp",
      "image/x-icon": ".ico",
      "image/tiff": ".tiff",
      "image/heic": ".heic"
    };
    return map[type] || ".png";
  }

  async function uploadFiles(fileList) {
    var files = Array.prototype.slice.call(fileList).filter(function (file) {
      return (file.type && file.type.indexOf("image/") === 0) ||
        /\.(jpe?g|png|gif|webp|avif|svg|bmp|ico|tiff?|heic)$/i.test(file.name || "");
    });

    if (files.length === 0) {
      toast("请选择图片文件");
      return;
    }
    if (!currentUser) {
      showLogin("请先登录。");
      return;
    }

    var uploaded = [];
    var lastError = null;
    var unauthorized = false;
    showProgress(0, files.length);
    setLamp(true, "曝光中");

    for (var i = 0; i < files.length; i++) {
      var file = files[i];
      try {
        var filename = file.name || ("paste-" + Date.now() + guessExtension(file.type));
        var response = await fetch("/api/upload?filename=" + encodeURIComponent(filename), {
          method: "PUT",
          credentials: "same-origin",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file
        });
        if (response.status === 401) {
          unauthorized = true;
          break;
        }
        var data = await response.json().catch(function () {
          return {};
        });
        if (!response.ok || !data.ok) {
          throw new Error(data.error || ("HTTP " + response.status));
        }
        uploaded.push(data);
      } catch (error) {
        lastError = error;
      }
      showProgress(i + 1, files.length);
    }

    progress.hidden = true;
    setLamp(false, "待机");

    uploaded.reverse().forEach(function (item) {
      addCard(item, true);
    });

    if (unauthorized) {
      showLogin("登录已过期，请重新登录。");
      return;
    }
    if (lastError) {
      toast((uploaded.length > 0 ? "部分图片上传失败：" : "上传失败：") + (lastError.message || "未知错误"));
    } else {
      toast(uploaded.length + " 张图片已上传");
    }

    if (uploaded.length > 0) {
      var count = grid.children.length;
      sheetSub.textContent = "已载入 " + count + " 张";
      await loadList(true);
    }
  }

  async function checkSession() {
    try {
      var response = await fetch("/api/me", { credentials: "same-origin" });
      if (response.ok) {
        var data = await response.json();
        if (data && data.ok && data.user) {
          showApp(data.user);
          return;
        }
      }
    } catch (error) {
      /* 网络错误时回退到登录页 */
    }
    showLogin();
  }

  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    loginError.textContent = "";
    var username = usernameInput.value.trim();
    var password = passwordInput.value;
    if (!username || !password) {
      loginError.textContent = "请输入用户名和密码。";
      return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = "登录中…";
    try {
      var response = await fetch("/api/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username, password: password })
      });
      var data = await response.json().catch(function () {
        return {};
      });
      if (!response.ok || !data.ok) {
        if (data.code === "AUTH_NOT_CONFIGURED") {
          throw new Error("服务器尚未配置账号，请设置 ADMIN_USERNAME/ADMIN_PASSWORD 或 USER_USERNAME/USER_PASSWORD。");
        }
        if (response.status === 401) {
          throw new Error("用户名或密码错误。");
        }
        throw new Error(data.error || "登录失败");
      }
      passwordInput.value = "";
      showApp(data.user);
      toast("已登录");
    } catch (error) {
      loginError.textContent = error.message || "登录失败";
      passwordInput.focus();
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = "登录";
    }
  });

  logoutBtn.addEventListener("click", async function () {
    logoutBtn.disabled = true;
    try {
      await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
    } catch (error) {
      /* 即使请求失败也回到登录页 */
    }
    logoutBtn.disabled = false;
    showLogin();
    toast("已退出");
  });

  drop.addEventListener("keydown", function (event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInput.click();
    }
  });

  drop.addEventListener("dragenter", function (event) {
    event.preventDefault();
    drop.classList.add("drag");
  });
  drop.addEventListener("dragover", function (event) {
    event.preventDefault();
    drop.classList.add("drag");
  });
  drop.addEventListener("dragleave", function () {
    drop.classList.remove("drag");
  });

  document.addEventListener("dragover", function (event) {
    event.preventDefault();
  });

  document.addEventListener("drop", function (event) {
    event.preventDefault();
    drop.classList.remove("drag");
    if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length) {
      uploadFiles(event.dataTransfer.files);
    }
  });

  document.addEventListener("paste", function (event) {
    if (!event.clipboardData) return;
    var files = [];
    if (event.clipboardData.files && event.clipboardData.files.length) {
      files = Array.prototype.slice.call(event.clipboardData.files);
    } else if (event.clipboardData.items) {
      for (var i = 0; i < event.clipboardData.items.length; i++) {
        var item = event.clipboardData.items[i];
        if (item.kind === "file") {
          var file = item.getAsFile();
          if (file) files.push(file);
        }
      }
    }
    if (files.length > 0) {
      event.preventDefault();
      uploadFiles(files);
    }
  });

  fileInput.addEventListener("change", function () {
    if (fileInput.files && fileInput.files.length) uploadFiles(fileInput.files);
    fileInput.value = "";
  });

  refreshBtn.addEventListener("click", function () {
    loadList(true);
  });

  moreBtn.addEventListener("click", function () {
    loadList(false);
  });

  checkSession();
})();
</script>
</body>
</html>`;
