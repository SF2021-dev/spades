/* Google-Messages-style chat chrome (2026-10-30): left sidebar (A-Z) + bubble layout. Old look: chat-style-backup-2026-10-30/ */
(function(){
  var GROUP = /^\/group-chat/.test(location.pathname);
  document.body.classList.add("gm", GROUP ? "gm-gc" : "gm-dm");
  var card = document.querySelector(".card"); if (!card) return;
  var side = document.createElement("aside"); side.id = "gm-side"; card.insertBefore(side, card.firstChild);
  var qs = new URLSearchParams(location.search), selTo = (qs.get("to") || "").toLowerCase(), selG = qs.get("g") || "";
  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function az(a, b){ return a.toLowerCase().localeCompare(b.toLowerCase()); }
  function ago(t){ if (!t) return ""; var m = Math.round((Date.now() - t) / 60000); return m < 1 ? "now" : m < 60 ? m + " min" : m < 1440 ? Math.round(m/60) + " hr" : new Date(t).toLocaleDateString([], {month:"short", day:"numeric"}); }
  function get(u){ return fetch(u, {credentials:"same-origin", cache:"no-store"}).then(function(r){ if (!r.ok) throw 0; return r.json(); }); }
  function row(href, name, avName, snip, time, sel){
    return '<a class="gm-row' + (sel ? ' sel' : '') + '" href="' + href + '"><span class="gm-av" data-av="' + esc(avName) + '">' + esc((name || "?").charAt(0).toUpperCase()) + '</span>' +
      '<span class="gm-tx"><div class="gm-nm">' + esc(name) + '</div>' + (snip ? '<div class="gm-sn">' + esc(snip) + '</div>' : '') + '</span>' + (time ? '<span class="gm-tm">' + esc(time) + '</span>' : '') + '</a>';
  }
  function avatars(){
    side.querySelectorAll(".gm-av[data-av]").forEach(function(s){ var n = s.dataset.av; s.removeAttribute("data-av"); if (!n) return;
      var im = new Image(); im.alt = ""; im.onload = function(){ s.textContent = ""; s.appendChild(im); }; im.src = "/" + encodeURIComponent(n) + "-ava.png"; });
  }
  function head(){
    return '<div class="gm-brand"><span>' + (GROUP ? "Group chats" : "Messages") + '</span><a href="' + (GROUP ? "/chat" : "/group-chat") + '">' + (GROUP ? "Private chat" : "Group chats") + ' &raquo;</a></div>' +
      (GROUP ? '<a class="gm-start" href="/group-chat#new">&#128172; Start group chat</a>' : '<a class="gm-start" href="/chat">&#128172; Start chat</a>');
  }
  function load(){
    var p = GROUP ? get("/api/groupchat?action=rooms").then(function(j){
      var rs = (j.rooms || []).slice().sort(function(a, b){ return az(a.title, b.title); });
      return '<div class="gm-sec">Group chats</div>' + (rs.length ? rs.map(function(r){
        return row("/group-chat?g=" + encodeURIComponent(r.gid), (r.inviteOnly ? "\u2709 " : "") + (r.hasPassword ? "\uD83D\uDD12 " : "") + r.title, r.owner,
          "by " + r.owner + " \u00b7 " + r.count + " in chat", ago(r.last), r.gid === selG); }).join("") : '<div class="gm-empty">No group chats yet.</div>');
    }) : get("/api/chat?action=partners").then(function(j){
      var ps = (j.partners || []).slice().sort(az), out = (j.outgoing || []).slice().sort(function(a, b){ return az(a.name, b.name); });
      return '<div class="gm-sec">Players</div>' + (ps.length ? ps.map(function(n){ return row("/chat?to=" + encodeURIComponent(n), n, n, "", "", n.toLowerCase() === selTo); }).join("") : '<div class="gm-empty">Nobody yet &mdash; Start chat to ask someone.</div>') +
        (out.length ? '<div class="gm-sec">Your requests</div>' + out.map(function(o){ return row("/chat?to=" + encodeURIComponent(o.name), o.name, o.name, o.status === "no" ? "declined" : "waiting for approval", "", o.name.toLowerCase() === selTo); }).join("") : "");
    });
    p.then(function(h){ side.innerHTML = head() + h; avatars(); }).catch(function(){ side.innerHTML = head(); });
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
