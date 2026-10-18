/* startmenu.js - hover ⋮ menu on start-page icons: Edit (URL + image) / Delete.
   Saves per browser in localStorage ("startmenu:<path>"); hardcoded links are the defaults.
   Reset: localStorage.removeItem("startmenu:" + location.pathname) and reload. */
(function () {
  var KEY = "startmenu:" + location.pathname.replace(/index\.html$/, "");
  var area = document.querySelector(".icons-area");
  if (!area) return;
  var css = document.createElement("style");
  css.textContent =
    ".sm-item{position:relative}" +
    ".sm-dots{position:absolute;top:3px;right:3px;width:22px;height:26px;border:0;border-radius:6px;background:rgba(0,0,0,.6);color:#fff;font:700 18px/26px system-ui,sans-serif;text-align:center;cursor:pointer;opacity:0;transition:opacity .15s;z-index:5;padding:0}" +
    ".sm-item:hover .sm-dots,.sm-dots:focus,.sm-item.sm-open .sm-dots{opacity:1}" +
    ".sm-pop{position:fixed;z-index:1000;background:#1c1c1e;color:#f0f0f0;border:1px solid rgba(255,255,255,.15);border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.6);padding:6px;font:500 14px system-ui,sans-serif;min-width:150px}" +
    ".sm-pop button.sm-opt{display:block;width:100%;text-align:left;background:none;border:0;color:inherit;font:inherit;padding:8px 12px;border-radius:6px;cursor:pointer}" +
    ".sm-pop button.sm-opt:hover{background:rgba(0,212,255,.18)}" +
    ".sm-pop .sm-del{color:#ff6b6b}" +
    ".sm-pop label{display:flex;align-items:center;gap:6px;padding:6px}" +
    ".sm-pop input{width:280px;padding:6px 8px;border-radius:6px;border:1px solid #555;background:#000;color:#fff;font:inherit}" +
    ".sm-pop .sm-err{color:#ff6b6b;font-size:12px;padding:0 6px 4px;min-height:14px}" +
    ".sm-pop .sm-row{display:flex;justify-content:flex-end;gap:6px;padding:4px 6px}" +
    ".sm-pop .sm-row button{padding:5px 12px;border-radius:6px;border:0;cursor:pointer;font:inherit}" +
    ".sm-pop .sm-ok{background:#00d4ff;color:#000}" +
    ".sm-pop .sm-head{font-size:12px;opacity:.7;padding:4px 12px}";
  document.head.appendChild(css);

  function rows() { return [].slice.call(area.querySelectorAll(".icon-row")); }
  function items(row) { return [].slice.call(row.children).filter(function (e) { return e.tagName === "A"; }); }
  function box(a) { return a.classList.contains("icon-wrapper") ? a : (a.querySelector(".icon-wrapper") || a); }
  function read(a) {
    var img = a.querySelector("img"), lbl = a.querySelector(".lbl");
    return { href: a.getAttribute("href"), title: a.getAttribute("title") || "", img: img ? img.getAttribute("src") : "", label: lbl ? lbl.textContent : null };
  }
  function snapshot() { return rows().map(function (r) { return { top: r.classList.contains("top-row"), items: items(r).map(read) }; }); }
  var template = (function () { var a = area.querySelector(".icon-row > a"); return a && a.cloneNode(true); })();
  var defaults = snapshot();

  function host(u) { try { return new URL(u).hostname; } catch (e) { return ""; } }
  function letterTile(text) {
    var c = document.createElement("canvas"); c.width = c.height = 128; var g = c.getContext("2d");
    var h = 0; for (var i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360;
    g.fillStyle = "hsl(" + h + ",55%,40%)"; g.fillRect(0, 0, 128, 128);
    g.fillStyle = "#fff"; g.font = "bold 72px system-ui,sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText((text.replace(/^www\./, "")[0] || "?").toUpperCase(), 64, 70);
    return c.toDataURL("image/png");
  }
  function build(d) {
    var a = template.cloneNode(true);
    a.setAttribute("href", d.href); a.setAttribute("title", d.title);
    var img = a.querySelector("img");
    if (img) {
      img.setAttribute("src", d.img);
      img.setAttribute("onerror", "this.onerror=null;this.src='https://www.google.com/s2/favicons?domain=" + host(d.href) + "&sz=128'");
    }
    var lbl = a.querySelector(".lbl"); if (lbl) lbl.textContent = d.label != null ? d.label : d.title;
    return a;
  }
  function render(state) {
    var rs = rows(), base = rs[rs.length - 1];
    state.forEach(function (rd, i) {
      var r = rs[i];
      if (!r) { r = base.cloneNode(false); r.className = "icon-row" + (rd.top ? " top-row" : ""); area.appendChild(r); }
      items(r).forEach(function (a) { a.remove(); });
      rd.items.forEach(function (d) { r.appendChild(build(d)); });
    });
    rs.slice(state.length).forEach(function (r) { r.remove(); });
    decorate();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(snapshot())); } catch (e) { alert("Couldn't save (browser storage full?)"); } }

  // even out the normal rows after a delete; drop empty rows (top-row on start3 stays its own row)
  function relayout() {
    var rs = rows().filter(function (r) { return !r.classList.contains("top-row"); });
    var all = []; rs.forEach(function (r) { all = all.concat(items(r)); });
    var n = all.length, rc = Math.max(1, Math.min(rs.length, n)), k = 0;
    rs.forEach(function (r, i) {
      if (i >= rc) { r.remove(); return; }
      var cnt = Math.floor(n / rc) + (i < n % rc ? 1 : 0);
      for (var j = 0; j < cnt; j++) r.appendChild(all[k++]);
    });
    rows().forEach(function (r) { if (!items(r).length && !r.classList.contains("top-row")) r.remove(); });
  }

  var pop = null, openItem = null;
  function closePop() { if (pop) pop.remove(); pop = null; if (openItem) openItem.classList.remove("sm-open"); openItem = null; }
  function showPop(anchorEl, html, a) {
    closePop(); openItem = a; a.classList.add("sm-open");
    pop = document.createElement("div"); pop.className = "sm-pop"; pop.innerHTML = html;
    pop.addEventListener("click", function (e) { e.stopPropagation(); });
    document.body.appendChild(pop);
    var r = anchorEl.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    var left = Math.min(Math.max(8, r.right - w), innerWidth - w - 8);
    var top = r.bottom + 4; if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 4);
    pop.style.left = left + "px"; pop.style.top = top + "px";
    return pop;
  }
  function q(s) { return pop.querySelector(s); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function mainMenu(a, btn) {
    showPop(btn, '<button class="sm-opt" data-a="edit">✏️ Edit</button><button class="sm-opt sm-del" data-a="del">🗑️ Delete</button>', a);
    q('[data-a="edit"]').onclick = function () { editUrl(a, btn); };
    q('[data-a="del"]').onclick = function () {
      closePop();
      if (!confirm('Delete "' + (a.getAttribute("title") || a.href) + '"?')) return;
      a.remove(); relayout(); save();
    };
  }
  function normalize(v) {
    v = v.trim(); if (!v) return null;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = "https://" + v;
    try { var u = new URL(v); if (!/^https?:$/.test(u.protocol) || u.hostname.indexOf(".") < 0) return null; return u.href; } catch (e) { return null; }
  }
  function editUrl(a, btn) {
    showPop(btn, '<label>URL: <input type="text" class="sm-url" spellcheck="false"></label><div class="sm-err"></div>' +
      '<div class="sm-row"><button class="sm-cancel">Cancel</button><button class="sm-ok">Next</button></div>', a);
    var inp = q(".sm-url"); inp.value = a.getAttribute("href"); inp.focus(); inp.select();
    function go() {
      var u = normalize(inp.value);
      if (!u) { q(".sm-err").textContent = "That doesn't look like a valid web address."; return; }
      imageMenu(a, btn, u);
    }
    q(".sm-ok").onclick = go; q(".sm-cancel").onclick = closePop;
    inp.onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); go(); } if (e.key === "Escape") closePop(); };
  }
  function apply(a, url, src) {
    var oldHost = host(a.getAttribute("href"));
    a.setAttribute("href", url);
    var t = a.getAttribute("title");
    if (!t || host(url) !== oldHost) { a.setAttribute("title", host(url).replace(/^www\./, "")); var l = a.querySelector(".lbl"); if (l) l.textContent = a.getAttribute("title"); }
    var img = a.querySelector("img");
    if (img) { img.removeAttribute("onerror"); img.src = src; }
    save(); closePop();
  }
  function imageMenu(a, btn, url) {
    showPop(btn, '<div class="sm-head">' + esc(host(url)) + '</div><button class="sm-opt" data-a="up">📁 Upload image</button><button class="sm-opt" data-a="auto">✨ Auto-generate</button>', a);
    q('[data-a="up"]').onclick = function () {
      var f = document.createElement("input"); f.type = "file"; f.accept = "image/*";
      f.onchange = function () {
        var file = f.files[0]; if (!file) return;
        var rd = new FileReader();
        rd.onload = function () {
          var im = new Image();
          im.onload = function () {
            var s = 128, c = document.createElement("canvas"); c.width = c.height = s; var g = c.getContext("2d");
            var sc = Math.min(s / im.width, s / im.height), w = im.width * sc, h = im.height * sc;
            g.drawImage(im, (s - w) / 2, (s - h) / 2, w, h);
            apply(a, url, c.toDataURL("image/png"));
          };
          im.onerror = function () { alert("That file isn't an image I can read."); };
          im.src = rd.result;
        };
        rd.readAsDataURL(file);
      };
      f.click();
    };
    q('[data-a="auto"]').onclick = function () {
      var h = host(url), src = "https://www.google.com/s2/favicons?sz=128&domain_url=" + encodeURIComponent(url);
      var test = new Image();
      test.onload = function () { apply(a, url, test.naturalWidth > 16 ? src : letterTile(h)); };
      test.onerror = function () { apply(a, url, letterTile(h)); };
      test.src = src;
    };
  }

  function decorate() {
    rows().forEach(function (r) {
      items(r).forEach(function (a) {
        var b = box(a); b.classList.add("sm-item");
        if (b.querySelector(".sm-dots")) return;
        var btn = document.createElement("button"); btn.type = "button"; btn.className = "sm-dots"; btn.textContent = "⋮"; btn.title = "Options";
        btn.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); if (openItem === a) closePop(); else mainMenu(a, btn); });
        b.appendChild(btn);
      });
    });
  }

  var saved = null; try { saved = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
  if (saved && saved.length && template) render(saved); else decorate();
  document.addEventListener("click", function (e) { if (pop && !pop.contains(e.target)) closePop(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closePop(); });
  window.startMenuReset = function () { localStorage.removeItem(KEY); location.reload(); };
  void defaults;
})();
