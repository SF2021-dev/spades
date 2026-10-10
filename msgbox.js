/* Diamond Spaders message box: fills <div id="ds-msgbox">.
   Messages are saved to the site's own API (/api/messages, Cloudflare D1) so every visitor sees them,
   then also emailed via FormSubmit as a notification. /messages.json is a backup archive, shown only if the API is down.
   Shown oldest first; under the list a compose line reads "username: <type here>" (Enter sends, Shift+Enter newline, click the name to change it). Hint "type here (enter to send)" shows only until first typing/send (localStorage ds-mb-hint-seen).
   PIN: each name has a 3-digit PIN on the server (/api/pin, hashed in D1). First time a name is used the box asks to create
   one (typed twice) plus an email address (server keeps only a hash); after that the PIN is asked once per browser tab session and sent with every message (server checks it).
   Emoji: the smiley button left of the compose line opens a 2-column wooden-shelf picker (sprites in /emoji/, cropped from the
   owner's MyLeague-style sheet, see emoji/SOURCE.txt). Picking one inserts a code like :smile: at the cursor; codes render as images.
   Text color: the rainbow ball right of the smiley opens a color menu. The chosen color (localStorage ds-mb-color) is applied to the whole
   message by prefixing [c=name] when it is sent; with text selected, the pick wraps just that text as [c=name]...[/c]. "remove color"
   clears it (default black text). Only names in COLORS render; tags are stripped from the email notification. */
(function(){
  var ENDPOINT = "https://formsubmit.co/ajax/f865a31f1882069405c71e61dc656f64";
  var API = "/api/messages", PIN_API = "/api/pin";
  var ARCHIVE = "/messages.json";
  var LOCAL = "ds-mb-msgs";           // offline cache of the last list seen
  var SHOW = 50, KEEP = 200;
  var box = document.getElementById("ds-msgbox");
  if (!box) return;
  var F = "'Comic Sans MS','Comic Sans',cursive";
  var EMO_V = "1", EMO_DIR = "/emoji/";
  var EMOJI = [["cool",23,23],["confused",23,23],["dizzy",23,23],["silly",23,23],["angry",23,23],["grin",23,23],["shocked",23,23],["surprised",23,23],
    ["meh",23,23],["smile",23,23],["sad",23,23],["neutral",23,23],["worried",23,23],["zipped",23,23],["annoyed",23,23],["wink",23,23],
    ["unsure",23,23],["upset",23,23],["sleepy",23,23],["laugh",23,23],["ninja",23,23],["angel",47,23],["devil",47,23],["afk",23,22],
    ["brb",22,22],["music",19,22],["duck",39,26],["rainbow",55,31],["stars",55,31],["redstar",20,21],["greenstar",20,19],["bluestar",20,19]];
  var EMO = {}; EMOJI.forEach(function(e){ EMO[e[0]] = e; });
  function emoImg(n){
    var e = EMO[n], im = document.createElement("img");
    im.src = EMO_DIR + n + ".png?v=" + EMO_V; im.width = e[1]; im.height = e[2]; im.alt = ":" + n + ":"; im.title = ":" + n + ":";
    im.className = "mb-emo"; im.draggable = false; return im;
  }
  // hue -> [light, medium, dark] as [tag name, hex]. Medium keeps the original tag names so older messages still render.
  var COLORS = [
    ["red",    [["lightred","#ff5c5c"],["red","#c00000"],["darkred","#700000"]]],
    ["blue",   [["lightblue","#5b9bff"],["blue","#0033cc"],["darkblue","#001a66"]]],
    ["green",  [["lightgreen","#3cc43c"],["green","#006400"],["darkgreen","#003300"]]],
    ["purple", [["lightpurple","#b26bff"],["purple","#6a0dad"],["darkpurple","#3a0063"]]],
    ["orange", [["lightorange","#ffa040"],["orange","#c45000"],["darkorange","#7a3000"]]],
    ["pink",   [["lightpink","#ff7ac0"],["pink","#d0006f"],["darkpink","#80003f"]]],
    ["teal",   [["lightteal","#3fd6d6"],["teal","#007373"],["darkteal","#003b3b"]]],
    ["brown",  [["lightbrown","#b5774a"],["brown","#5c2e00"],["darkbrown","#2e1600"]]],
    ["white",  [["lightwhite","#ffffff"],["white","#e8e8e8"],["darkwhite","#b8b8b8"]]]];
  var CMAP = {}, CLABEL = {}, SHADE = ["light", "medium", "dark"];
  COLORS.forEach(function(h){ h[1].forEach(function(c, i){ CMAP[c[0]] = c[1]; CLABEL[c[0]] = (i === 1 ? "" : SHADE[i] + " ") + h[0]; }); });
  function cShadow(n){ return /white$/.test(n) ? "0 0 2px #000" : (/^light/.test(n) ? "0 0 1px #000" : ""); }
  var CKEY = "ds-mb-color";
  function stripTags(t){ return t.replace(/\[c=[a-z]+\]|\[\/c\]/g, ""); }
  function fillRich(el, text){   // [c=name]..[/c] color spans (unclosed runs to end), then emoji inside
    var re = /\[c=([a-z]+)\]|\[\/c\]/g, last = 0, m, cur = el;
    function put(t){ if (t) fillBody(cur, t); }
    while ((m = re.exec(text))) {
      if (m[1] && !CMAP[m[1]]) continue;   // unknown color: leave as text
      put(text.slice(last, m.index)); last = re.lastIndex;
      if (m[1]) { var sp = document.createElement("span"); sp.style.color = CMAP[m[1]]; sp.style.textShadow = cShadow(m[1]); el.appendChild(sp); cur = sp; }
      else cur = el;
    }
    put(text.slice(last));
  }
  function fillBody(el, text){   // text with :code: emoji -> text nodes + <img>
    var re = /:([a-z]+):/g, last = 0, m;
    while ((m = re.exec(text))) {
      if (!EMO[m[1]]) { re.lastIndex = m.index + 1; continue; }
      if (m.index > last) el.appendChild(document.createTextNode(text.slice(last, m.index)));
      el.appendChild(emoImg(m[1])); last = re.lastIndex;
    }
    if (last < text.length) el.appendChild(document.createTextNode(text.slice(last)));
  }
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
    "#ds-msgbox #mb-email{flex:1;min-width:0;background:#fff8e6;color:#000;border:1px solid #cb972e;border-radius:4px;outline:0;padding:1px 6px;margin:0;font:700 15px " + F + "}" +
    "#ds-msgbox .mb-pinhint{color:#6b5310;font-style:italic;padding:2px 0 0 8px;font-size:14px}" +
    "#ds-msgbox .mb-compose:focus-within{background:#f7cf78}" +
    "#ds-msgbox .mb-status{color:#f3bf56;font-size:14px;min-height:20px;margin-top:4px}" +
    "#ds-msgbox .mb-emo{vertical-align:middle;display:inline-block;margin:0 1px}" +
    "#ds-msgbox .mb-emobtn{flex:none;background:transparent;border:0;padding:2px;margin:0;cursor:pointer;line-height:0;min-width:32px;min-height:32px;display:flex;align-items:center;justify-content:center;border-radius:6px}" +
    "#ds-msgbox .mb-tools{display:flex;align-items:center;gap:6px;border-top:1px solid #cb972e;padding:4px 10px}" +
    "#ds-msgbox .mb-emobtn:hover,#ds-msgbox .mb-emobtn[aria-expanded=true]{background:#e6ad3a}" +
    "#ds-emopick{position:absolute;z-index:9999;width:281px;max-width:calc(100vw - 16px);max-height:min(60vh,434px);overflow-y:auto;overscroll-behavior:contain;" +
      "display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:62px;background:#5a1c08 url(/emoji/shelf.png?v=1) 0 0/100% 62px repeat-y;background-attachment:local;" +
      "border:2px solid #f3bf56;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.6);padding:0;box-sizing:border-box}" +
    "#ds-emopick button{background:transparent;border:0;margin:0;padding:0 0 13px;cursor:pointer;display:flex;align-items:center;justify-content:center;min-height:44px;border-radius:6px}" +
    "#ds-emopick button:hover,#ds-emopick button:focus-visible{background:rgba(243,191,86,.22);outline:0}" +
    "#ds-emopick img{pointer-events:none}" +
    "#ds-msgbox .mb-ball{display:block;width:23px;height:23px;border-radius:50%;box-shadow:inset -2px -3px 5px rgba(0,0,0,.35),0 0 0 1px #6b5310;" +
      "background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.95) 0,rgba(255,255,255,.35) 18%,rgba(255,255,255,0) 40%)," +
      "conic-gradient(red,orange,yellow,lime,cyan,blue,magenta,red)}" +
    "#ds-colpick{position:absolute;z-index:9999;width:236px;max-width:calc(100vw - 16px);max-height:min(75vh,500px);overflow-y:auto;background:#000;border:2px solid #f3bf56;border-radius:10px;" +
      "box-shadow:0 6px 20px rgba(0,0,0,.6);padding:4px;box-sizing:border-box;font-family:" + F + "}" +
    "#ds-colpick button{display:flex;align-items:center;gap:10px;width:100%;min-height:40px;background:transparent;border:0;border-radius:6px;padding:4px 8px;margin:0;" +
      "cursor:pointer;color:#f3bf56;font:700 15px " + F + ";text-align:left}" +
    "#ds-colpick button:hover,#ds-colpick button:focus-visible{background:#2a2000;outline:0}" +
    "#ds-colpick button[aria-checked=true]{background:#3a2c00}" +
    "#ds-colpick .sw{flex:none;width:20px;height:20px;border-radius:50%;border:1px solid #f3bf56}" +
    "#ds-colpick .cp-grid{display:grid;grid-template-columns:62px repeat(3,1fr);gap:2px 4px;align-items:center;margin-top:4px;border-top:1px solid #6b5310;padding-top:4px}" +
    "#ds-colpick .cp-h{color:#c9a227;font:700 12px " + F + ";text-align:center}" +
    "#ds-colpick .cp-hue{color:#f3bf56;font:700 14px " + F + ";padding-left:4px}" +
    "#ds-colpick .cp-grid button{justify-content:center;padding:0;min-height:40px}" +
    "#ds-colpick .cp-grid .sw{width:26px;height:26px}" +
    "#ds-colpick button[aria-checked=true] .sw{box-shadow:0 0 0 2px #000,0 0 0 4px #f3bf56}";
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
      fillRich(d.querySelector(".mb-body"), m.message);
      el.appendChild(d);
    });
  }

  box.innerHTML =
    '<div class="mb-card">' +
    '<div class="mb-title">Messages</div>' +
    '<form id="mb-form" autocomplete="off"><div class="mb-wrap">' +
    '<div class="mb-msgs" id="mb-msgs"></div>' +
    '<div class="mb-compose" id="mb-compose">' +
    '<span class="mb-who" id="mb-who" title="Click to change your name"></span>' +
    '<textarea id="mb-text" rows="1" maxlength="1000" aria-label="Message"></textarea>' +
    '<input type="password" id="mb-pin" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" aria-label="3-digit PIN" style="display:none">' +
    '<input type="email" id="mb-email" maxlength="254" autocomplete="email" aria-label="Your email address" placeholder="you@example.com" style="display:none">' +
    '<span class="mb-pinhint" id="mb-pinhint" style="display:none"></span></div>' +
    '<div class="mb-tools" id="mb-tools">' +
    '<button type="button" class="mb-emobtn" id="mb-emobtn" aria-label="Emoji" aria-haspopup="true" aria-expanded="false" title="Emoji">' +
    '<img src="' + EMO_DIR + 'smile.png?v=' + EMO_V + '" width="23" height="23" alt=""></button>' +
    '<button type="button" class="mb-emobtn" id="mb-colbtn" aria-label="Text color" aria-haspopup="true" aria-expanded="false" title="Text color"><span class="mb-ball"></span></button></div></div>' +
    '<input type="text" id="mb-hp" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">' +
    '<div class="mb-status" id="mb-status"></div></form></div>';

  var form = document.getElementById("mb-form"), st = document.getElementById("mb-status");
  var ta = document.getElementById("mb-text"), who = document.getElementById("mb-who"), colon = document.getElementById("mb-colon");
  var addrIn = document.getElementById("mb-email"), pinIn = document.getElementById("mb-pin"), pinHint = document.getElementById("mb-pinhint");
  var sending = false, askingName = false;
  var pinMode = "", firstPin = "", sendAfterPin = false;   // pinMode: "" | "check" (looking up) | "new" | "confirm" | "email" | "enter"
  var msgs = merge(localList());
  render(msgs);
  var savedName = ""; try { savedName = (localStorage.getItem("ds-mb-name") || "").trim().slice(0, 40); } catch(e){}

  var HINTKEY = "ds-mb-hint-seen", HINT = "type here (enter to send)";
  function hintSeen(){ try { return localStorage.getItem(HINTKEY) === "1"; } catch(e){ return false; } }
  function markHint(){ if (hintSeen()) return; try { localStorage.setItem(HINTKEY, "1"); } catch(e){} if (!askingName && !pinMode) ta.placeholder = ""; }
  function grow(){ ta.style.height = "22px"; ta.style.height = Math.min(ta.scrollHeight, 200) + "px"; ta.style.overflow = ta.scrollHeight > 200 ? "auto" : "hidden"; }
  var PINKEY = "ds-mb-pin";   // sessionStorage: {name, pin} once verified for this tab
  function getPin(){ try { var d = JSON.parse(sessionStorage.getItem(PINKEY) || "null"); return d && d.name === savedName ? d.pin : ""; } catch(e){ return ""; } }
  function savePin(p){ try { if (p) sessionStorage.setItem(PINKEY, JSON.stringify({name: savedName, pin: p})); else sessionStorage.removeItem(PINKEY); } catch(e){} }
  function pinPost(action, pin, email){
    return fetch(PIN_API, {method: "POST", headers: {"Content-Type": "application/json", "Accept": "application/json"},
      body: JSON.stringify({name: savedName, pin: pin, email: email, action: action})})
      .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(d){ d.status = r.status; d.ok = r.ok && d.ok; return d; }); });
  }
  function showCompose(){
    var pinning = !!pinMode && !askingName;
    ta.style.display = pinning ? "none" : "";
    pinIn.style.display = (pinning && pinMode !== "check" && pinMode !== "email") ? "" : "none";
    addrIn.style.display = (pinning && pinMode === "email") ? "" : "none";
    pinHint.style.display = pinning ? "" : "none";
    if (pinning) {
      who.textContent = savedName + ":";
      pinHint.textContent = {check: "checking PIN…", "new": "create a 3-digit PIN (000-999), then press Enter",
        confirm: "type the same PIN again to confirm", email: "Enter to save",
        enter: "enter your 3-digit PIN, then press Enter"}[pinMode];
      return;
    }
    if (askingName) {
      who.textContent = "Your name:";
      ta.placeholder = "type your name or username, then press Enter"; ta.maxLength = 40;
    } else if (savedName) {
      who.textContent = savedName + ":";
      ta.placeholder = hintSeen() ? "" : HINT; ta.maxLength = 1000;
    } else {
      who.textContent = ""; if (colon) colon.textContent = "";
      ta.placeholder = hintSeen() ? "" : HINT; ta.maxLength = 1000;
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
  function startPin(mode){ pinMode = mode; pinIn.value = ""; showCompose(); (mode === "email" ? addrIn : pinIn).focus(); }
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
    var a = addrIn.value.trim().toLowerCase(), p = firstPin;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(a)) { st.textContent = "Please enter a valid email address (like name@example.com)."; return; }
    st.textContent = "Saving PIN…"; addrIn.readOnly = true;
    pinPost("set", p, a).then(function(d){
      if (d.ok) { st.textContent = "PIN saved. Remember it: you'll need it to send messages as " + savedName + "."; pinDone(p); return; }
      if (d.status === 409) { firstPin = ""; st.textContent = "That name already has a PIN. Please enter it."; startPin("enter"); return; }
      if (d.status === 400 && /email/i.test(d.error || "")) { st.textContent = d.error; addrIn.focus(); return; }
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
      st.textContent = "Now type your email address, then press Enter."; startPin("email"); return;
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
    if (emoBtn.contains(ev.target) || colBtn.contains(ev.target)) { ev.preventDefault(); return; }   // keep the textarea's cursor; click handler toggles the picker
    if (ev.target === who) { ev.preventDefault(); if (!askingName) askName(); return; }
    if (ev.target === pinIn) return;
    if (ev.target === addrIn) return;
    if (pinMode) { ev.preventDefault(); if (pinMode === "email") addrIn.focus(); else if (pinMode !== "check") pinIn.focus(); return; }
    if (ev.target !== ta) { ev.preventDefault(); ta.focus(); }
  });
  ta.addEventListener("focus", function(){ if (!askingName && !pinMode) { try { localStorage.setItem(HINTKEY, "1"); } catch(e){} }   // seen once: keep it this visit, gone next time
    if (!savedName && !askingName) askName(); else needPin(); });
  ta.addEventListener("input", function(){ grow(); if (!askingName && !pinMode && ta.value) markHint(); });
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

  document.getElementById("mb-tools").addEventListener("mousedown", function(ev){ ev.preventDefault(); });
  // ---- emoji picker ----
  var emoBtn = document.getElementById("mb-emobtn"), pick = null, selA = 0, selB = 0;
  function rememberSel(){ if (!askingName && !pinMode) { selA = ta.selectionStart; selB = ta.selectionEnd; } }
  ["keyup", "mouseup", "input", "select", "blur", "touchend"].forEach(function(t){ ta.addEventListener(t, rememberSel); });
  function placePick(){
    if (!pick) return;
    var r = emoBtn.getBoundingClientRect(), pw = pick.offsetWidth, ph = pick.offsetHeight;
    var left = Math.max(8, Math.min(r.left, document.documentElement.clientWidth - pw - 8));
    var top = (r.top - ph - 6 >= 8) ? r.top - ph - 6 : r.bottom + 6;   // above the button if it fits, else below
    pick.style.left = (left + window.scrollX) + "px"; pick.style.top = (top + window.scrollY) + "px";
  }
  function insertEmo(n){
    var code = ":" + n + ":";
    if (askingName) { ta.dataset.draft = (ta.dataset.draft || "") + code; st.textContent = "Emoji added to your message. Finish your name first (Enter)."; return; }
    var v = ta.value, a = Math.min(selA, v.length), b = Math.min(Math.max(selB, a), v.length);
    if (v.length - (b - a) + code.length > 1000) { st.textContent = "Message is too long for another emoji."; return; }
    ta.value = v.slice(0, a) + code + v.slice(b); selA = selB = a + code.length;
    grow(); markHint();
    if (!pinMode && ta.style.display !== "none") {
      if (document.activeElement === ta) { try { ta.setSelectionRange(selA, selB); } catch(e){} }
      else if (!(window.matchMedia && matchMedia("(pointer: coarse)").matches)) { ta.focus(); try { ta.setSelectionRange(selA, selB); } catch(e){} }
    }
  }
  function openPick(){
    if (pick) return;
    if (typeof closeCol === "function") closeCol();
    pick = document.createElement("div"); pick.id = "ds-emopick"; pick.setAttribute("role", "menu"); pick.setAttribute("aria-label", "Emoji");
    EMOJI.forEach(function(e){
      var b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "menuitem"); b.title = ":" + e[0] + ":"; b.setAttribute("aria-label", e[0]);
      var im = emoImg(e[0]); im.className = ""; b.appendChild(im);
      b.addEventListener("mousedown", function(ev){ ev.preventDefault(); });   // don't steal focus from the textarea
      b.addEventListener("click", function(ev){ ev.preventDefault(); insertEmo(e[0]); });
      pick.appendChild(b);
    });
    document.body.appendChild(pick); emoBtn.setAttribute("aria-expanded", "true"); placePick();
  }
  function closePick(){ if (!pick) return; pick.remove(); pick = null; emoBtn.setAttribute("aria-expanded", "false"); }
  emoBtn.addEventListener("click", function(ev){ ev.preventDefault(); ev.stopPropagation(); if (pick) closePick(); else { rememberSel(); openPick(); } });
  document.addEventListener("mousedown", function(ev){ if (pick && !pick.contains(ev.target) && !emoBtn.contains(ev.target)) closePick(); }, true);
  document.addEventListener("touchstart", function(ev){ if (pick && !pick.contains(ev.target) && !emoBtn.contains(ev.target)) closePick(); }, {capture: true, passive: true});
  document.addEventListener("keydown", function(ev){ if (ev.key === "Escape" && pick) { closePick(); emoBtn.focus(); } });
  window.addEventListener("resize", placePick);

  // ---- text color ----
  var colBtn = document.getElementById("mb-colbtn"), cpick = null;
  function getColor(){ try { var c = localStorage.getItem(CKEY) || ""; return CMAP[c] ? c : ""; } catch(e){ return ""; } }
  function applyColor(){ var c = getColor(); ta.style.color = c ? CMAP[c] : "#000"; ta.style.textShadow = c ? cShadow(c) : ""; }
  applyColor();
  function closeCol(){ if (!cpick) return; cpick.remove(); cpick = null; colBtn.setAttribute("aria-expanded", "false"); }
  function pickColor(c){
    var v = ta.value, a = Math.min(selA, v.length), b = Math.min(Math.max(selB, a), v.length);
    if (c && b > a && !askingName && !pinMode) {   // color just the selected text
      var piece = "[c=" + c + "]" + v.slice(a, b) + "[/c]";
      if (v.length - (b - a) + piece.length > 1000) { st.textContent = "Message is too long to color that."; closeCol(); return; }
      ta.value = v.slice(0, a) + piece + v.slice(b); selA = selB = a + piece.length; grow();
      st.textContent = "Colored the selected text " + CLABEL[c] + ".";
    } else {
      try { if (c) localStorage.setItem(CKEY, c); else localStorage.removeItem(CKEY); } catch(e){}
      applyColor(); st.textContent = c ? "Your messages will be " + CLABEL[c] + "." : "Color removed.";
    }
    closeCol();
    if (!pinMode && !askingName && !(window.matchMedia && matchMedia("(pointer: coarse)").matches)) { ta.focus(); try { ta.setSelectionRange(selA, selB); } catch(e){} }
  }
  function openCol(){
    if (cpick) return;
    closePick();
    cpick = document.createElement("div"); cpick.id = "ds-colpick"; cpick.setAttribute("role", "menu"); cpick.setAttribute("aria-label", "Text color");
    var cur = getColor();
    function mkBtn(name, label){
      var b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "menuitemradio");
      b.setAttribute("aria-checked", String(name === cur && !!name)); b.title = label; b.setAttribute("aria-label", label);
      var sw = document.createElement("span"); sw.className = "sw";
      sw.style.background = name ? CMAP[name] : "linear-gradient(135deg,#000 45%,#c00000 45%,#c00000 55%,#000 55%)";
      b.appendChild(sw);
      b.addEventListener("mousedown", function(ev){ ev.preventDefault(); });
      b.addEventListener("click", function(ev){ ev.preventDefault(); pickColor(name); });
      return b;
    }
    var rm = mkBtn("", "remove color"), lb = document.createElement("span"); lb.textContent = "remove color"; rm.appendChild(lb); cpick.appendChild(rm);
    var g = document.createElement("div"); g.className = "cp-grid";
    ["", "Light", "Medium", "Dark"].forEach(function(t){ var h = document.createElement("span"); h.className = "cp-h"; h.textContent = t; g.appendChild(h); });
    COLORS.forEach(function(h){
      var hl = document.createElement("span"); hl.className = "cp-hue"; hl.textContent = h[0]; g.appendChild(hl);
      h[1].forEach(function(c){ g.appendChild(mkBtn(c[0], CLABEL[c[0]])); });
    });
    cpick.appendChild(g);
    document.body.appendChild(cpick); colBtn.setAttribute("aria-expanded", "true");
    var r = colBtn.getBoundingClientRect(), pw = cpick.offsetWidth, ph = cpick.offsetHeight;
    var left = Math.max(8, Math.min(r.left, document.documentElement.clientWidth - pw - 8));
    var top = (r.top - ph - 6 >= 8) ? r.top - ph - 6 : r.bottom + 6;
    cpick.style.left = (left + window.scrollX) + "px"; cpick.style.top = (top + window.scrollY) + "px";
  }
  colBtn.addEventListener("click", function(ev){ ev.preventDefault(); ev.stopPropagation(); if (cpick) closeCol(); else { rememberSel(); openCol(); } });
  document.addEventListener("mousedown", function(ev){ if (cpick && !cpick.contains(ev.target) && !colBtn.contains(ev.target)) closeCol(); }, true);
  document.addEventListener("touchstart", function(ev){ if (cpick && !cpick.contains(ev.target) && !colBtn.contains(ev.target)) closeCol(); }, {capture: true, passive: true});
  document.addEventListener("keydown", function(ev){ if (ev.key === "Escape" && cpick) { closeCol(); colBtn.focus(); } });

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
    var name = savedName, msg = ta.value.trim(), col = getColor();
    if (msg && col && msg.indexOf("[c=") !== 0) msg = "[c=" + col + "]" + msg;
    msg = msg.slice(0, 1000);
    if (!name) { askName(); return; }
    if (!stripTags(msg).trim()) { st.textContent = "Type a message, then press Enter."; return; }
    if (document.getElementById("mb-hp").value) return;   // bot filled the honeypot
    var pin = getPin();
    if (!pin) { sendAfterPin = true; needPin(); return; }
    sending = true; ta.readOnly = true; st.textContent = "Sending…"; st.dataset.err = "";
    var entry = {id: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8), name: name, message: msg, pin: pin, t: Date.now()};
    postShared(entry).then(function(list){
      ta.value = ""; markHint(); grow();
      msgs = merge(list);
      saveLocal(msgs); render(msgs);
      st.textContent = "";
      var el = document.getElementById("mb-msgs"); el.scrollTop = el.scrollHeight;
      // email notification only after the message is saved for everyone; failures here don't matter to the poster
      fetch(ENDPOINT, {method: "POST", headers: {"Content-Type": "application/json", "Accept": "application/json"},
        body: JSON.stringify({name: name, message: stripTags(msg), _subject: "Diamond Spaders message from " + name,
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
