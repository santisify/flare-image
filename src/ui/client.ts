export const DASHBOARD_SCRIPT = `
(function () {
  "use strict";

  var boot = document.getElementById("boot");
  var auth = document.getElementById("auth");
  var app = document.getElementById("app");
  var userBar = document.getElementById("userBar");
  var userName = document.getElementById("userName");
  var roleBadge = document.getElementById("roleBadge");
  var logoutBtn = document.getElementById("logout");
  var statusEl = document.getElementById("status");
  var statusText = document.getElementById("statusText");
  var loginForm = document.getElementById("loginForm");
  var loginBtn = document.getElementById("loginBtn");
  var loginError = document.getElementById("loginError");
  var usernameInput = document.getElementById("username");
  var passwordInput = document.getElementById("password");
  var drop = document.getElementById("drop");
  var fileInput = document.getElementById("fileInput");
  var progress = document.getElementById("progress");
  var progressText = document.getElementById("progressText");
  var progressCount = document.getElementById("progressCount");
  var progressBar = document.getElementById("progressBar");
  var progressFill = document.getElementById("progressFill");
  var grid = document.getElementById("grid");
  var empty = document.getElementById("empty");
  var moreWrap = document.getElementById("moreWrap");
  var moreBtn = document.getElementById("more");
  var refreshBtn = document.getElementById("refresh");
  var sheetHeading = document.getElementById("sheetHeading");
  var sheetSub = document.getElementById("sheetSub");
  var railUser = document.getElementById("railUser");
  var railScope = document.getElementById("railScope");
  var toastEl = document.getElementById("toast");

  var currentUser = null;
  var cursor = null;
  var hasMore = false;
  var rendered = new Set();
  var loading = false;
  var uploading = false;
  var toastTimer = null;

  function setStatus(text, tone) {
    statusText.textContent = text;
    statusEl.setAttribute("data-tone", tone || "idle");
  }

  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("show");
    }, 2600);
  }

  function formatBytes(bytes) {
    if (typeof bytes !== "number") return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function formatDate(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    var month = String(date.getMonth() + 1).padStart(2, "0");
    var day = String(date.getDate()).padStart(2, "0");
    return date.getFullYear() + "-" + month + "-" + day;
  }

  function fileName(key) {
    var parts = key.split("/");
    return parts[parts.length - 1] || key;
  }

  function extensionOf(key) {
    var name = fileName(key);
    var dot = name.lastIndexOf(".");
    return dot === -1 ? "img" : name.slice(dot + 1);
  }

  function setEmptyMessage(primary, secondary) {
    var paragraphs = empty.querySelectorAll("p");
    if (paragraphs[0]) paragraphs[0].textContent = primary;
    if (paragraphs[1]) paragraphs[1].textContent = secondary;
  }

  function refreshCount() {
    var count = grid.children.length;
    if (count === 0) {
      sheetSub.textContent = "没有图片";
      setEmptyMessage("还没有图片", "从左边放入第一张图片，链接会出现在这里。");
      empty.hidden = false;
      moreWrap.hidden = true;
      return;
    }
    sheetSub.textContent = "已载入 " + count + " 张" + (hasMore ? " · 还有更多" : "");
    empty.hidden = true;
    moreWrap.hidden = !hasMore;
  }

  function actionButton(label, handler, danger) {
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    if (danger) button.className = "danger";
    button.addEventListener("click", handler);
    return button;
  }

  function addCard(item, prepend) {
    if (rendered.has(item.key)) return;
    rendered.add(item.key);

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

    var ext = document.createElement("span");
    ext.className = "ext";
    ext.textContent = extensionOf(item.key);

    link.appendChild(image);
    link.appendChild(ext);

    var caption = document.createElement("figcaption");
    var name = document.createElement("span");
    name.className = "name";
    name.textContent = fileName(item.key);
    name.title = item.key;

    var subline = document.createElement("div");
    subline.className = "subline";
    var size = document.createElement("span");
    size.textContent = formatBytes(item.size);
    var date = document.createElement("span");
    date.textContent = formatDate(item.uploaded);
    subline.appendChild(size);
    subline.appendChild(date);

    var actions = document.createElement("div");
    actions.className = "actions";
    actions.appendChild(actionButton("链接", function () {
      copyText(item.url);
    }));
    actions.appendChild(actionButton("Markdown", function () {
      copyText("![" + fileName(item.key) + "](" + item.url + ")");
    }));
    actions.appendChild(actionButton("下载", function () {
      var anchor = document.createElement("a");
      anchor.href = item.url + (item.url.indexOf("?") === -1 ? "?" : "&") + "download=1";
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }));
    actions.appendChild(actionButton("删除", function () {
      removeItem(item, figure);
    }, true));

    caption.appendChild(name);
    caption.appendChild(subline);
    caption.appendChild(actions);
    figure.appendChild(link);
    figure.appendChild(caption);

    if (prepend && grid.firstChild) grid.insertBefore(figure, grid.firstChild);
    else grid.appendChild(figure);
    empty.hidden = true;
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        var area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        document.body.removeChild(area);
      }
      toast("已复制");
    } catch (error) {
      toast("复制失败，请手动选择链接");
    }
  }

  function showLogin(message) {
    currentUser = null;
    cursor = null;
    hasMore = false;
    loading = false;
    uploading = false;
    boot.hidden = true;
    app.hidden = true;
    auth.hidden = false;
    userBar.hidden = true;
    grid.textContent = "";
    rendered.clear();
    moreWrap.hidden = true;
    progress.hidden = true;
    railUser.textContent = "";
    railScope.textContent = "";
    sheetHeading.textContent = "全部图片";
    sheetSub.textContent = "请先登录";
    setStatus("等待登录", "idle");
    loginError.textContent = message || "";
    setTimeout(function () {
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
    var isAdmin = user.role === "admin";
    userName.textContent = user.username;
    roleBadge.textContent = isAdmin ? "管理员" : "用户";
    roleBadge.classList.toggle("admin", isAdmin);
    railUser.textContent = user.username;
    railScope.textContent = isAdmin ? "全部图片" : "自己的图片";
    sheetHeading.textContent = isAdmin ? "全部图片" : "我的图片";
    setStatus("已连接", "ok");
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
      rendered.delete(item.key);
      if (grid.children.length === 0 && hasMore && currentUser) {
        loadList(false);
      } else {
        refreshCount();
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
    refreshBtn.textContent = "载入中";
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

      if (reset) {
        grid.textContent = "";
        rendered.clear();
      }
      data.objects.forEach(function (object) {
        addCard(object, false);
      });
      cursor = data.cursor || null;
      hasMore = Boolean(data.truncated);
      refreshCount();
      setStatus("已连接", "ok");
    } catch (error) {
      if (reset && grid.children.length === 0) {
        setEmptyMessage("载入失败", error.message || "请稍后重试");
        empty.hidden = false;
      }
      sheetSub.textContent = "载入失败";
      moreWrap.hidden = true;
      setStatus("连接异常", "error");
      toast(error.message || "载入失败");
    } finally {
      loading = false;
      refreshBtn.disabled = false;
      refreshBtn.textContent = "刷新";
    }
  }

  function showProgress(current, total) {
    var percent = total === 0 ? 0 : Math.round((current / total) * 100);
    progress.hidden = false;
    progressCount.textContent = current + " / " + total;
    progressFill.style.width = percent + "%";
    progressBar.setAttribute("aria-valuenow", String(percent));
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
        /\\.(jpe?g|png|gif|webp|avif|svg|bmp|ico|tiff?|heic)$/i.test(file.name || "");
    });

    if (files.length === 0) {
      toast("请选择图片文件");
      return;
    }
    if (!currentUser) {
      showLogin("请先登录。");
      return;
    }
    if (uploading) return;

    uploading = true;
    var uploaded = [];
    var lastError = null;
    var unauthorized = false;
    drop.classList.add("busy");
    setStatus("上传中", "busy");
    showProgress(0, files.length);

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
    progressFill.style.width = "0%";
    progressBar.setAttribute("aria-valuenow", "0");
    drop.classList.remove("busy");
    uploading = false;

    uploaded.forEach(function (item) {
      addCard(item, true);
    });
    refreshCount();

    if (unauthorized) {
      showLogin("登录已过期，请重新登录。");
      return;
    }

    if (lastError) {
      setStatus(uploaded.length > 0 ? "部分失败" : "上传失败", "error");
      toast((uploaded.length > 0 ? "部分图片上传失败：" : "上传失败：") + (lastError.message || "未知错误"));
      return;
    }

    setStatus("已连接", "ok");
    toast(uploaded.length + " 张图片已上传");
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
      } else {
        var failure = await response.json().catch(function () {
          return {};
        });
        if (failure.code === "AUTH_NOT_CONFIGURED") {
          showLogin("服务器尚未配置账号，请设置 ADMIN_USERNAME/ADMIN_PASSWORD 或 USER_USERNAME/USER_PASSWORD。");
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
`;
