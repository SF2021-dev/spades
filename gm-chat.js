/* Google-Messages-style chat chrome (2026-10-30): left sidebar (A-Z) + bubble layout. Old look: chat-style-backup-2026-10-30/ */
(function(){
  var GROUP = /^\/group-chat/.test(location.pathname);
  document.body.classList.add("gm", GROUP ? "gm-gc" : "gm-dm");
  var card = document.querySelector(".card"); if (!card) return;
  var side = document.createElement("aside"); side.id = "gm-side"; card.insertBefore(side, card.firstChild);
  side.innerHTML = '<div id="gm-head"></div><div id="gm-tools"></div><div id="gm-list"></div><nav id="gm-foot"><a class="gm-fl" href="/">HOME</a></nav>';

  var hd = side.querySelector("#gm-head"), tools = side.querySelector("#gm-tools"), list = side.querySelector("#gm-list");
  if (!GROUP) { // start-chat request box + incoming requests live at the top of the left sidebar
    var cmp = document.querySelector("#pick .compose");
    ["pending"].forEach(function(i){ var e = document.getElementById(i); if (e) tools.appendChild(e); });
    if (cmp) tools.insertBefore(cmp, tools.firstChild);
    ["notfound", "perr"].forEach(function(i){ var e = document.getElementById(i); if (e) tools.insertBefore(e, cmp ? cmp.nextSibling : null); });
    var ri = document.getElementById("rname"); if (ri) { ri.placeholder = "+ member"; ri.value = ""; [50,300,1000,2500].forEach(function(t){ setTimeout(function(){ if (document.activeElement !== ri) ri.value = ""; }, t); }); }
  }
  var qs = new URLSearchParams(location.search), selTo = (qs.get("to") || "").toLowerCase(), selG = qs.get("g") || "";
  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function az(a, b){ return a.toLowerCase().localeCompare(b.toLowerCase()); }
  function ago(t){ if (!t) return ""; var m = Math.round((Date.now() - t) / 60000); return m < 1 ? "now" : m < 60 ? m + " min" : m < 1440 ? Math.round(m/60) + " hr" : new Date(t).toLocaleDateString([], {month:"short", day:"numeric"}); }
  function get(u){ return fetch(u, {credentials:"same-origin", cache:"no-store"}).then(function(r){ if (!r.ok) throw 0; return r.json(); }); }
  function row(href, name, avName, snip, time, sel){
    return '<a class="gm-row' + (sel ? ' sel' : '') + '" href="' + href + '"><span class="gm-av" data-av="' + esc(avName) + '">' + esc((name || "?").charAt(0).toUpperCase()) + '</span>' +
      '<span class="gm-tx"><div class="gm-nm">' + esc(name) + '</div>' + (snip ? '<div class="gm-sn">' + esc(snip) + '</div>' : '') + '</span>' + (time ? '<span class="gm-tm">' + esc(time) + '</span>' : '') + '</a>';
  }
  function reqRow(name, html){ return '<div class="gm-req">' + html + '<button type="button" class="gm-x" title="Delete request" aria-label="Delete request" data-cancel="' + esc(name) + '">&times;</button></div>'; }
  function ctRow(n, fav, html){ return '<div class="gm-ct" data-n="' + esc(n) + '">' + html + '<button type="button" class="gm-dots" title="Options" aria-label="Options">&#8942;</button><div class="gm-menu"><label><input type="checkbox" class="gm-fav"' + (fav ? ' checked' : '') + '> Favorite</label><button type="button" class="gm-addg">add to group chat</button><button type="button" class="gm-newg">new group chat</button><button type="button" class="gm-remg">remove from group chat</button><button type="button" class="gm-del">delete</button><button type="button" class="gm-blk">block</button>' +
    '<span class="gm-sure">Are you sure? <button type="button" class="gm-y">Y</button> <button type="button" class="gm-n">N</button></span></div></div>'; }
  function gpost(o){ return fetch("/api/groupchat", {method:"POST", credentials:"same-origin", headers:{"Content-Type":"application/json"}, body: JSON.stringify(o)}).then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ if (!r.ok) throw new Error(j.error || j.message || "Failed"); return j; }); }); }
  function pickGroup(gs, label){ if (!gs.length) { alert("No group chats to " + label + "."); return null; }
    var s = prompt("Pick a group chat to " + label + " (number):\n" + gs.map(function(g, i){ return (i + 1) + ". " + (g.title || g.members.map(function(m){ return m.name; }).join(", ")); }).join("\n"), "1");
    var k = parseInt(s, 10); return k >= 1 && k <= gs.length ? gs[k - 1] : null; }
  function myGroups(){ return Promise.all([get("/api/groupchat?action=mine"), get("/api/groupchat?action=rooms").catch(function(){ return {rooms:[]}; })]).then(function(a){
    var tt = {}; (a[1].rooms || []).forEach(function(r){ tt[r.gid] = r.title; }); return (a[0].groups || []).filter(function(g){ return g.myStatus === "ok"; }).map(function(g){ g.title = tt[g.gid]; return g; }); }); }
  function closeMenus(x){ side.querySelectorAll(".gm-ct.open").forEach(function(c){ if (c !== x) c.classList.remove("open", "asking"); }); }
  document.addEventListener("click", function(e){ if (!(e.target.closest && e.target.closest(".gm-ct"))) closeMenus(null); });
  side.addEventListener("click", function(e){
    var t = e.target, ct = t.closest && t.closest(".gm-ct"); if (!ct) return; var n = ct.getAttribute("data-n");
    if (t.classList.contains("gm-dots")) { e.preventDefault(); e.stopPropagation(); closeMenus(ct); ct.classList.toggle("open"); ct.classList.remove("asking"); return; }
    if (t.classList.contains("gm-addg")) { e.preventDefault(); ct.classList.remove("open"); myGroups().then(function(gs){ var g = pickGroup(gs, "add " + n + " to"); if (!g) return;
      return gpost({action:"invite", gid:g.gid, names:[n]}).then(function(){ alert(n + " was invited to the group chat."); }); }).catch(function(er){ alert(er.message || "Couldn't add to group chat."); }); return; }
    if (t.classList.contains("gm-remg")) { e.preventDefault(); ct.classList.remove("open"); myGroups().then(function(gs){ gs = gs.filter(function(g){ return g.members.some(function(m){ return m.name.toLowerCase() === n.toLowerCase(); }); });
      var g = pickGroup(gs, "remove " + n + " from"); if (!g) return; return gpost({action:"kick", gid:g.gid, name:n}).then(function(){ alert(n + " was removed from the group chat."); }); }).catch(function(er){ alert(er.message || "Couldn't remove from group chat."); }); return; }
    if (t.classList.contains("gm-newg")) { e.preventDefault(); ct.classList.remove("open"); var title = prompt("Title for the new group chat with " + n + ":", "Chat with " + n); if (title === null) return;
      var more = prompt("Add more names (comma-separated, optional):", ""); if (more === null) return;
      var names = [n].concat(more.split(",").map(function(x){ return x.trim(); }).filter(Boolean));
      gpost({action:"room", title:title || ("Chat with " + n), inviteOnly:true, names:names}).then(function(r){ location.href = "/group-chat?g=" + r.gid; }).catch(function(er){ alert(er.message || "Couldn't create group chat."); }); return; }
  });
  function post(o){ return fetch("/api/chat", {method:"POST", credentials:"same-origin", headers:{"Content-Type":"application/json"}, body: JSON.stringify(o)}).then(function(r){ if (!r.ok) throw 0; }); }
  side.addEventListener("change", function(e){ var c = e.target; if (!c.classList || !c.classList.contains("gm-fav")) return;
    var n = c.closest(".gm-ct").getAttribute("data-n"); post({action:"fav", with:n, on:c.checked}).then(load).catch(function(){ alert("Couldn't save favorite."); }); });
  side.addEventListener("click", function(e){
    var t = e.target, ct = t.closest && t.closest(".gm-ct"); if (!ct || !t.closest(".gm-menu")) return;
    if (t.classList.contains("gm-blk")) { e.preventDefault(); var bn = ct.getAttribute("data-n"); if (!confirm("Block " + bn + "? They won't be able to message you.")) return;
      post({action:"block", with:bn}).then(function(){ ct.remove(); if (bn.toLowerCase() === selTo) location.href = "/chat"; else load(); }).catch(function(){ alert("Couldn't block that player."); }); return; }
    if (t.classList.contains("gm-del")) { e.preventDefault(); ct.classList.add("asking"); }
    else if (t.classList.contains("gm-n")) { e.preventDefault(); ct.classList.remove("asking"); }
    else if (t.classList.contains("gm-y")) { e.preventDefault(); var n = ct.getAttribute("data-n");
      post({action:"remove", with:n}).then(function(){ ct.remove(); if (n.toLowerCase() === selTo) location.href = "/chat"; else load(); }).catch(function(){ alert("Couldn't delete that contact."); }); }
  });
  side.addEventListener("click", function(e){
    var b = e.target.closest && e.target.closest(".gm-x"); if (!b) return; e.preventDefault(); e.stopPropagation();
    var n = b.getAttribute("data-cancel"); b.disabled = true;
    fetch("/api/chat", {method:"POST", credentials:"same-origin", headers:{"Content-Type":"application/json"}, body: JSON.stringify({action:"cancel", to:n})})
      .then(function(r){ if (!r.ok) throw 0; var w = b.closest(".gm-req"); if (w) w.remove(); if (n.toLowerCase() === selTo) location.href = "/chat"; else load(); })
      .catch(function(){ b.disabled = false; alert("Couldn't delete that request."); });
  });
  var AVM = null, avP = get("/avatars.json?v=2").then(function(m){ AVM = m || {}; }).catch(function(){ AVM = {}; });
  function avatars(){
    avP.then(function(){ side.querySelectorAll(".gm-av[data-av]").forEach(function(s){ var n = s.dataset.av; s.removeAttribute("data-av"); if (!n) return;
      var f = AVM[n.toLowerCase()] || n;
      var im = new Image(); im.alt = ""; im.onload = function(){ s.textContent = ""; s.appendChild(im); }; im.src = "/" + encodeURIComponent(f) + "-ava.png"; }); });
  }
  function head(){
    return (GROUP ? '<div class="gm-brand"><span>Folders</span><a href="/chat">Private chat &raquo;</a></div>' : '') +
      (GROUP ? '<a class="gm-start" href="/group-chat#new">&#128172; Create folder</a>' : '');
  }
  function load(){
    var p = GROUP ? get("/api/groupchat?action=rooms").then(function(j){
      var rs = (j.rooms || []).slice().sort(function(a, b){ return az(a.title, b.title); });
      return '<div class="gm-sec">Folders</div>' + (rs.length ? rs.map(function(r){
        return row("/group-chat?g=" + encodeURIComponent(r.gid), (r.inviteOnly ? "\u2709 " : "") + (r.hasPassword ? "\uD83D\uDD12 " : "") + r.title, r.owner,
          "by " + r.owner + " \u00b7 " + r.count + " in folder", ago(r.last), r.gid === selG); }).join("") : '<div class="gm-empty">No folders yet.</div>');
    }) : get("/api/chat?action=partners").then(function(j){
      var fv = {}; (j.favorites || []).forEach(function(n){ fv[n.toLowerCase()] = 1; });
      var ps = (j.partners || []).slice().sort(function(a, b){ var fa = fv[a.toLowerCase()] ? 0 : 1, fb = fv[b.toLowerCase()] ? 0 : 1; return fa - fb || az(a, b); }), out = (j.outgoing || []).slice().sort(function(a, b){ return az(a.name, b.name); });
      return '<div class="gm-sec">Players</div>' + (ps.length ? ps.map(function(n){ return ctRow(n, !!fv[n.toLowerCase()], row("/chat?to=" + encodeURIComponent(n), (fv[n.toLowerCase()] ? "\u2605 " : "") + n, n, "", "", n.toLowerCase() === selTo)); }).join("") : '<div class="gm-empty">Nobody yet &mdash; enter a username above.</div>') +
        (out.length ? '<div class="gm-sec">Your requests</div>' + out.map(function(o){ return reqRow(o.name, row("/chat?to=" + encodeURIComponent(o.name), o.name, o.name, o.status === "no" ? "declined" : "awaiting approval", "", o.name.toLowerCase() === selTo)); }).join("") : "");
    });
    hd.innerHTML = head();
    p.then(function(h){ if (list.querySelector('.gm-ct.asking, .gm-ct.open')) return; list.innerHTML = h; avatars(); }).catch(function(){});
  }
  load(); setInterval(function(){ if (!document.hidden) load(); }, 30000); document.addEventListener("visibilitychange", function(){ if (!document.hidden) load(); });
  if (GROUP && location.hash === "#new") setTimeout(function(){ var t = document.getElementById("gtitle"); if (t) t.focus(); }, 800);
  // once msgbox.js has built the box: put the tool icons and a send button inside the compose pill
  var iv = setInterval(function(){
    var c = document.getElementById("mb-compose"), t = document.getElementById("mb-tools"), f = document.getElementById("mb-form");
    if (!c || !t || !f) return; clearInterval(iv);
    c.insertBefore(t, c.firstChild);
    var pl = document.createElement("button"); pl.type = "button"; pl.id = "gm-plus"; pl.title = "More: emoji, color, picture, buzz"; pl.setAttribute("aria-label", "More tools"); pl.setAttribute("aria-expanded", "false"); pl.textContent = "+";
    pl.addEventListener("mousedown", function(e){ e.preventDefault(); });
    pl.onclick = function(){ var on = !c.classList.contains("gm-tools-on"); c.classList.toggle("gm-tools-on", on); pl.setAttribute("aria-expanded", on ? "true" : "false"); };
    c.insertBefore(pl, c.firstChild);
    // after a tool is used (emoji picked, outline/color finished, picture chosen) collapse back to just "+"
    function doCollapse(){
      var cc = document.getElementById("mb-compose") || c, pp = document.getElementById("gm-plus") || pl;
      cc.classList.remove("gm-tools-on"); if (c !== cc) c.classList.remove("gm-tools-on"); pp.setAttribute("aria-expanded", "false");
    }
    var ct = 0;
    function collapse(){ clearTimeout(ct); ct = setTimeout(doCollapse, 20); }
    var emoUsed = false, cpStep = "";
    function onUse(e){
      var t = e.target; if (!t || !t.closest) return;
      var b = t.closest("button,[role=menuitem],[role=menuitemradio]"); if (!b) return;
      if (b.closest("#ds-emopick")) { emoUsed = true; collapse(); return; }
      var cp = b.closest("#ds-colpick"), h = cp && cp.querySelector(".cp-head");
      if (h && h.textContent.trim().toLowerCase() === "outline") collapse();
    }
    document.addEventListener("click", onUse, true);
    document.addEventListener("pointerup", function(e){ if (e.pointerType && e.pointerType !== "mouse") onUse(e); }, true);
    // popup watcher: emoji picker dismissed after a pick, or color popup closed from the outline step -> collapse
    var chk = 0;
    new MutationObserver(function(){
      var cp = document.getElementById("ds-colpick"), ep = document.getElementById("ds-emopick");
      if (cp) { var h = cp.querySelector(".cp-head"); cpStep = h ? h.textContent.trim().toLowerCase() : ""; }
      else if (cpStep) { var was = cpStep; cpStep = ""; clearTimeout(chk); chk = setTimeout(function(){ if (!document.getElementById("ds-colpick") && was === "outline") collapse(); }, 40); }
      if (!ep && emoUsed) { emoUsed = false; collapse(); }
    }).observe(document.body, {childList: true});
    document.addEventListener("change", function(e){ var f = e.target; if (f && f.id === "mb-imgfile" && f.files && f.files.length) collapse(); }, true);
    var s = document.createElement("button"); s.type = "button"; s.id = "gm-send"; s.title = "Send"; s.setAttribute("aria-label", "Send");
    s.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 20.5v-17L22 12z"/></svg>';
    s.onclick = function(){ if (f.requestSubmit) f.requestSubmit(); else f.dispatchEvent(new Event("submit", {cancelable:true})); };
    c.appendChild(s);
  }, 250);
})();
