/* Edit mode for /start-edit and /start2-edit.
   Drag to reposition. Hover an icon for the menu. edits complete writes start.html or start2. */
(function () {
  var s = document.currentScript;
  var FILE = s.getAttribute("data-file");
  var HOME = s.getAttribute("data-home") || "/start";
  var REPO = "https://api.github.com/repos/SF2021-dev/spades/contents/";
  var dragging = null, clone = null, ox = 0, oy = 0, startX = 0, startY = 0, moved = false;
  var THRESH = 6;
  var menu, modal, fileInput, pasteOn = null;

  function css() {
    var tag = document.createElement("style");
    tag.textContent = [
      "body.icon-edit .icons-area { top: 126px; }",
      ".edits-complete { position:absolute; top:82px; left:0; right:290px; margin:0 auto; width:max-content; z-index:40;",
      "  background:#fbe646; color:#1a1200; border:0; border-radius:8px; font-weight:800; font-size:16px; padding:8px 16px; cursor:pointer; }",
      ".edits-complete:disabled { opacity:0.6; cursor:wait; }",
      ".icon-sq { position:relative; }",
      ".icon-dots { display:none; position:absolute; top:2px; right:2px; width:18px; height:22px; padding:0; border:0; border-radius:4px;",
      "  background:rgba(0,0,0,0.78); color:#fff; font-size:16px; line-height:22px; text-align:center; cursor:pointer; z-index:5; }",
      ".icon-sq:hover .icon-dots, .icon-sq.menu-open .icon-dots { display:block; }",
      ".icon-menu { position:fixed; z-index:80; display:none; flex-direction:column; min-width:110px; background:#1a1200; border:1px solid #fbe646; border-radius:8px; overflow:hidden; }",
      ".icon-menu button { background:transparent; color:#fbe646; border:0; text-align:left; padding:8px 12px; cursor:pointer; font:600 15px Inter,sans-serif; }",
      ".icon-menu button:hover { background:rgba(251,230,70,0.16); }",
      ".icon-pick { position:fixed; inset:0; z-index:90; background:rgba(0,0,0,0.55); display:flex; align-items:center; justify-content:center; }",
      ".icon-pick .box { background:#1a1200; border:1px solid #fbe646; border-radius:12px; padding:18px 18px 14px; width:280px; color:#fbe646; font:600 15px Inter,sans-serif; }",
      ".icon-pick p { margin:0 0 12px; }",
      ".icon-pick button { display:block; width:100%; margin:8px 0 0; background:#fbe646; color:#1a1200; border:0; border-radius:8px; font-weight:800; font-size:15px; padding:8px 10px; cursor:pointer; }",
      ".icon-pick .cancel { background:transparent; color:#fbe646; border:1px solid #fbe646; }",
      ".new-icon { margin-top:8px; background:transparent; color:#fbe646; border:1px solid #fbe646; border-radius:8px; font-weight:800; font-size:15px; padding:8px 14px; cursor:pointer; }"
    ].join("\n");
    document.head.appendChild(tag);
  }

  function sortShortRows() {
    var area = document.querySelector(".icons-area");
    if (!area) return;
    var anchor = area.querySelector(".new-icon");
    Array.prototype.slice.call(area.querySelectorAll(".icon-row")).sort(function (a, b) {
      return a.querySelectorAll(".icon-sq").length - b.querySelectorAll(".icon-sq").length;
    }).forEach(function (row) {
      if (anchor) area.insertBefore(row, anchor);
      else area.appendChild(row);
    });
  }

  function placeNew(url, dataUrl, title) {
    var area = document.querySelector(".icons-area");
    var rows = Array.prototype.slice.call(area.querySelectorAll(".icon-row"));
    var row = rows[0];
    if (!row) {
      row = document.createElement("div");
      row.className = "icon-row";
      var anchor = area.querySelector(".new-icon");
      if (anchor) area.insertBefore(row, anchor);
      else area.appendChild(row);
    } else {
      rows.forEach(function (r) {
        if (r.querySelectorAll(".icon-sq").length < row.querySelectorAll(".icon-sq").length) row = r;
      });
    }
    var a = document.createElement("a");
    a.className = "icon-sq";
    a.href = url;
    a.title = title || "";
    var img = document.createElement("img");
    img.src = dataUrl;
    img.alt = title || "";
    a.appendChild(img);
    row.appendChild(a);
    arm(a);
    sortShortRows();
  }

  function closeMenu() {
    if (menu) menu.style.display = "none";
    Array.prototype.forEach.call(document.querySelectorAll(".icon-sq.menu-open"), function (n) { n.classList.remove("menu-open"); });
  }

  function arm(icon) {
    if (icon.querySelector(".icon-dots")) return;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "icon-dots";
    b.setAttribute("aria-label", "Menu");
    b.textContent = "\u22EE";
    b.addEventListener("mousedown", function (e) { e.preventDefault(); e.stopPropagation(); });
    b.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var open = menu.style.display === "flex" && menu._icon === icon;
      closeMenu();
      if (open) return;
      var r = b.getBoundingClientRect();
      menu.style.display = "flex";
      menu.style.left = Math.max(8, r.right - 110) + "px";
      menu.style.top = (r.bottom + 4) + "px";
      menu._icon = icon;
      icon.classList.add("menu-open");
    });
    icon.appendChild(b);
  }

  function cleanup() {
    if (dragging) dragging.style.opacity = "";
    if (clone) { clone.remove(); clone = null; }
    dragging = null;
    moved = false;
  }

  function onMove(e) {
    if (!dragging) return;
    var dx = e.clientX - startX, dy = e.clientY - startY;
    if (!moved && (dx * dx + dy * dy) < THRESH * THRESH) return;
    if (!moved) {
      moved = true;
      closeMenu();
      var r = dragging.getBoundingClientRect();
      ox = startX - r.left;
      oy = startY - r.top;
      clone = dragging.cloneNode(true);
      clone.style.cssText = "position:fixed;left:" + r.left + "px;top:" + r.top + "px;width:" + r.width + "px;height:" + r.height + "px;z-index:9999;pointer-events:none;opacity:0.9;margin:0;";
      document.body.appendChild(clone);
      dragging.style.opacity = "0.3";
    }
    clone.style.left = (e.clientX - ox) + "px";
    clone.style.top = (e.clientY - oy) + "px";
  }

  function hit(x, y) {
    var list = Array.prototype.slice.call(document.querySelectorAll(".icon-sq")).filter(function (n) { return n !== dragging; });
    var i, r;
    for (i = 0; i < list.length; i++) {
      r = list[i].getBoundingClientRect();
      if (y < r.top - 12 || y > r.bottom + 12) continue;
      var mid = r.left + r.width / 2;
      if (x >= r.left + 8 && x <= r.right - 8) return { type: "swap", icon: list[i] };
      if (x >= r.left - 24 && x < mid) {
        var prev = list[i].previousElementSibling;
        if (prev && prev.classList.contains("icon-sq") && prev !== dragging) return { type: "between", left: prev, right: list[i] };
        return { type: "swap", icon: list[i] };
      }
      if (x > mid && x <= r.right + 24) {
        var next = list[i].nextElementSibling;
        if (next && next.classList.contains("icon-sq") && next !== dragging) return { type: "between", left: list[i], right: next };
        return { type: "swap", icon: list[i] };
      }
    }
    var rows = document.querySelectorAll(".icon-row");
    for (i = 0; i < rows.length; i++) {
      var kids = Array.prototype.filter.call(rows[i].children, function (k) {
        return k.classList && k.classList.contains("icon-sq") && k !== dragging;
      });
      for (var j = 0; j < kids.length - 1; j++) {
        var a = kids[j].getBoundingClientRect();
        var b = kids[j + 1].getBoundingClientRect();
        if (y < a.top - 12 || y > a.bottom + 12) continue;
        if (x > a.right - 6 && x < b.left + 6) return { type: "between", left: kids[j], right: kids[j + 1] };
      }
    }
    return null;
  }

  function insertBetween(left, right) {
    var row = right.parentNode;
    var last = row.lastElementChild;
    while (last && !last.classList.contains("icon-sq")) last = last.previousElementSibling;
    var oldParent = dragging.parentNode;
    var oldNext = dragging.nextSibling;
    if (last && last !== dragging && last !== left && last !== right) {
      dragging.remove();
      if (oldNext && oldNext.parentNode === oldParent) oldParent.insertBefore(last, oldNext);
      else oldParent.appendChild(last);
    }
    row.insertBefore(dragging, right);
  }

  function onUp(e) {
    if (!dragging) return;
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    if (moved) {
      var place = hit(e.clientX, e.clientY);
      if (place) {
        if (place.type === "swap") {
          var icon = dragging, other = place.icon;
          var p1 = icon.parentNode, n1 = icon.nextSibling;
          var p2 = other.parentNode, n2 = other.nextSibling;
          if (n1 === other) p1.insertBefore(other, icon);
          else if (n2 === icon) p2.insertBefore(icon, other);
          else { p1.insertBefore(other, n1); p2.insertBefore(icon, n2); }
        } else insertBetween(place.left, place.right);
        sortShortRows();
      }
    }
    cleanup();
  }

  function blobToIcon(blob) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        var c = document.createElement("canvas");
        c.width = 128; c.height = 128;
        var ctx = c.getContext("2d");
        var scale = Math.min(128 / img.width, 128 / img.height);
        var w = img.width * scale, h = img.height * scale;
        ctx.clearRect(0, 0, 128, 128);
        ctx.drawImage(img, (128 - w) / 2, (128 - h) / 2, w, h);
        resolve(c.toDataURL("image/png"));
      };
      img.onerror = function () { reject(new Error("Could not read that image.")); };
      img.src = URL.createObjectURL(blob);
    });
  }

  function chooseImage() {
    return new Promise(function (resolve) {
      var box = document.createElement("div");
      box.className = "icon-pick";
      box.innerHTML = '<div class="box"><p>Icon image</p><button type="button" data-a="up">upload image</button><button type="button" data-a="paste">paste image</button><p data-note style="font-weight:500;font-size:13px;min-height:1.2em;"></p><button type="button" class="cancel" data-a="cancel">cancel</button></div>';
      document.body.appendChild(box);
      modal = box;
      var note = box.querySelector("[data-note]");
      function finish(url) { window.removeEventListener("paste", onPaste); box.remove(); modal = null; resolve(url || ""); }
      function onPaste(e) {
        var items = (e.clipboardData && e.clipboardData.items) || [];
        for (var i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") === 0) {
            e.preventDefault();
            blobToIcon(items[i].getAsFile()).then(finish).catch(function (err) { note.textContent = err.message; });
            return;
          }
        }
        note.textContent = "Copy the picture itself, then press Ctrl+V.";
      }
      window.addEventListener("paste", onPaste);
      box.addEventListener("click", function (e) {
        var act = e.target.getAttribute && e.target.getAttribute("data-a");
        if (act === "cancel" || e.target === box) finish("");
        else if (act === "up") fileInput.click();
        else if (act === "paste") { note.textContent = "Press Ctrl+V."; }
      });
      pasteOn = finish;
    });
  }

  function editIcon(icon) {
    var current = icon.getAttribute("href") || "https://";
    var url = prompt("URL", current);
    if (!url) return;
    url = url.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    chooseImage().then(function (dataUrl) {
      if (!dataUrl) return;
      icon.setAttribute("href", url);
      var img = icon.querySelector("img");
      if (!img) {
        img = document.createElement("img");
        icon.insertBefore(img, icon.firstChild);
      }
      img.src = dataUrl;
      var name = "";
      try { name = new URL(url).hostname.replace(/^www\./, ""); } catch (e) {}
      if (name) { icon.title = name; img.alt = name; }
    });
  }

  function deleteIcon(icon) {
    var row = icon.parentNode;
    icon.remove();
    if (row && !row.querySelector(".icon-sq")) row.remove();
    sortShortRows();
  }

  function token() {
    var t = localStorage.getItem("ds-gh-token");
    if (!t) t = prompt("Paste a GitHub token that can update SF2021-dev/spades. It stays in this browser only.");
    if (!t) throw new Error("A GitHub token is needed to save.");
    t = t.trim();
    localStorage.setItem("ds-gh-token", t);
    return t;
  }

  function headers() {
    return { Authorization: "Bearer " + token(), Accept: "application/vnd.github+json", "Content-Type": "application/json" };
  }

  function toB64(str) {
    var bytes = new TextEncoder().encode(str), bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function fromB64(b64) {
    var bin = atob(String(b64).replace(/\s/g, ""));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function esc(v) {
    return String(v == null ? "" : v).replace(/&/g, "\u0026amp;").replace(/"/g, "\u0026quot;").replace(/</g, "\u0026lt;");
  }

  async function put(path, b64, message) {
    var h = headers();
    var got = await fetch(REPO + path, { headers: h });
    if (got.status === 401 || got.status === 403) {
      localStorage.removeItem("ds-gh-token");
      throw new Error("GitHub refused the token. Click edits complete and paste it again.");
    }
    var sha = got.status === 200 ? (await got.json()).sha : null;
    var body = { message: message, content: b64, branch: "main" };
    if (sha) body.sha = sha;
    var res = await fetch(REPO + path, { method: "PUT", headers: h, body: JSON.stringify(body) });
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem("ds-gh-token");
      throw new Error("GitHub refused the token. Click edits complete and paste it again.");
    }
    if (!res.ok) throw new Error("Save failed (" + res.status + ").");
  }

  function rowsHtml() {
    var html = "";
    Array.prototype.forEach.call(document.querySelectorAll(".icon-row"), function (row) {
      var icons = row.querySelectorAll(".icon-sq");
      if (!icons.length) return;
      html += "        <div class=\"icon-row\">\n";
      Array.prototype.forEach.call(icons, function (a) {
        var img = a.querySelector("img");
        var src = img ? (img.getAttribute("src") || "") : "";
        var title = a.getAttribute("title") || "";
        html += "            <a class=\"icon-sq\" href=\"" + esc(a.getAttribute("href") || "") + "\" title=\"" + esc(title) + "\"><img src=\"" + esc(src) + "\" alt=\"" + esc(title) + "\"></a>\n";
      });
      html += "        </div>\n";
    });
    return html;
  }

  function spliceArea(html, inner) {
    var key = '<div class="icons-area">';
    var start = html.indexOf(key);
    if (start < 0) throw new Error("Could not find the icons on the saved page.");
    var i = start + key.length, depth = 1;
    while (i < html.length && depth) {
      var open = html.indexOf("<div", i);
      var close = html.indexOf("</div>", i);
      if (close < 0) throw new Error("The icons section is broken.");
      if (open !== -1 && open < close) { depth++; i = open + 4; }
      else { depth--; i = close + 6; }
    }
    return html.slice(0, start) + key + "\n" + inner + "    </div>" + html.slice(i);
  }

  async function save() {
    var imgs = document.querySelectorAll(".icon-sq img");
    for (var n = 0; n < imgs.length; n++) {
      var src = imgs[n].getAttribute("src") || imgs[n].src || "";
      if (src.indexOf("data:") !== 0) continue;
      var path = "icons/e" + Date.now().toString(36) + n + ".png";
      await put(path, src.split(",")[1], "Add start icon");
      imgs[n].setAttribute("src", "/" + path);
    }
    var h = headers();
    var got = await fetch(REPO + FILE, { headers: h });
    if (!got.ok) throw new Error("Could not read the page on GitHub (" + got.status + ").");
    var data = await got.json();
    var next = spliceArea(fromB64(data.content), rowsHtml());
    await put(FILE, toB64(next), "Update icons");
  }

  function setup() {
    document.body.classList.add("icon-edit");
    Array.prototype.forEach.call(document.querySelectorAll(".icon-sq"), arm);
    var area = document.querySelector(".icons-area");
    if (area) area.addEventListener("click", function (e) {
      if (e.target.closest(".icon-sq")) e.preventDefault();
    });
    document.addEventListener("mousedown", function (e) {
      if (e.button !== 0) return;
      if (e.target.closest(".icon-dots, .icon-menu, .edits-complete, .icon-pick")) return;
      var icon = e.target.closest(".icon-sq");
      if (!icon) return;
      e.preventDefault();
      dragging = icon;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    });
    window.addEventListener("blur", cleanup);
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".icon-dots, .icon-menu")) closeMenu();
    });
    menu.addEventListener("click", function (e) {
      var act = e.target.getAttribute && e.target.getAttribute("data-act");
      var icon = menu._icon;
      closeMenu();
      if (!icon) return;
      if (act === "delete") deleteIcon(icon);
      if (act === "edit") editIcon(icon);
    });
    var done = document.createElement("button");
    done.type = "button";
    done.className = "edits-complete";
    done.textContent = "edits complete";
    done.addEventListener("click", function () {
      done.disabled = true;
      done.textContent = "saving\u2026";
      save().then(function () { location.href = HOME; }).catch(function (err) {
        done.disabled = false;
        done.textContent = "edits complete";
        alert(err.message || String(err));
      });
    });
    document.body.appendChild(done);
    var area = document.querySelector(".icons-area");
    var add = document.createElement("button");
    add.type = "button";
    add.className = "new-icon";
    add.textContent = "new icon";
    add.addEventListener("click", function () {
      var url = prompt("URL", "https://");
      if (!url) return;
      url = url.trim();
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      chooseImage().then(function (dataUrl) {
        if (!dataUrl) return;
        var name = "";
        try { name = new URL(url).hostname.replace(/^www\./, ""); } catch (e) {}
        placeNew(url, dataUrl, name);
      });
    });
    if (area) area.appendChild(add);
    sortShortRows();
  }

  css();
  menu = document.createElement("div");
  menu.className = "icon-menu";
  menu.innerHTML = '<button type="button" data-act="edit">edit</button><button type="button" data-act="delete">delete</button>';
  document.body.appendChild(menu);
  fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.display = "none";
  fileInput.addEventListener("change", function () {
    var file = fileInput.files && fileInput.files[0];
    fileInput.value = "";
    if (!file || !pasteOn) return;
    var finish = pasteOn;
    blobToIcon(file).then(finish).catch(function (err) { alert(err.message); });
  });
  document.body.appendChild(fileInput);

  fetch(HOME + (HOME.indexOf("?") < 0 ? "?" : "&") + "v=" + Date.now(), { cache: "no-store" })
    .then(function (r) { return r.ok ? r.text() : ""; })
    .then(function (html) {
      if (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        var live = doc.querySelector(".icons-area");
        var mine = document.querySelector(".icons-area");
        if (live && mine) mine.innerHTML = live.innerHTML;
      }
    })
    .catch(function () {})
    .then(setup);
})();
