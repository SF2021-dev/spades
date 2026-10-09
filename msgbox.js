/* Diamond Spaders message box: fills <div id="ds-msgbox">.
   Messages are saved to the site's own API (/api/messages, Cloudflare D1) so every visitor sees them,
   then also emailed via FormSubmit as a notification. /messages.json is a backup archive, shown only if the API is down.
   Shown oldest first; under the list a compose line reads "username: <type here>" (Enter sends, Shift+Enter newline, click the name to change it).
   PIN: each name has a 3-digit PIN on the server (/api/pin, hashed in D1). First time a name is used the box asks to create
   one (typed twice) plus an address (street/city, free text; server keeps only a hash); after that the PIN is asked once per browser tab session and sent with every message (server checks it). */
(function(){
  var ENDPOINT = "https://formsubmit.co/ajax/f865a31f1882069405c71e61dc656f64";
  var API = "/api/messages", PIN_API = "/api/pin";
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
    "#ds-msgbox #mb-pin{width:5.5em;background:#fff8e6;color:#000;border:1px solid #cb972e;border-radius:4px;outline:0;padding:1px 6px;margin:0;font:700 15px " + F + ";letter-spacing:4px}" +
    "#ds-msgbox #mb-addr{flex:1;min-width:0;background:#fff8e6;color:#000;border:1px solid #cb972e;border-radius:4px;outline:0;padding:1px 6px;margin:0;font:700 15px " + F + "}" +
    "#ds-msgbox .mb-pinhint{color:#6b5310;font-style:italic;padding:2px 0 0 8px;font-size:14px}" +
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
      body: JSON.stringify({id: entry.id, name: entry.name, message: entry.message, pin: entry.pin})})
      .then(function(r){
        return r.json().catch(function(){ return {}; }).then(function(d){
          if (!r.ok || !d.ok) { var e = new Error(d.error || ("HTTP " + r.status)); e.status = r.status; throw e; }
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
    '<textarea id="mb-text" rows="1" maxlength="1000" aria-label="Message"></textarea>' +
    '<input type="password" id="mb-pin" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" aria-label="3-digit PIN" style="display:none">' +
    '<input type="text" id="mb-addr" maxlength="120" autocomplete="street-address" aria-label="Your address" placeholder="street and city" style="display:none">' +
    '<span class="mb-pinhint" id="mb-pinhint" style="display:none"></span></div></div>' +
    '<input type="text" id="mb-hp" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">' +
    '<div class="mb-status" id="mb-status"></div></form></div>';

  var form = document.getElementById("mb-form"), st = document.getElementById("mb-status");
  var ta = document.getElementById("mb-text"), who = document.getElementById("mb-who"), colon = document.getElementById("mb-colon");
  var addrIn = document.getElementById("mb-addr"), pinIn = document.getElementById("mb-pin"), pinHint = document.getElementById("mb-pinhint");
  var sending = false, askingName = false;
  var pinMode = "", firstPin = "", sendAfterPin = false;   // pinMode: "" | "check" (looking up) | "new" | "confirm" | "address" | "enter"
  var msgs = merge(localList());
  render(msgs);
  var savedName = ""; try { savedName = (localStorage.getItem("ds-mb-name") || "").trim().slice(0, 40); } catch(e){}

  function grow(){ ta.style.height = "22px"; ta.style.height = Math.min(ta.scrollHeight, 200) + "px"; ta.style.overflow = ta.scrollHeight > 200 ? "auto" : "hidden"; }
  var PINKEY = "ds-mb-pin";   // sessionStorage: {name, pin} once verified for this tab
  function getPin(){ try { var d = JSON.parse(sessionStorage.getItem(PINKEY) || "null"); return d && d.name === savedName ? d.pin : ""; } catch(e){ return ""; } }
  function savePin(p){ try { if (p) sessionStorage.setItem(PINKEY, JSON.stringify({name: savedName, pin: p})); else sessionStorage.removeItem(PINKEY); } catch(e){} }
  function pinPost(action, pin, address){
    return fetch(PIN_API, {method: "POST", headers: {"Content-Type": "application/json", "Accept": "application/json"},
      body: JSON.stringify({name: savedName, pin: pin, address: address, action: action})})
      .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(d){ d.status = r.status; d.ok = r.ok && d.ok; return d; }); });
  }
  function showCompose(){
    var pinning = !!pinMode && !askingName;
    ta.style.display = pinning ? "none" : "";
    pinIn.style.display = (pinning && pinMode !== "check" && pinMode !== "address") ? "" : "none";
    addrIn.style.display = (pinning && pinMode === "address") ? "" : "none";
    pinHint.style.display = pinning ? "" : "none";
    if (pinning) {
      who.textContent = savedName; colon.textContent = ": ";
      pinHint.textContent = {check: "checking PIN…", "new": "create a 3-digit PIN (000-999), then press Enter",
        confirm: "type the same PIN again to confirm", address: "Enter to save",
        enter: "enter your 3-digit PIN, then press Enter"}[pinMode];
      return;
    }
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
    pinMode = ""; askingName = true; ta.dataset.draft = ta.value; ta.value = savedName; showCompose(); ta.focus(); ta.select();
  }
  // Make sure this tab has a verified PIN for savedName; if not, switch the compose line to PIN entry.
  function needPin(){
    if (!savedName || askingName || pinMode || getPin()) return false;
    pinMode = "check"; showCompose(); st.textContent = "";
    var forName = savedName;
    fetch(PIN_API + "?name=" + encodeURIComponent(savedName) + "&t=" + Date.now(), {cache: "no-store"})
      .then(function(r){ if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function(d){ if (forName !== savedName || pinMode !== "check") return; startPin(d.hasPin ? "enter" : "new"); })
      .catch(function(){ if (pinMode === "check") { pinMode = ""; showCompose(); st.textContent = "Couldn't check your PIN (network). Click the message line to try again."; } });
    return true;
  }
  function startPin(mode){ pinMode = mode; pinIn.value = ""; showCompose(); (mode === "address" ? addrIn : pinIn).focus(); }
  function pinDone(p){
    savePin(p); pinMode = ""; firstPin = ""; pinIn.value = ""; addrIn.value = ""; showCompose(); ta.focus();
    if (sendAfterPin && ta.value.trim()) { sendAfterPin = false; form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", {cancelable: true})); }
    sendAfterPin = false;
  }
  function cancelPin(){ pinMode = ""; firstPin = ""; sendAfterPin = false; addrIn.value = ""; showCompose(); st.textContent = "You need your PIN to send a message."; }
  addrIn.addEventListener("keydown", function(ev){
    if (ev.key === "Escape") { cancelPin(); return; }
    if (ev.key !== "Enter" || ev.isComposing) return;
    ev.preventDefault();
    var a = addrIn.value.replace(/\s+/g, " ").trim(), p = firstPin;
    if (a.replace(/[^A-Za-z0-9\u00C0-\uFFFF]/g, "").length < 5 || a.indexOf(" ") < 0) { st.textContent = "Please enter your address (street and city, for example)."; return; }
    st.textContent = "Saving PIN…"; addrIn.readOnly = true;
    pinPost("set", p, a).then(function(d){
      if (d.ok) { st.textContent = "PIN saved. Remember it: you'll need it to send messages as " + savedName + "."; pinDone(p); return; }
      if (d.status === 409) { firstPin = ""; st.textContent = "That name already has a PIN. Please enter it."; startPin("enter"); return; }
      if (d.status === 400 && /address/i.test(d.error || "")) { st.textContent = d.error; addrIn.focus(); return; }
      st.textContent = d.error || "Couldn't save the PIN. Please try again."; firstPin = ""; startPin("new");
    }).catch(function(){ st.textContent = "Couldn't save the PIN (network). Please press Enter to try again."; addrIn.focus(); })
      .finally(function(){ addrIn.readOnly = false; });
  });
  pinIn.addEventListener("input", function(){ pinIn.value = pinIn.value.replace(/\D/g, "").slice(0, 3); });
  pinIn.addEventListener("keydown", function(ev){
    if (ev.key === "Escape") { cancelPin(); return; }
    if (ev.key !== "Enter" || ev.isComposing) return;
    ev.preventDefault();
    var p = pinIn.value;
    if (!/^\d{3}$/.test(p)) { st.textContent = "The PIN must be exactly 3 digits (000-999)."; return; }
    if (pinMode === "new") { firstPin = p; st.textContent = ""; startPin("confirm"); return; }
    if (pinMode === "confirm") {
      if (p !== firstPin) { firstPin = ""; st.textContent = "Those PINs didn't match. Please create your PIN again."; startPin("new"); return; }
      st.textContent = "Now type your address (street and city), then press Enter."; startPin("address"); return;
    }
    if (pinMode === "enter") {
      st.textContent = "Checking PIN…"; pinIn.readOnly = true;
      pinPost("check", p).then(function(d){
        if (d.ok) { st.textContent = ""; pinDone(p); return; }
        if (d.status === 428) { st.textContent = "This name has no PIN yet. Please create one."; startPin("new"); return; }
        st.textContent = d.error || "Wrong PIN. Please try again."; pinIn.value = ""; pinIn.focus();
      }).catch(function(){ st.textContent = "Couldn't check the PIN (network). Please try again."; })
        .finally(function(){ pinIn.readOnly = false; });
    }
  });
  showCompose();
  document.getElementById("mb-compose").addEventListener("mousedown", function(ev){
    if (ev.target === who) { ev.preventDefault(); if (!askingName) askName(); return; }
    if (ev.target === pinIn) return;
    if (ev.target === addrIn) return;
    if (pinMode) { ev.preventDefault(); if (pinMode === "address") addrIn.focus(); else if (pinMode !== "check") pinIn.focus(); return; }
    if (ev.target !== ta) { ev.preventDefault(); ta.focus(); }
  });
  ta.addEventListener("focus", function(){ if (!savedName && !askingName) askName(); else needPin(); });
  ta.addEventListener("input", grow);
  ta.addEventListener("keydown", function(ev){
    if (ev.key === "Escape" && askingName && savedName) { askingName = false; ta.value = ta.dataset.draft || ""; showCompose(); return; }
    if (ev.key !== "Enter" || ev.shiftKey || ev.isComposing) return;
    ev.preventDefault();
    if (askingName) {
      var n = ta.value.replace(/\s+/g, " ").trim().slice(0, 40);
      if (!n) { st.textContent = "Please type your name or username first."; return; }
      if (n !== savedName) savePin("");
      savedName = n; try { localStorage.setItem("ds-mb-name", n); } catch(e){}
      askingName = false; st.textContent = ""; ta.value = ta.dataset.draft || ""; showCompose();
      if (!needPin()) ta.focus();
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
    if (sending || askingName || pinMode) return;
    var name = savedName, msg = ta.value.trim().slice(0, 1000);
    if (!name) { askName(); return; }
    if (!msg) { st.textContent = "Type a message, then press Enter."; return; }
    if (document.getElementById("mb-hp").value) return;   // bot filled the honeypot
    var pin = getPin();
    if (!pin) { sendAfterPin = true; needPin(); return; }
    sending = true; ta.readOnly = true; st.textContent = "Sending…"; st.dataset.err = "";
    var entry = {id: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8), name: name, message: msg, pin: pin, t: Date.now()};
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
      if (e && (e.status === 401 || e.status === 428)) {   // PIN changed/reset on the server: ask again, keep the draft
        savePin(""); sending = false; ta.readOnly = false; sendAfterPin = true;
        needPin(); st.textContent = (e.message || "Please enter your PIN.") + " Your message was NOT posted yet.";
        return;
      }
      st.textContent = "Sorry, your message was NOT posted (" + (e && e.message || "network error") + "). Please try again.";
      st.dataset.err = "send";
    }).finally(function(){ sending = false; ta.readOnly = false; });
  });
})();
