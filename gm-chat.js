/* Google-Messages-style chat chrome (2026-10-30): left sidebar (A-Z) + bubble layout. Old look: chat-style-backup-2026-10-30/ */
(function(){
  var GROUP = /^\/group-chat/.test(location.pathname);
  document.body.classList.add("gm", GROUP ? "gm-gc" : "gm-dm");
  var card = document.querySelector(".card"); if (!card) return;
  var side = document.createElement("aside"); side.id = "gm-side"; card.insertBefore(side, card.firstChild);
  side.innerHTML = '<div id="gm-head"></div><div id="gm-tools"></div><div id="gm-list"></div><nav id="gm-foot"><a class="gm-fl" href="/group-chat">FOLDERS</a><div id="gm-aud"><a class="gm-fl" id="gm-audl" href="#">Diamond Spaders Live Audio</a></div><a class="gm-fl" href="/">HOME</a></nav>';
  (function(){ var aud = side.querySelector("#gm-aud"); var t = setInterval(function(){ var v = document.getElementById("dsv"); if (!v) return; clearInterval(t); aud.insertBefore(v, aud.firstChild); }, 200);
    side.querySelector("#gm-audl").onclick = function(e){ e.preventDefault(); var a = document.getElementById("dsva"); if (a) a.click(); }; })();
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
  function ctRow(n, fav, html){ return '<div class="gm-ct" data-n="' + esc(n) + '">' + html + '<div class="gm-menu"><label><input type="checkbox" class="gm-fav"' + (fav ? ' checked' : '') + '> favorite</label><button type="button" class="gm-del">delete</button>' +
    '<span class="gm-sure">Are you sure? <button type="button" class="gm-y">Y</button> <button type="button" class="gm-n">N</button></span></div></div>'; }
  function post(o){ return fetch("/api/chat", {method:"POST", credentials:"same-origin", headers:{"Content-Type":"application/json"}, body: JSON.stringify(o)}).then(function(r){ if (!r.ok) throw 0; }); }
  side.addEventListener("change", function(e){ var c = e.target; if (!c.classList || !c.classList.contains("gm-fav")) return;
    var n = c.closest(".gm-ct").getAttribute("data-n"); post({action:"fav", with:n, on:c.checked}).then(load).catch(function(){ alert("Couldn't save favorite."); }); });
  side.addEventListener("click", function(e){
    var t = e.target, ct = t.closest && t.closest(".gm-ct"); if (!ct || !t.closest(".gm-menu")) return;
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
  function avatars(){
    side.querySelectorAll(".gm-av[data-av]").forEach(function(s){ var n = s.dataset.av; s.removeAttribute("data-av"); if (!n) return;
      var im = new Image(); im.alt = ""; im.onload = function(){ s.textContent = ""; s.appendChild(im); }; im.src = "/" + encodeURIComponent(n) + "-ava.png"; });
  }
  function head(){
    return '<div class="gm-brand"><span>' + (GROUP ? "Folders" : "Messages") + '</span>' + (GROUP ? '<a href="/chat">Private chat &raquo;</a>' : '') + '</div>' +
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
        (out.length ? '<div class="gm-sec">Your requests</div>' + out.map(function(o){ return reqRow(o.name, row("/chat?to=" + encodeURIComponent(o.name), o.name, o.name, o.status === "no" ? "declined" : "waiting for approval", "", o.name.toLowerCase() === selTo)); }).join("") : "");
    });
    hd.innerHTML = head();
    p.then(function(h){ if (list.querySelector('.gm-ct.asking, .gm-ct:hover .gm-menu')) return; list.innerHTML = h; avatars(); }).catch(function(){});
  }
  load(); setInterval(load, 15000);
  if (GROUP && location.hash === "#new") setTimeout(function(){ var t = document.getElementById("gtitle"); if (t) t.focus(); }, 800);
  // once msgbox.js has built the box: put the tool icons and a send button inside the compose pill
  var iv = setInterval(function(){
    var c = document.getElementById("mb-compose"), t = document.getElementById("mb-tools"), f = document.getElementById("mb-form");
    if (!c || !t || !f) return; clearInterval(iv);
    c.insertBefore(t, c.firstChild);
    var s = document.createElement("button"); s.type = "button"; s.id = "gm-send"; s.title = "Send"; s.setAttribute("aria-label", "Send");
    s.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 20.5v-17L22 12z"/></svg>';
    s.onclick = function(){ if (f.requestSubmit) f.requestSubmit(); else f.dispatchEvent(new Event("submit", {cancelable:true})); };
    c.appendChild(s);
  }, 250);
})();
