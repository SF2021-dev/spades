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
    ".sm-ghost{position:fixed;z-index:999;pointer-events:none;opacity:.85;transform:scale(1.05);box-shadow:0 18px 40px rgba(0,0,0,.7);border-radius:10px;overflow:hidden}" +
    ".sm-ghost .sm-dots{display:none}" +
    ".sm-dragging{opacity:.3;outline:2px dashed #00d4ff;outline-offset:2px}" +
    ".sm-target{outline:3px solid #00d4ff;outline-offset:2px}" +
    ".sm-slot{position:fixed;z-index:998;pointer-events:none;border:2px dashed #00d4ff;border-radius:10px;background:rgba(0,212,255,.12)}" +
    ".icons-area .icon-row>a,.icons-area .icon-row>a img{-webkit-user-drag:none;user-select:none;touch-action:none}" +
    ".sm-plus{position:fixed;z-index:15;pointer-events:none;align-items:center;justify-content:center;border:2px dashed rgba(255,255,255,.35);border-radius:10px;background:rgba(255,255,255,.06);color:rgba(255,255,255,.6);font-weight:300;line-height:1}" +
    ".sm-pop .sm-head{font-size:12px;opacity:.7;padding:4px 12px}";
  document.head.appendChild(css);
  // fixed slots per row: start.html 9, start2 10 (start3 keeps width-based); those rows are centered
  var FIXED_CAP = /\/start\.html$/.test(location.pathname) ? 9 : /\/start[23]\/?(index\.html)?$/.test(location.pathname) ? 10 : 0;
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
    if (pop) return; // the other listener closes the menu
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
    if (drag || pop || e.pointerType === "touch" || !template) { showPlus(null); return; }
    showPlus(blankTarget(e.target) ? plusSlot(e.clientX, e.clientY) : null);
  });
  document.addEventListener("pointerleave", function () { showPlus(null); });

  var saved = null; try { saved = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
  if (saved && saved.length && template) render(saved); else decorate();
  document.addEventListener("click", function (e) { if (pop && !pop.contains(e.target) && !justOpened) closePop(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closePop(); });
  window.startMenuReset = function () { localStorage.removeItem(KEY); location.reload(); };
  void defaults;
})();
