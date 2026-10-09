/* Diamond Spaders message box: fills <div id="ds-msgbox">.
   Messages are saved to the site's own API (/api/messages, Cloudflare D1) so every visitor sees them,
   then also emailed via FormSubmit as a notification. /messages.json is a backup archive, shown only if the API is down.
   Shown oldest first; under the list a compose line reads "username: <type here>" (Enter sends, Shift+Enter newline, click the name to change it). */
(function(){
  var ENDPOINT = "https://formsubmit.co/ajax/f865a31f1882069405c71e61dc656f64";
  var API = "/api/messages";
  var ARCHIVE = "/messages.json";
  var LOCAL = "ds-mb-msgs";           // offline cache of the last list seen
  var SHOW = 50, KEEP = 200;
  var box = document.getElementById("ds-msgbox");
  if (!box) return;
  var F = "'Comic Sans MS','Comic Sans',cursive";
  box.style.cssText = "max-width:100%;width:100%;margin:24px 0 8px;padding:0 8px;box-sizing:border-box;font-family:" + F + ";";
  var css = document.createElement("style");
  css.textContent =
    "#ds-msgbox .mb-card{background:#000;border:1px solid #f3bf56;border-radius:10px;padding:14px 16px}" +
    "#ds-msgbox .mb-title{color:#f3bf56;font-size:18px;font-weight:700;margin-bottom:8px}" +
    "#ds-msgbox .mb-msgs{background:#f3bf56;border:1px solid #cb972e;border-radius:8px;padding:10px 12px;margin-bottom:12px;min-height:120px;max-height:min(50vh,480px);overflow:auto}" +
    "#ds-msgbox .mb-msgs:empty::before{content:'Messages will show here';color:#666;font-size:14px}" +
    "#ds-msgbox .mb-line{font-size:15px;color:#000;line-height:1.35;padding:8px 0;border-bottom:1px solid #cb972e;overflow-wrap:anywhere;font-weight:700}" +
    "#ds-msgbox .mb-line:last-child{border-bottom:0}" +
    "#ds-msgbox .mb-who{color:#008000;font-weight:700}" +
    "#ds-msgbox .mb-body{white-space:pre-wrap;overflow-wrap:anywhere;color:#000;font-weight:700}" +
    "#ds-msgbox .mb-wrap{background:#f3bf56;border:1px solid #cb972e;border-radius:8px;margin-bottom:6px;overflow:hidden}" +
    "#ds-msgbox .mb-wrap .mb-msgs{border:0;border-radius:0;margin:0}" +
    "#ds-msgbox .mb-compose{display:flex;align-items:flex-start;border-top:2px solid #cb972e;padding:8px 12px;cursor:text;font-size:15px;line-height:1.35}" +
    "#ds-msgbox .mb-compose .mb-who{white-space:nowrap;cursor:pointer;padding-top:2px}" +
    "#ds-msgbox .mb-compose .mb-colon{padding-top:2px;white-space:pre}" +
    "#ds-msgbox #mb-text{flex:1;min-width:0;background:transparent;color:#000;border:0;outline:0;resize:none;padding:2px 0;margin:0;font:15px " + F + ";line-height:1.35;height:22px;overflow:hidden}" +
    "#ds-msgbox #mb-text::placeholder{color:#6b5310;font-style:italic}" +
    "#ds-msgbox .mb-compose:focus-within{background:#f7cf78}" +
    "#ds-msgbox .mb-status{color:#f3bf56;font-size:14px;min-height:20px;margin-top:4px}";
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
    // drop exact name+message dupes (keep earliest)
    var byKey = {}, uniq = [];
    out.sort(function(a, b){ return a.t - b.t; }).forEach(function(m){
      var k = m.name + "\0" + m.message;
      if (byKey[k]) return;
      byKey[k] = 1; uniq.push(m);
    });
    return uniq;
  }
  function parseList(txt){
    try { var d = JSON.parse(txt); return Array.isArray(d) ? d : (d && Array.isArray(d.messages) ? d.messages : []); }
    catch(e){ return []; }
  }
  function getShared(){
    return fetch(API + "?t=" + Date.now(), {cache: "no-store"})
      .then(function(r){ if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); }).then(parseList);
  }
  function postShared(entry){
    return fetch(API, {method: "POST", headers: {"Content-Type": "application/json", "Accept": "application/json"},
      body: JSON.stringify({id: entry.id, name: entry.name, message: entry.message})})
      .then(function(r){
        return r.json().catch(function(){ return {}; }).then(function(d){
          if (!r.ok || !d.ok) throw new Error(d.error || ("HTTP " + r.status));
          return parseList(JSON.stringify(d));
        });
      });
  }
  function getArchive(){
    return fetch(ARCHIVE + "?t=" + Date.now(), {cache: "no-store"})
      .then(function(r){ return r.ok ? r.text() : "[]"; }).then(parseList).catch(function(){ return []; });
  }
  function localList(){ try { return parseList(localStorage.getItem(LOCAL) || "[]"); } catch(e){ return []; } }
  function saveLocal(list){ try { localStorage.setItem(LOCAL, JSON.stringify(list.slice(-SHOW))); } catch(e){} }
  function render(list){
    var el = document.getElementById("mb-msgs");
    el.innerHTML = "";
    list.slice().sort(function(a, b){ return (a.t||0) - (b.t||0); }).slice(-SHOW).forEach(function(m){
      var d = document.createElement("div");
      d.className = "mb-msg";
      d.innerHTML = '<div class="mb-line"><span class="mb-who"></span><span class="mb-colon">: </span><span class="mb-body"></span></div>';
      d.querySelector(".mb-who").textContent = m.name;
      d.querySelector(".mb-body").textContent = m.message;
      el.appendChild(d);
    });
  }

  box.innerHTML =
    '<div class="mb-card">' +
    '<div class="mb-title">Messages</div>' +
    '<form id="mb-form" autocomplete="off"><div class="mb-wrap">' +
    '<div class="mb-msgs" id="mb-msgs"></div>' +
    '<div class="mb-compose" id="mb-compose"><span class="mb-who" id="mb-who" title="Click to change your name"></span><span class="mb-colon" id="mb-colon">: </span>' +
    '<textarea id="mb-text" rows="1" maxlength="1000" aria-label="Message"></textarea></div></div>' +
    '<input type="text" id="mb-hp" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">' +
    '<div class="mb-status" id="mb-status"></div></form></div>';

  var form = document.getElementById("mb-form"), st = document.getElementById("mb-status");
  var ta = document.getElementById("mb-text"), who = document.getElementById("mb-who"), colon = document.getElementById("mb-colon");
  var sending = false, askingName = false;
  var msgs = merge(localList());
  render(msgs);
  var savedName = ""; try { savedName = (localStorage.getItem("ds-mb-name") || "").trim().slice(0, 40); } catch(e){}

  function grow(){ ta.style.height = "22px"; ta.style.height = Math.min(ta.scrollHeight, 200) + "px"; ta.style.overflow = ta.scrollHeight > 200 ? "auto" : "hidden"; }
  function showCompose(){
    if (askingName) {
      who.textContent = "Your name"; colon.textContent = ": ";
      ta.placeholder = "type your name or username, then press Enter"; ta.maxLength = 40;
    } else if (savedName) {
      who.textContent = savedName; colon.textContent = ": ";
      ta.placeholder = "click here to type a message (Enter to send)"; ta.maxLength = 1000;
    } else {
      who.textContent = ""; colon.textContent = "";
      ta.placeholder = "click here to write a message"; ta.maxLength = 1000;
    }
    grow();
  }
  function askName(){
    askingName = true; ta.dataset.draft = ta.value; ta.value = savedName; showCompose(); ta.focus(); ta.select();
  }
  showCompose();
  document.getElementById("mb-compose").addEventListener("mousedown", function(ev){
    if (ev.target === who) { ev.preventDefault(); if (!askingName) askName(); return; }
    if (ev.target !== ta) { ev.preventDefault(); ta.focus(); }
  });
  ta.addEventListener("focus", function(){ if (!savedName && !askingName) askName(); });
  ta.addEventListener("input", grow);
  ta.addEventListener("keydown", function(ev){
    if (ev.key === "Escape" && askingName && savedName) { askingName = false; ta.value = ta.dataset.draft || ""; showCompose(); return; }
    if (ev.key !== "Enter" || ev.shiftKey || ev.isComposing) return;
    ev.preventDefault();
    if (askingName) {
      var n = ta.value.replace(/\s+/g, " ").trim().slice(0, 40);
      if (!n) { st.textContent = "Please type your name or username first."; return; }
      savedName = n; try { localStorage.setItem("ds-mb-name", n); } catch(e){}
      askingName = false; st.textContent = ""; ta.value = ta.dataset.draft || ""; showCompose(); ta.focus();
      return;
    }
    form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", {cancelable: true}));
  });

  var apiDown = false;
  function refresh(){
    return getShared().then(function(list){
      apiDown = false;
      msgs = merge(list);
      saveLocal(msgs); render(msgs);
      if (st.dataset.err === "load") { st.textContent = ""; st.dataset.err = ""; }
    }).catch(function(){
      // API unreachable: fall back to the backup archive (or this browser's last copy) so the box isn't empty
      apiDown = true;
      return getArchive().then(function(arch){
        msgs = merge(arch.length ? arch : localList());
        render(msgs);
        st.textContent = "Messages are temporarily unavailable; showing a saved copy."; st.dataset.err = "load";
      });
    });
  }
  refresh();
  setInterval(function(){ if (!document.hidden) refresh(); }, 30000);

  form.addEventListener("submit", function(ev){
    ev.preventDefault();
    if (sending || askingName) return;
    var name = savedName, msg = ta.value.trim().slice(0, 1000);
    if (!name) { askName(); return; }
    if (!msg) { st.textContent = "Type a message, then press Enter."; return; }
    if (document.getElementById("mb-hp").value) return;   // bot filled the honeypot
    sending = true; ta.readOnly = true; st.textContent = "Sending…"; st.dataset.err = "";
    var entry = {id: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8), name: name, message: msg, t: Date.now()};
    postShared(entry).then(function(list){
      ta.value = ""; grow();
      msgs = merge(list);
      saveLocal(msgs); render(msgs);
      st.textContent = "";
      var el = document.getElementById("mb-msgs"); el.scrollTop = el.scrollHeight;
      // email notification only after the message is saved for everyone; failures here don't matter to the poster
      fetch(ENDPOINT, {method: "POST", headers: {"Content-Type": "application/json", "Accept": "application/json"},
        body: JSON.stringify({name: name, message: msg, _subject: "Diamond Spaders message from " + name,
                              _template: "table", _captcha: "false", _honey: ""})}).catch(function(){});
    }).catch(function(e){
      st.textContent = "Sorry, your message was NOT posted (" + (e && e.message || "network error") + "). Please try again.";
      st.dataset.err = "send";
    }).finally(function(){ sending = false; ta.readOnly = false; });
  });
})();
