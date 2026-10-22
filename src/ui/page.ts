import { DASHBOARD_SCRIPT } from "./client";
import { DASHBOARD_STYLES } from "./styles";

export const DASHBOARD_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="description" content="基于 Cloudflare Workers 与 R2 的私有图床">
<meta name="theme-color" content="#0b1618">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%23ff4d00'/%3E%3Ctext x='32' y='47' font-family='Helvetica,Arial,sans-serif' font-size='50' font-weight='700' text-anchor='middle' fill='%230b1618'%3E*%3C/text%3E%3C/svg%3E">
<title>flare/image · 图床</title>
<style>${DASHBOARD_STYLES}</style>
</head>
<body>
<a class="skip" href="#main">跳到主要内容</a>

<header class="topbar">
  <a class="brand" href="/" aria-label="flare/image 首页">
    <span class="brand-mark" aria-hidden="true">*</span>
    <span class="brand-name">flare<span>/</span>image</span>
  </a>
  <div class="topbar-right">
    <span class="status" id="status" data-tone="idle" aria-live="polite">
      <i aria-hidden="true"></i>
      <span id="statusText">等待登录</span>
    </span>
    <div class="account" id="userBar" hidden>
      <span id="userName"></span>
      <span class="role" id="roleBadge"></span>
      <button class="btn-quiet" id="logout" type="button">退出</button>
    </div>
  </div>
</header>

<main id="main">
  <div class="boot" id="boot">正在检查登录状态…</div>

  <section class="login" id="auth" hidden>
    <div class="login-poster">
      <div class="poster-top">
        <p class="poster-kicker">私有图床 / Cloudflare R2</p>
        <h1>图片进来，链接出去。</h1>
      </div>
      <div class="contact-sheet" aria-hidden="true">
        <span class="sheet-cell cell-1" data-frame="01"></span>
        <span class="sheet-cell cell-2" data-frame="02"></span>
        <span class="sheet-cell cell-3" data-frame="03"></span>
        <span class="sheet-cell cell-4" data-frame="04"></span>
        <span class="sheet-cell cell-5" data-frame="05"></span>
        <span class="sheet-cell cell-6" data-frame="06"></span>
      </div>
      <p class="poster-foot">拖入、粘贴或选择图片。上传后得到一条稳定链接，可以直接放进博客、文档或聊天窗口。</p>
    </div>
    <div class="login-panel">
      <div class="login-card">
        <h2>登录</h2>
        <p class="login-sub">使用管理员或用户账号。登录状态保存在 HttpOnly Cookie 中。</p>
        <form id="loginForm" novalidate>
          <div class="field">
            <label for="username">用户名</label>
            <input id="username" name="username" type="text" autocomplete="username" spellcheck="false" required>
          </div>
          <div class="field">
            <label for="password">密码</label>
            <input id="password" name="password" type="password" autocomplete="current-password" required>
          </div>
          <p class="auth-error" id="loginError" role="alert"></p>
          <button class="login-btn" id="loginBtn" type="submit">登录</button>
        </form>
        <p class="login-note">API 客户端可以直接使用 HTTP Basic Auth，例如 curl -u username:password。</p>
      </div>
    </div>
  </section>

  <section class="workspace" id="app" hidden>
    <aside class="rail">
      <div class="rail-head">
        <h1>放进一张图片</h1>
        <p class="rail-sub">拖入、粘贴，或点击选择。上传完成后直接复制链接。</p>
      </div>

      <label class="drop" id="drop" for="fileInput" tabindex="0" role="button" aria-label="选择或拖入图片">
        <input id="fileInput" type="file" accept="image/*" multiple>
        <span class="drop-plus" aria-hidden="true">+</span>
        <span class="drop-title">拖到这里</span>
        <span class="drop-hint">或点击选择文件</span>
        <span class="drop-formats">JPG, PNG, GIF, WEBP, AVIF, SVG, BMP, ICO, TIFF, HEIC</span>
      </label>

      <div class="progress" id="progress" hidden>
        <div class="progress-head">
          <span id="progressText">上传中</span>
          <span id="progressCount"></span>
        </div>
        <div class="progress-track" id="progressBar" role="progressbar" aria-label="上传进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <i id="progressFill"></i>
        </div>
      </div>

      <div class="rail-meta">
        <div><span>账号</span><strong id="railUser"></strong></div>
        <div><span>权限</span><strong id="railScope"></strong></div>
        <div><span>粘贴</span><strong>Ctrl / ⌘ + V</strong></div>
      </div>
    </aside>

    <section class="gallery" aria-labelledby="sheetHeading">
      <header class="gallery-head">
        <div>
          <h2 id="sheetHeading">全部图片</h2>
          <p class="sheet-sub" id="sheetSub">正在载入</p>
        </div>
        <button id="refresh" class="btn" type="button">刷新</button>
      </header>

      <div class="grid" id="grid"></div>

      <div class="empty" id="empty">
        <div class="empty-frame" aria-hidden="true"><span>+</span></div>
        <p>还没有图片</p>
        <p>从左边放入第一张图片，链接会出现在这里。</p>
      </div>

      <div class="more-wrap" id="moreWrap" hidden>
        <button id="more" class="btn-wide" type="button">加载更多</button>
      </div>
    </section>
  </section>
</main>

<footer class="footer">
  <span>R2 存储 · Worker 边缘缓存</span>
  <span><a href="/api">API</a><a href="/health">状态</a></span>
</footer>

<div class="toast" id="toast" role="status" aria-live="polite"></div>

<div class="lightbox" id="lightbox" role="dialog" aria-modal="true" aria-labelledby="lightboxName" hidden>
  <div class="lightbox-shell">
    <header class="lightbox-head">
      <div class="lightbox-title">
        <span class="lightbox-name" id="lightboxName"></span>
        <span class="lightbox-meta" id="lightboxMeta"></span>
      </div>
      <div class="lightbox-tools">
        <button id="lightboxCopy" type="button">复制链接</button>
        <a id="lightboxOpen" href="#" target="_blank" rel="noopener">原图</a>
        <a id="lightboxDownload" href="#" download>下载</a>
        <button class="lightbox-close" id="lightboxClose" type="button" aria-label="关闭预览">关闭</button>
      </div>
    </header>
    <div class="lightbox-stage">
      <button class="lightbox-nav prev" id="lightboxPrev" type="button" aria-label="上一张">‹</button>
      <img id="lightboxImage" alt="">
      <span class="lightbox-loading" id="lightboxLoading">载入中…</span>
      <button class="lightbox-nav next" id="lightboxNext" type="button" aria-label="下一张">›</button>
    </div>
    <footer class="lightbox-foot">
      <span>← → 切换 · Esc 关闭</span>
      <span id="lightboxCount"></span>
    </footer>
  </div>
</div>

<script>${DASHBOARD_SCRIPT}</script>
</body>
</html>`;
