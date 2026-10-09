/* Diamond Spaders message box: fills <div id="ds-msgbox">.
   Messages are emailed via FormSubmit AND saved to a shared store (textdb.dev) so every visitor sees them.
   The box also archives the store into https://diamondspaders.online/messages.json every few minutes (permanent copy).
   Shown newest first above the form. */
(function(){
  var ENDPOINT = "https://formsubmit.co/ajax/f865a31f1882069405c71e61dc656f64";
  var SHARED = "https://textdb.dev/api/data/ds-msgs-167a81f4-0419-4ca8-b5f6-cfda1cbf2745";
  var ARCHIVE = "https://diamondspaders.online/messages.json";
  var LOCAL = "ds-mb-msgs";           // old browser-only list (migrated once) + offline cache
  var SHOW = 50, KEEP = 200;
  var box = document.getElementById("ds-msgbox");
  if (!box) return;
  var F = "'Comic Sans MS','Comic Sans',cursive";
  box.style.cssText = "max-width:900px;margin:24px auto 8px;padding:0 12px;font-family:" + F + ";";
  var css = document.createElement("style");
  css.textContent =
    "#ds-msgbox .mb-card{background:#1a1200;border:1px solid #3a2c00;border-radius:10px;padding:14px 16px}" +
    "#ds-msgbox .mb-title{color:#fbe646;font-size:18px;font-weight:700;margin-bottom:8px}" +
    "#ds-msgbox .mb-msgs{background:#0a0a0a;border:1px solid #fbe646;border-radius:8px;padding:10px 12px;margin-bottom:12px;min-height:48px;max-height:220px;overflow:auto}" +
    "#ds-msgbox .mb-msgs:empty::before{content:'Messages will show here';color:#888;font-size:14px}" +
    "#ds-msgbox .mb-msg{border-bottom:1px solid #3a2c00;padding:8px 0;font-size:15px;color:#eee;line-height:1.35}" +
    "#ds-msgbox .mb-msg:last-child{border-bottom:0}" +
    "#ds-msgbox .mb-who{color:#fbe646;font-weight:700;margin-bottom:2px}" +
    "#ds-msgbox .mb-when{color:#998a3a;font-weight:400;font-size:12px;margin-left:8px}" +
    "#ds-msgbox .mb-body{white-space:pre-wrap;overflow-wrap:anywhere}" +
    "#ds-msgbox label{color:#fbe646;font-size:15px}" +
    "#ds-msgbox input[type=text],#ds-msgbox textarea{display:block;width:100%;box-sizing:border-box;background:#0a0a0a;color:#eee;border:1px solid #fbe646;border-radius:6px;padding:8px 10px;font:16px " + F + ";margin:4px 0 10px}" +
    "#ds-msgbox textarea{height:110px;resize:vertical}" +
    "#ds-msgbox button{background:#fbe646;color:#000;border:0;border-radius:6px;padding:8px 22px;font:700 16px " + F + ";cursor:pointer}" +
    "#ds-msgbox button:disabled{opacity:.5;cursor:default}" +
    "#ds-msgbox .mb-status{color:#fbe646;font-size:14px;min-height:20px;margin-top:8px}";
  document.head.appendChild(css);

  function clean(m){
    if (!m || typeof m !== "object") return null;
    var name = String(m.name == null ? "" : m.name).trim().slice(0, 40);
    var msg = String(m.message == null ? "" : m.message).trim().slice(0, 1000);
    if (!name || !msg) return null;
    var t = Number(m.t) || 0;
    return {id: String(m.id || ("legacy-" + t + "-" + name)).slice(0, 80), name: name, message: msg, t: t};
  }
  function merge(){
    var seen = {}, out = [];
    for (var i = 0; i < arguments.length; i++) (arguments[i] || []).forEach(function(m){
      m = clean(m); if (m && !seen[m.id]) { seen[m.id] = 1; out.push(m); }
    });
    return out.sort(function(a, b){ return b.t - a.t; });
  }
  function parseList(txt){
    try { var d = JSON.parse(txt); return Array.isArray(d) ? d : (d && Array.isArray(d.messages) ? d.messages : []); }
    catch(e){ return []; }
  }
  function getShared(){
    return fetch(SHARED + "?t=" + Date.now(), {cache: "no-store"})
      .then(function(r){ if (!r.ok) throw 0; return r.text(); }).then(parseList);
  }
  function putShared(list){   // text/plain = simple CORS request, no preflight
    return fetch(SHARED, {method: "POST", headers: {"Content-Type": "text/plain"},
      body: JSON.stringify({messages: list.slice(0, KEEP)})}).then(function(r){ if (!r.ok) throw 0; });
  }
  function getArchive(){
    return fetch(ARCHIVE + "?t=" + Date.now(), {cache: "no-store"})
      .then(function(r){ return r.ok ? r.text() : "[]"; }).then(parseList).catch(function(){ return []; });
  }
  function migrated(){ try { return !!localStorage.getItem("ds-mb-migrated"); } catch(e){ return true; } }
  function localList(){ try { return parseList(localStorage.getItem(LOCAL) || "[]"); } catch(e){ return []; } }
  function saveLocal(list){ try { localStorage.setItem(LOCAL, JSON.stringify(list.slice(0, SHOW))); } catch(e){} }
  function when(t){
    if (!t) return "";
    try { return new Date(t).toLocaleString([], {month: "short", day: "numeric", hour: "numeric", minute: "2-digit"}); }
    catch(e){ return ""; }
  }
  function render(list){
    var el = document.getElementById("mb-msgs");
    el.innerHTML = "";
    list.slice(0, SHOW).forEach(function(m){
      var d = document.createElement("div");
      d.className = "mb-msg";
      d.innerHTML = '<div class="mb-who"><span></span><span class="mb-when"></span></div><div class="mb-body"></div>';
      d.querySelector(".mb-who span").textContent = m.name;     // textContent = HTML escaped
      d.querySelector(".mb-when").textContent = when(m.t);
      d.querySelector(".mb-body").textContent = m.message;
      el.appendChild(d);
    });
  }

  box.innerHTML =
    '<div class="mb-card">' +
    '<div class="mb-title">Messages</div>' +
    '<div class="mb-msgs" id="mb-msgs"></div>' +
    '<div class="mb-title">Send a message</div>' +
    '<form id="mb-form" autocomplete="off">' +
    '<label for="mb-name">name or username:</label><input type="text" id="mb-name" maxlength="40" required>' +
    '<textarea id="mb-text" maxlength="1000" required aria-label="Message" placeholder="your message"></textarea>' +
    '<input type="text" id="mb-hp" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">' +
    '<button type="submit" id="mb-send">Send</button><div class="mb-status" id="mb-status"></div></form></div>';

  var form = document.getElementById("mb-form"), st = document.getElementById("mb-status"), btn = document.getElementById("mb-send");
  var msgs = merge(localList());
  render(msgs);
  var savedName = null; try { savedName = localStorage.getItem("ds-mb-name"); } catch(e){}
  if (savedName) document.getElementById("mb-name").value = savedName;

  function refresh(){
    return Promise.all([getShared().catch(function(){ return null; }), getArchive()]).then(function(r){
      var shared = r[0], archive = r[1], local = localList();
      if (shared && !shared.length && !archive.length && local.length && !migrated()) {
        // one-time migration of messages that only lived in this browser
        var mig = merge(local);
        putShared(mig).then(function(){ try { localStorage.setItem("ds-mb-migrated", "1"); } catch(e){} }).catch(function(){});
        shared = mig;
      }
      msgs = merge(shared || [], archive, shared ? [] : local);
      saveLocal(msgs);
      render(msgs);
    });
  }
  refresh();
  setInterval(function(){ if (!document.hidden) refresh(); }, 60000);

  form.addEventListener("submit", function(ev){
    ev.preventDefault();
    var name = document.getElementById("mb-name").value.trim().slice(0, 40), msg = document.getElementById("mb-text").value.trim().slice(0, 1000);
    if (!name || !msg) { st.textContent = "Please fill in your name and a message."; return; }
    if (document.getElementById("mb-hp").value) return;   // bot filled the honeypot
    btn.disabled = true; st.textContent = "Sending…";
    var entry = {id: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8), name: name, message: msg, t: Date.now()};
    var mail = fetch(ENDPOINT, {method: "POST", headers: {"Content-Type": "application/json", "Accept": "application/json"},
      body: JSON.stringify({name: name, message: msg, _subject: "Diamond Spaders message from " + name,
                            _template: "table", _captcha: "false", _honey: ""})})
      .then(function(r){ return r.json(); }).then(function(d){ return String(d.success) === "true"; }).catch(function(){ return false; });
    // re-read the latest shared list right before writing so we don't drop someone else's message
    var store = getShared().then(function(cur){ var next = merge([entry], cur); return putShared(next).then(function(){ return next; }); })
      .catch(function(){ return null; });
    Promise.all([mail, store]).then(function(r){
      if (!r[0] && !r[1]) { st.textContent = "Sorry, that didn't send. Please try again later."; return; }
      try { localStorage.setItem("ds-mb-name", name); } catch(e){}
      document.getElementById("mb-text").value = "";
      msgs = merge([entry], r[1] || [], msgs);
      saveLocal(msgs);
      render(msgs);
      st.textContent = r[1] ? "" : "Sent, but it may take a moment to show for everyone.";
    }).finally(function(){ btn.disabled = false; });
  });
})();
