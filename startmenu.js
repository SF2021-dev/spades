/* startmenu.js - hover ⋮ menu on start-page icons: Edit (URL + image) / Delete.
   Saves per browser in localStorage ("startmenu:<path>"); hardcoded links are the defaults.
   Reset: localStorage.removeItem("startmenu:" + location.pathname) and reload. */
(function () {
  var KEY = "startmenu:" + location.pathname.replace(/index\.html$/, ""); // old per-browser layout (only read once, for migration)
  // start2 = Judy's page, start3 = Christina's page; layouts live on the server (/api/startlayout). /start.html is not editable.
  // /start or /start.html = site owner's page; start2 = Judy; start3 = Christina
  var PAGE = (location.pathname.match(/\/(start[23]?)(\.html|\/|\/index\.html)?$/) || [])[1] || null;
  if (PAGE === "start" && /\/$/.test(location.pathname)) PAGE = null;
  if (!PAGE) return;
  var CACHE = "startlayout-cache:" + PAGE, canEdit = false;
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
    ".sm-ghost{position:fixed;z-index:999;pointer-events:none;opacity:.85;transform:scale(1.05);box-shadow:0 18px 40px rgba(0,0,0,.7);border-radius:10px;overflow:hidden}" +
    ".sm-ghost .sm-dots{display:none}" +
    ".sm-dragging{opacity:.3;outline:2px dashed #00d4ff;outline-offset:2px}" +
    ".sm-target{outline:3px solid #00d4ff;outline-offset:2px}" +
    ".sm-slot{position:fixed;z-index:998;pointer-events:none;border:2px dashed #00d4ff;border-radius:10px;background:rgba(0,212,255,.12)}" +
    ".icons-area .icon-row>a,.icons-area .icon-row>a img{-webkit-user-drag:none;user-select:none;touch-action:none}" +
    ".sm-plus{position:fixed;z-index:15;pointer-events:none;align-items:center;justify-content:center;border:2px dashed rgba(255,255,255,.35);border-radius:10px;background:rgba(255,255,255,.06);color:rgba(255,255,255,.6);font-weight:300;line-height:1}" +
    ".sm-thumbs{display:flex;flex-wrap:wrap;gap:8px;padding:6px;max-width:540px}" +
    ".sm-thumb{display:flex;flex-direction:column;align-items:center;gap:3px;width:96px;padding:6px;border-radius:8px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:inherit;cursor:pointer;font:11px system-ui,sans-serif}" +
    ".sm-thumb:hover{background:rgba(0,212,255,.18);border-color:#00d4ff}" +
    ".sm-thumb img{width:72px;height:72px;object-fit:contain;background:#fff;border-radius:8px}" +
    ".sm-thumb small{opacity:.55;font-size:10px}" +
    ".sm-thumb span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.8}" +
    ".sm-lock{position:fixed;right:6px;bottom:6px;z-index:40;border:0;background:none;font-size:13px;opacity:.18;cursor:pointer;padding:4px}" +
    ".sm-lock:hover,.sm-lock.sm-on{opacity:.75}" +
    ".sm-pop .sm-head{font-size:12px;opacity:.7;padding:4px 12px}";
  document.head.appendChild(css);
  // fixed slots per row: start.html 9, start2 10 (start3 keeps width-based); those rows are centered
  var FIXED_CAP = PAGE === "start" ? 9 : PAGE ? 10 : 0;
  if (FIXED_CAP) css.textContent += ".icons-area .icon-row{justify-content:center}";

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
  // stored icon size: icons render up to ~180 CSS px, so 384px stays sharp at devicePixelRatio 2
  var SZ = 384;
  function toData(c) { var w = c.toDataURL("image/webp", 0.9); return /^data:image\/webp/.test(w) && w.length < 750000 ? w : c.toDataURL("image/png"); }
  function fitCanvas(im, bg, pad) { // center-fit any image into an SZ x SZ canvas (transparent, or bg color with padding)
    var c = document.createElement("canvas"); c.width = c.height = SZ; var g = c.getContext("2d"), P = pad || 0;
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, SZ, SZ); }
    var iw = im.naturalWidth || SZ, ih = im.naturalHeight || SZ, sc = Math.min((SZ - 2 * P) / iw, (SZ - 2 * P) / ih), w = iw * sc, h = ih * sc;
    g.imageSmoothingQuality = "high"; g.drawImage(im, (SZ - w) / 2, (SZ - h) / 2, w, h); return c;
  }
  function letterTile(text) {
    var c = document.createElement("canvas"); c.width = c.height = 128; var g = c.getContext("2d");
    var h = 0; for (var i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360;
    g.fillStyle = "hsl(" + h + ",55%,40%)"; g.fillRect(0, 0, 128, 128);
    g.fillStyle = "#fff"; g.font = "bold 72px system-ui,sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText((text.replace(/^www\./, "")[0] || "?").toUpperCase(), 64, 70);
    var big = document.createElement("canvas"); big.width = big.height = SZ; var bg = big.getContext("2d");
    bg.scale(SZ / 128, SZ / 128); bg.fillStyle = g.fillStyle; // redraw crisply at SZ
    var h2 = 0; for (var j = 0; j < text.length; j++) h2 = (h2 * 31 + text.charCodeAt(j)) % 360;
    bg.fillStyle = "hsl(" + h2 + ",55%,40%)"; bg.fillRect(0, 0, 128, 128);
    bg.fillStyle = "#fff"; bg.font = "bold 72px system-ui,sans-serif"; bg.textAlign = "center"; bg.textBaseline = "middle";
    bg.fillText((text.replace(/^www\./, "")[0] || "?").toUpperCase(), 64, 70);
    return big.toDataURL("image/png");
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
  var saving = Promise.resolve();
  function save(state) {
    if (!canEdit) return Promise.resolve(false);
    var body = JSON.stringify({ layout: state || snapshot() });
    saving = saving.then(function () {
      return fetch("/api/startlayout?page=" + PAGE, { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: body })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }); })
        .then(function (j) {
          try { localStorage.setItem(CACHE, JSON.stringify(j.layout)); } catch (e) {}
          // swap uploaded data: images for their stored /api/img/ addresses
          var all = []; rows().forEach(function (r) { all = all.concat(items(r)); });
          var flat = []; j.layout.forEach(function (r) { flat = flat.concat(r.items); });
          if (flat.length === all.length) all.forEach(function (a, i) { var im = a.querySelector("img"); if (im && /^data:/.test(im.getAttribute("src") || "")) im.setAttribute("src", flat[i].img); });
          return true;
        })
        .catch(function (e) { alert("Couldn't save the page: " + e.message); if (/owner|Log in/.test(e.message)) setEdit(false); return false; });
    });
    return saving;
  }

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

  var pop = null, openItem = null, justOpened = false;
  function closePop(keep) {
    if (pop) pop.remove(); pop = null;
    if (openItem) {
      openItem.classList.remove("sm-open");
      if (!keep && openItem.dataset.smNew) { var r = openItem.parentNode; openItem.remove(); if (r && !items(r).length && !r.classList.contains("top-row")) r.remove(); }
    }
    openItem = null;
  }
  function showPop(anchorEl, html, a) {
    closePop(true); openItem = a; a.classList.add("sm-open");
    justOpened = true; setTimeout(function () { justOpened = false; }, 0);
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
    delete a.dataset.smNew; save(); closePop();
  }
  function imageMenu(a, btn, url) {
    showPop(btn, '<div class="sm-head">' + esc(host(url)) + '</div><button class="sm-opt" data-a="up">📁 Upload image</button><button class="sm-opt" data-a="auto">✨ Auto-generate</button><button class="sm-opt" data-a="db">🔎 Icon from public database</button>', a);
    q('[data-a="db"]').onclick = function () { dbPicker(a, btn, url); };
    q('[data-a="up"]').onclick = function () {
      var f = document.createElement("input"); f.type = "file"; f.accept = "image/*";
      f.onchange = function () {
        var file = f.files[0]; if (!file) return;
        var rd = new FileReader();
        rd.onload = function () {
          var im = new Image();
          im.onload = function () {
            apply(a, url, toData(fitCanvas(im)));
          };
          im.onerror = function () { alert("That file isn't an image I can read."); };
          im.src = rd.result;
        };
        rd.readAsDataURL(file);
      };
      f.click();
    };
    q('[data-a="auto"]').onclick = function () { autoGen(a, url); };
  }
  function autoGen(a, url) { // best high-res candidate, else a letter tile
    var myPop = pop; if (pop) { var o = pop.querySelector(".sm-head"); if (o) o.textContent = "Looking for a sharp icon…"; }
    dbCandidates(url, "").then(function (list) {
      if (myPop && pop !== myPop) return;
      var best = list.filter(function (c) { return !c.lowres; })[0];
      if (best) choose(a, url, best); else apply(a, url, letterTile(host(url)));
    });
  }


  /* ---- "Icon from public database": Simple Icons (CC0) + free no-key favicon services ---- */
  var SI_KEY = "startmenu:simpleicons:v1", SI_URLS = ["https://cdn.jsdelivr.net/npm/simple-icons@latest/data/simple-icons.json", "https://cdn.jsdelivr.net/npm/simple-icons@latest/_data/simple-icons.json"];
  function norm(t) { return String(t || "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, ""); }
  function loadSimpleIcons() {
    try { var c = JSON.parse(localStorage.getItem(SI_KEY) || "null"); if (c && c.t > Date.now() - 7 * 864e5) return Promise.resolve(c.d); } catch (e) {}
    function tryUrl(i) {
      if (i >= SI_URLS.length) return Promise.resolve([]);
      return fetch(SI_URLS[i]).then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (j) {
        var list = Array.isArray(j) ? j : (j.icons || []);
        // compact: [slug, title, hex, aka-aliases..., source host]
        var d = list.map(function (x) {
          var aka = (x.aliases && x.aliases.aka) || [], dup = ((x.aliases && x.aliases.dup) || []).map(function (y) { return y.title; });
          return [x.slug || norm(x.title), x.title, x.hex, aka.concat(dup).map(norm).join(","), host(x.source || "").replace(/^www\./, "")];
        });
        try { localStorage.setItem(SI_KEY, JSON.stringify({ t: Date.now(), d: d })); } catch (e) {}
        return d;
      }).catch(function () { return tryUrl(i + 1); });
    }
    return tryUrl(0);
  }
  function matchSlugs(data, url, title, products) {
    var pk = (products || []).map(norm).filter(Boolean);
    var h = host(url).replace(/^www\./, ""), parts = h.split("."), label = norm(parts.length > 1 ? parts[parts.length - 2] : parts[0]);
    if (parts.length > 2 && /^(co|com|org|net|ac|gov)$/.test(parts[parts.length - 2])) label = norm(parts[parts.length - 3]);
    var keys = [label, norm(h), norm(title)].filter(function (k) { return k && k.length > 1; }), out = [];
    data.forEach(function (x) {
      var al = x[3] ? x[3].split(",") : [], score = 0;
      if (pk.length && (pk.indexOf(x[0]) >= 0 || pk.indexOf(norm(x[1])) >= 0 || al.some(function (k) { return pk.indexOf(k) >= 0; }))) score = 7; // product (Google Docs)
      else if (x[0] === label) score = 5; else if (norm(x[1]) === label) score = 4;
      else if (keys.indexOf(x[0]) >= 0 || keys.indexOf(norm(x[1])) >= 0) score = 3;
      else if (al.some(function (k) { return keys.indexOf(k) >= 0; })) score = 2;
      else if (x[4] && (x[4] === h || x[4].slice(-h.length - 1) === "." + h)) score = 1;
      if (score) out.push({ s: score, x: x });
    });
    out.sort(function (p, q) { return q.s - p.s; });
    // only keep source-host matches (score 1, e.g. icons whose logo source is on github.com) when nothing better exists,
    // and only those whose name contains the site label
    var best = out.length ? out[0].s : 0;
    var prodHits = out.filter(function (o) { return o.s === 7; });
    out = out.filter(function (o) { return o.s < 7 && (o.s >= 2 ? o.s === best || o.s >= 4 || prodHits.length : best === 1 && norm(o.x[1]).indexOf(label) >= 0); });
    var res = prodHits.slice(0, 1).concat(out.slice(0, prodHits.length ? 1 : 2));   // product first, parent brand only as a generic extra
    return res.map(function (o) { var x = o.x.slice(); x.product = o.s === 7 || !pk.length; return x; });
  }
  function tileFromSvg(svgUrl, hex) { // white glyph on brand-color tile, SZ px data URL (vector, so sharp)
    return new Promise(function (res) {
      var im = new Image(); im.crossOrigin = "anonymous";
      im.onload = function () {
        try {
          var c = document.createElement("canvas"); c.width = c.height = SZ; var g = c.getContext("2d"), r = SZ * 0.17, m = SZ * 0.22;
          g.fillStyle = "#" + hex; g.beginPath(); if (g.roundRect) g.roundRect(0, 0, SZ, SZ, r); else g.rect(0, 0, SZ, SZ); g.fill();
          g.drawImage(im, m, m, SZ - 2 * m, SZ - 2 * m); res(c.toDataURL("image/png"));
        } catch (e) { res(null); }
      };
      im.onerror = function () { res(null); }; im.src = svgUrl;
    });
  }
  function proxied(u) { return /^data:/.test(u) || /^https:\/\/(cdn\.simpleicons\.org|api\.iconify\.design)\//.test(u) ? u : "/api/iconfind?page=" + PAGE + "&fetch=" + encodeURIComponent(u); }
  function probe(src, timeout) { // resolves {src,w,h} or null if broken
    return new Promise(function (res) {
      var im = new Image(), done = false, t = setTimeout(function () { if (!done) { done = true; res(null); } }, timeout || 9000);
      im.onload = function () { if (done) return; done = true; clearTimeout(t); res({ src: src, w: im.naturalWidth || 0, h: im.naturalHeight || 0 }); };
      im.onerror = function () { if (done) return; done = true; clearTimeout(t); res(null); };
      im.src = src;
    });
  }
  // candidates, sharpest first: Wikimedia logo, manifest / apple-touch / og:image (server finder), Simple Icons SVG + tile.
  // Low-res favicon services only when nothing sharp exists. Never under 128px unless it's a vector.
  function dbCandidates(url, title) {
    var h = host(url), jobs = [];
    var finder = fetch("/api/iconfind?page=" + PAGE + "&url=" + encodeURIComponent(url), { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : { candidates: [] }; }).catch(function () { return { candidates: [] }; });
    return Promise.all([finder, loadSimpleIcons()]).then(function (x) {
      var found = x[0].candidates || [], si = matchSlugs(x[1], url, title || x[0].title || "", x[0].products || []);
      found.forEach(function (c) {
        jobs.push(probe(proxied(c.src)).then(function (r) { if (!r) return null; r.orig = c.src; r.label = c.source; r.svg = !!c.svg; r.product = c.product !== false; return r; }));
      });
      si.forEach(function (x) {
        jobs.push(Promise.resolve({ src: "https://cdn.simpleicons.org/" + x[0], orig: "https://cdn.simpleicons.org/" + x[0], w: 0, h: 0, svg: true, mono: true, product: x.product, label: x[1] + " (Simple Icons)" }));
        jobs.push(tileFromSvg("https://cdn.simpleicons.org/" + x[0] + "/white", x[2]).then(function (d) { return d ? { src: d, orig: d, w: SZ, h: SZ, svg: true, mono: true, tile: true, product: x.product, label: x[1] + " tile (Simple Icons)" } : null; }));
      });
      return Promise.all(jobs);
    }).then(function (rs) {
      // vectors first, square-ish before wide wordmarks/banners (which shrink to a thin strip in a square icon)
      // product-specific full-color vector > product big raster > product one-color (Simple Icons) > generic parent brand
      function score(r) { var mn = Math.min(r.w, r.h), mx = Math.max(r.w, r.h), wide = mn > 0 && mx > mn * 1.6, v;
        if (r.svg && !r.mono) v = 100000; else if (!r.svg) v = 10000 + Math.min(mn, 1024) * 50; else v = 60000;
        if (r.svg && r.mono) v = 50000 - (r.tile ? 1 : 0);
        if (wide) v *= 0.5; if (!r.svg && mn < 256) v *= 0.8; if (r.product === false) v *= 0.3; return v; }
      var seen = {}, out = rs.filter(function (r) {
        if (!r) return false;
        if (!r.svg && (Math.max(r.w, r.h) < 128 || Math.min(r.w, r.h) < 48)) return false;
        var k = r.svg ? r.orig : r.w + "x" + r.h + ":" + r.label.split(" ")[0]; if (seen[k]) return false; seen[k] = 1; return true;
      }).sort(function (p, q) { return score(q) - score(p); });
      if (out.length) return out.slice(0, 5);
      // nothing sharp: low-res fallbacks
      return Promise.all([["https://www.google.com/s2/favicons?sz=128&domain=" + h, "Google favicon"], ["https://icons.duckduckgo.com/ip3/" + h + ".ico", "DuckDuckGo"], ["https://icon.horse/icon/" + h, "icon.horse"]].map(function (c) {
        return probe(c[0], 6000).then(function (r) {
          if (!r || r.w < 32 || (c[1] === "DuckDuckGo" && r.w === 48 && r.h === 48)) return null;
          r.orig = c[0]; r.label = c[1] + " (low-res)"; r.lowres = true; return r;
        });
      })).then(function (l) { return l.filter(Boolean); });
    });
  }
  function choose(a, url, c) { // render the chosen candidate at SZ and store it on the server
    if (c.tile) { apply(a, url, c.src); return; }
    var im = new Image(); im.crossOrigin = "anonymous";
    im.onload = function () { try { apply(a, url, toData(fitCanvas(im, "#fff", SZ * 0.06))); } catch (e) { apply(a, url, /^https:/.test(c.orig) ? c.orig : letterTile(host(url))); } };
    im.onerror = function () { apply(a, url, /^https:/.test(c.orig) ? c.orig : letterTile(host(url))); };
    im.src = proxied(c.orig);
  }
  function dbPicker(a, btn, url) {
    showPop(btn, '<div class="sm-head">Public icon databases · ' + esc(host(url)) + '</div><div class="sm-db">Searching…</div>', a);
    var myPop = pop;
    var sameSite = host(a.getAttribute("href") || "") === host(url);
    dbCandidates(url, sameSite ? a.getAttribute("title") || "" : "").then(function (list) {
      if (pop !== myPop) return; // menu was closed meanwhile
      var box = q(".sm-db");
      if (!list.length) {
        box.innerHTML = '<div style="padding:6px 12px">No icons found for this site.</div><button class="sm-opt" data-a="auto">✨ Auto-generate</button>';
        q('[data-a="auto"]').onclick = function () { autoGen(a, url); };
        return;
      }
      box.innerHTML = '<div class="sm-thumbs">' + list.map(function (c, i) {
        var size = c.svg && !c.w ? "vector" : c.w + "×" + c.h + (c.svg ? " · vector" : "");
        return '<button class="sm-thumb" data-i="' + i + '" title="' + esc(c.label) + '"><img src="' + esc(c.src) + '" alt=""><span>' + esc(c.label) + '</span><small>' + esc(size) + '</small></button>';
      }).join("") + '</div>';
      [].forEach.call(pop.querySelectorAll(".sm-thumb"), function (b) { b.onclick = function () { b.disabled = true; choose(a, url, list[+b.dataset.i]); }; });
      var pr = pop.getBoundingClientRect(); // keep the grown picker on screen
      if (pr.bottom > innerHeight - 8) pop.style.top = Math.max(8, innerHeight - 8 - pr.height) + "px";
      if (pr.right > innerWidth - 8) pop.style.left = Math.max(8, innerWidth - 8 - pr.width) + "px";
    });
  }

  function decorate() {
    if (!canEdit) { [].forEach.call(area.querySelectorAll(".sm-dots"), function (d) { d.remove(); }); return; }
    rows().forEach(function (r) {
      if (r.classList.contains("top-row")) return; // locked: no menu, no drag
      items(r).forEach(function (a) {
        var b = box(a); b.classList.add("sm-item");
        if (b.querySelector(".sm-dots")) return;
        var btn = document.createElement("button"); btn.type = "button"; btn.className = "sm-dots"; btn.textContent = "⋮"; btn.title = "Options";
        btn.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); if (openItem === a) closePop(); else mainMenu(a, btn); });
        b.appendChild(btn);
      });
    });
  }


  /* ---- drag to swap/move, click blank row spot or below last row to add ---- */
  function normalRows() { return rows().filter(function (r) { return !r.classList.contains("top-row"); }); }
  function itemSize(r) { var a = items(r)[0] || area.querySelector(".icon-row > a"); var b = a.getBoundingClientRect(); return { w: b.width, h: b.height }; }
  function gapOf(r) { return parseFloat(getComputedStyle(r).columnGap) || 12; }
  function capacity(r) {
    var sz = itemSize(r), g = gapOf(r), w = r.getBoundingClientRect().width;
    if (FIXED_CAP) return FIXED_CAP;
    return Math.max(1, Math.floor((w + g) / (sz.w + g)));
  }
  function insertIndex(r, x, skip) {
    var n = 0; items(r).forEach(function (a) { if (a === skip) return; var b = a.getBoundingClientRect(); if (b.left + b.width / 2 < x) n++; }); return n;
  }
  // where would a point land? {row, index} for a blank spot in a row with room, {newRow:true} below the last row, or null
  function slotAt(x, y, dragged) {
    var ar = area.getBoundingClientRect();
    if (x < ar.left || x > ar.right) return null;
    var rs = rows();
    for (var i = 0; i < rs.length; i++) {
      var r = rs[i], b = r.getBoundingClientRect(), its = items(r);
      var slack = gapOf(r) / 2; // a little vertical slack above/below each row
      if (y < b.top - slack || y > b.bottom + slack) continue;
      if (r.classList.contains("top-row")) return null; // start3 top row is locked
      var onItem = its.some(function (a) { var c = a.getBoundingClientRect(); return x >= c.left && x <= c.right && y >= c.top && y <= c.bottom; });
      if (onItem) return null;
      var count = its.filter(function (a) { return a !== dragged; }).length;
      if (count >= capacity(r)) return null;
      return { row: r, index: insertIndex(r, x, dragged) };
    }
    var last = rs[rs.length - 1]; if (!last) return null;
    var lb = last.getBoundingClientRect(), sz = itemSize(last);
    var floor = Math.min(innerHeight - 4, ar.bottom + 50);
    if (y > lb.bottom && y <= floor && floor - lb.bottom >= 20) return { newRow: true };
    return null;
  }
  function placeAt(a, slot) {
    var r = slot.row;
    if (slot.newRow) { var base = normalRows().pop() || rows().pop(); r = base.cloneNode(false); r.className = "icon-row"; area.appendChild(r); }
    var its = items(r).filter(function (e) { return e !== a; }), ref = its[slot.index || 0] || null;
    var old = a.parentNode;
    if (ref) r.insertBefore(a, ref); else { var after = its[its.length - 1]; if (after) after.after(a); else r.insertBefore(a, r.firstChild); }
    if (old && old !== r && !items(old).length && !old.classList.contains("top-row")) old.remove();
  }
  function swap(a, b) {
    var m = document.createElement("span"); a.before(m); b.before(a); m.replaceWith(b);
  }

  var drag = null, suppressClick = false, slotBox = null;
  function showSlot(slot) {
    if (!slot) { if (slotBox) slotBox.remove(); slotBox = null; return; }
    if (!slotBox) { slotBox = document.createElement("div"); slotBox.className = "sm-slot"; document.body.appendChild(slotBox); }
    var sz = itemSize(slot.row || normalRows().pop() || rows()[0]), left, top, prev, next;
    if (slot.newRow) { var l = rows()[rows().length - 1].getBoundingClientRect(); var ar = area.getBoundingClientRect(); left = drag.x0 = drag.lastX - sz.w / 2; top = l.bottom + 8; left = Math.max(ar.left, Math.min(left, ar.right - sz.w)); }
    else {
      var its = items(slot.row).filter(function (e) { return !drag || e !== drag.a; }), rb = slot.row.getBoundingClientRect(), g = gapOf(slot.row);
      prev = its[slot.index - 1]; next = its[slot.index];
      if (prev) left = prev.getBoundingClientRect().right + g / 2 - 2; else if (next) left = next.getBoundingClientRect().left - sz.w - g / 2; else left = rb.left;
      left = Math.max(rb.left, Math.min(left, rb.right - sz.w));
      top = rb.top + (rb.height - sz.h) / 2;
    }
    var bw = sz.w;
    if (!slot.newRow && prev && next) { // insertion bar in the gap between two icons
      bw = 6; left = (prev.getBoundingClientRect().right + next.getBoundingClientRect().left) / 2 - 3;
    }
    slotBox.style.cssText = "left:" + left + "px;top:" + top + "px;width:" + bw + "px;height:" + sz.h + "px" + (bw < 10 ? ";background:#00d4ff;border-radius:3px" : "");
  }
  // over the middle 24% of an icon = swap; over its outer 38% edges = insert before/after it (row needs room); gaps/blank = slotAt
  function dropTarget(x, y, dragged) {
    var over = itemFrom(document.elementFromPoint(x, y));
    if (over && over !== dragged) {
      var b = over.getBoundingClientRect(), f = (x - b.left) / b.width;
      if (f >= 0.38 && f <= 0.62) return { swap: over }; // middle 24% swaps; outer 38% each side inserts
      var r = over.parentNode, count = items(r).filter(function (a) { return a !== dragged; }).length;
      if (count >= capacity(r)) return {};
      return { slot: { row: r, index: insertIndex(r, x, dragged), between: true } };
    }
    if (over) return {}; // over its own spot
    var sl = slotAt(x, y, dragged); return sl ? { slot: sl } : {};
  }
  function itemFrom(el) { var a = el && el.closest && el.closest(".icons-area .icon-row:not(.top-row) > a"); return a || null; }

  area.addEventListener("dragstart", function (e) { e.preventDefault(); });
  document.addEventListener("pointerdown", function (e) {
    if (!canEdit) return;
    if (e.button !== 0 || pop) return;
    if (e.target.closest(".sm-dots")) return;
    var a = itemFrom(e.target); if (!a) return;
    drag = { a: a, x: e.clientX, y: e.clientY, lastX: e.clientX, started: false, id: e.pointerId };
  });
  document.addEventListener("pointermove", function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    drag.lastX = e.clientX;
    if (!drag.started) {
      if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) < 6) return;
      drag.started = true;
      var b = box(drag.a), r = b.getBoundingClientRect();
      drag.ox = drag.x - r.left; drag.oy = drag.y - r.top;
      drag.ghost = b.cloneNode(true); drag.ghost.classList.add("sm-ghost"); drag.ghost.classList.remove("sm-item");
      drag.ghost.style.width = r.width + "px"; drag.ghost.style.height = r.height + "px";
      document.body.appendChild(drag.ghost); drag.a.classList.add("sm-dragging");
    }
    e.preventDefault();
    drag.ghost.style.left = (e.clientX - drag.ox) + "px"; drag.ghost.style.top = (e.clientY - drag.oy) + "px";
    var tg = dropTarget(e.clientX, e.clientY, drag.a);
    if (drag.over && drag.over !== tg.swap) box(drag.over).classList.remove("sm-target");
    drag.over = tg.swap || null; drag.slot = tg.slot || null;
    if (drag.over) box(drag.over).classList.add("sm-target");
    showSlot(drag.slot);
  });
  function endDrag(e, cancel) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    var d = drag; drag = null;
    if (!d.started) return;
    suppressClick = true; setTimeout(function () { suppressClick = false; }, 400);
    d.ghost.remove(); d.a.classList.remove("sm-dragging"); showSlot(null);
    if (d.over) box(d.over).classList.remove("sm-target");
    if (cancel) return;
    var tg = dropTarget(e.clientX, e.clientY, d.a);
    if (tg.swap) { swap(d.a, tg.swap); save(); return; }
    if (tg.slot) { placeAt(d.a, tg.slot); save(); }
  }
  document.addEventListener("pointerup", function (e) { endDrag(e, false); });
  document.addEventListener("pointercancel", function (e) { endDrag(e, true); });

  function addAt(slot) {
    var a = build({ href: "https://", title: "New link", img: letterTile("+"), label: "" });
    a.dataset.smNew = "1";
    placeAt(a, slot); decorate();
    editUrl(a, box(a).querySelector(".sm-dots"));
    var inp = pop && pop.querySelector(".sm-url"); if (inp) { inp.value = ""; inp.placeholder = "example.com"; }
  }
  // capture phase so a finished drag never follows the link
  document.addEventListener("click", function (e) {
    if (suppressClick) { e.preventDefault(); e.stopPropagation(); suppressClick = false; return; }
  }, true);
  document.addEventListener("click", function (e) {
    if (pop || !canEdit) return; // the other listener closes the menu
    var t = e.target;
    if (!blankTarget(t)) return;
    var ps = plusSlot(e.clientX, e.clientY);
    if (ps && template) { e.stopPropagation(); showPlus(null); addAt(ps.slot); }
  });

  /* ---- "+" tile on hover over an unused position ---- */
  function blankTarget(t) { return t === document.body || t === document.documentElement || t.classList.contains("background") || t === area || t.classList.contains("icon-row"); }
  // unused positions sit left/right of a centered row (up to capacity), or one centered slot below the last row
  function plusSlot(x, y) {
    var slot = slotAt(x, y, null); if (!slot) return null;
    var ar = area.getBoundingClientRect();
    if (slot.newRow) {
      var last = rows()[rows().length - 1], lb = last.getBoundingClientRect(), sz = itemSize(normalRows().pop() || last), g = gapOf(last);
      var top = lb.bottom + g, left = ar.left + (ar.width - sz.w) / 2;
      if (top + sz.h > innerHeight - 4) top = innerHeight - 4 - sz.h;
      return { slot: slot, left: left, top: top, w: sz.w, h: sz.h };
    }
    var r = slot.row, its = items(r), n = its.length, cap = capacity(r), free = cap - n;
    var sz2 = itemSize(r), g2 = gapOf(r), step = sz2.w + g2, rb = r.getBoundingClientRect();
    var first = its[0].getBoundingClientRect(), lastI = its[n - 1].getBoundingClientRect();
    var leftFree = Math.ceil(free / 2), rightFree = free - Math.floor(free / 2), k, lx;
    // clamp to the row; if the side space is narrower than an icon (odd number of free slots), shrink the tile to fit
    function fit(lx, idx, top) {
      var l = Math.max(rb.left, lx), rr = Math.min(rb.right, lx + sz2.w);
      if (idx === 0) rr = Math.min(rr, first.left - 4); else l = Math.max(l, lastI.right + 4);
      if (rr - l < 24) return null;
      return { slot: { row: r, index: idx }, left: l, top: top, w: rr - l, h: sz2.h };
    }
    if (x < first.left) { k = Math.ceil((first.left - x) / step); if (k > leftFree) return null; lx = first.left - k * step + g2; return fit(lx, 0, first.top); }
    if (x > lastI.right) { k = Math.ceil((x - lastI.right) / step); if (k > rightFree) return null; lx = lastI.right + (k - 1) * step + g2; return fit(lx, n, lastI.top); }
    return null; // gaps between icons: no + (drag-insert only)
  }
  var plusEl = null;
  function showPlus(ps) {
    if (!ps) { if (plusEl) plusEl.style.display = "none"; return; }
    if (!plusEl) { plusEl = document.createElement("div"); plusEl.className = "sm-plus"; plusEl.textContent = "+"; document.body.appendChild(plusEl); }
    plusEl.style.cssText = "display:flex;left:" + ps.left + "px;top:" + ps.top + "px;width:" + ps.w + "px;height:" + ps.h + "px;font-size:" + Math.round(ps.h * 0.5) + "px";
  }
  document.addEventListener("pointermove", function (e) {
    if (!canEdit || drag || pop || e.pointerType === "touch" || !template) { showPlus(null); return; }
    showPlus(blankTarget(e.target) ? plusSlot(e.clientX, e.clientY) : null);
  });
  document.addEventListener("pointerleave", function () { showPlus(null); });

  /* ---- server layout + owner login ---- */
  function setEdit(on) { canEdit = !!on; decorate(); if (!on) { closePop(); showPlus(null); } lock.classList.toggle("sm-on", canEdit); lock.textContent = canEdit ? "🔓" : "🔒"; }
  var ownerName = PAGE === "start2" ? "Judy" : PAGE === "start3" ? "Christina" : "Owner";
  // old per-browser layouts: /start.html was also saved as /start (pretty URL)
  var OLD_KEYS = PAGE === "start" ? ["startmenu:/start", "startmenu:/start.html"] : [KEY];
  var lock = document.createElement("button"); lock.type = "button"; lock.className = "sm-lock"; lock.textContent = "🔒"; lock.title = "Owner login";
  document.body.appendChild(lock);
  function loginBox() {
    showPop(lock, '<div class="sm-head">' + esc(ownerName) + '</div><label>Password: <input type="password" class="sm-pw" autocomplete="current-password"></label><div class="sm-err"></div>' +
      '<div class="sm-row"><button class="sm-cancel">Cancel</button><button class="sm-ok">Log in</button></div>', lock);
    var inp = q(".sm-pw"); inp.focus();
    function go() {
      q(".sm-err").textContent = "";
      fetch("/api/startlogin", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ page: PAGE, password: inp.value }) })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (x) {
          if (!x.ok) { if (pop) q(".sm-err").textContent = x.j.error || "Login failed"; return; }
          closePop(true); setEdit(true); offerMigration();
        }).catch(function () { if (pop) q(".sm-err").textContent = "Network problem, try again."; });
    }
    q(".sm-ok").onclick = go; q(".sm-cancel").onclick = function () { closePop(); };
    inp.onkeydown = function (e) { if (e.key === "Enter") { e.preventDefault(); go(); } };
  }
  function ownerMenu() {
    showPop(lock, '<div class="sm-head">Editing as ' + esc(ownerName) + '</div><button class="sm-opt" data-a="out">Log out</button>', lock);
    q('[data-a="out"]').onclick = function () {
      fetch("/api/startlogin", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ page: PAGE, action: "logout" }) })
        .finally(function () { closePop(true); setEdit(false); });
    };
  }
  lock.addEventListener("click", function (e) { e.stopPropagation(); if (pop) { closePop(); return; } if (canEdit) ownerMenu(); else loginBox(); });
  // one-time: an old per-browser layout from before server saving
  function offerMigration() {
    var old = null, oldKey = null;
    OLD_KEYS.forEach(function (k) { if (old) return; try { var v = JSON.parse(localStorage.getItem(k) || "null"); if (v && v.length) { old = v; oldKey = k; } } catch (e) {} });
    if (!old || !old.length) return;
    var ok = confirm("This browser has a saved layout for this page from before. Use my saved layout for everyone?");
    function clear() { OLD_KEYS.forEach(function (k) { localStorage.removeItem(k); }); }
    if (ok && template) { render(old); save(old).then(function (done) { if (done) clear(); }); }
    else clear();
  }
  var cached = null; try { cached = JSON.parse(localStorage.getItem(CACHE) || "null"); } catch (e) {}
  if (cached && cached.length && template) render(cached); // fast paint; the server copy below wins
  fetch("/api/startlayout?page=" + PAGE, { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
    if (drag || pop) return;
    if (j.layout && j.layout.length && template) { render(j.layout); try { localStorage.setItem(CACHE, JSON.stringify(j.layout)); } catch (e) {} }
    else if (!j.layout && cached) { render(defaults); localStorage.removeItem(CACHE); }
  }).catch(function () {});
  fetch("/api/startlogin?page=" + PAGE, { credentials: "same-origin", cache: "no-store" }).then(function (r) { return r.json(); })
    .then(function (j) { if (j.loggedIn) { setEdit(true); offerMigration(); } }).catch(function () {});
  document.addEventListener("click", function (e) { if (pop && !pop.contains(e.target) && !justOpened) closePop(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closePop(); });
  void defaults;
})();
