/* Diamond Spaders message box: fills <div id="ds-msgbox">.
   Messages are saved to the site's own API (/api/messages, Cloudflare D1) so every visitor sees them,
   then also emailed via FormSubmit as a notification. /messages.json is a backup archive, shown only if the API is down.
   Shown oldest first; under the list a compose line reads "username: <type here>" (Enter sends, Shift+Enter newline, click the name to change it). Hint "type here (enter to send)" shows only until first typing/send (localStorage ds-mb-hint-seen).
   PIN: each name has a 3-digit PIN on the server (/api/pin, hashed in D1). First time a name is used the box asks to create
   one (typed twice) plus an email address (server keeps only a hash); after that the PIN is asked once per browser session (sessionStorage + session cookie ds_pin_session) and sent with every message (server checks it).
   Emoji: the smiley button left of the compose line opens a 2-column wooden-shelf picker (sprites in /emoji/, cropped from the
   owner's MyLeague-style sheet, see emoji/SOURCE.txt). Picking one inserts a code like :smile: at the cursor; codes render as images.
   Text color: the rainbow ball right of the smiley opens the color/outline pop-up. The chosen color (localStorage ds-mb-color) is applied to the whole
   message by prefixing [c=name] when it is sent; it is the "pen" for text typed after the pick; text already typed keeps its style
   (per-character runs shown in a mirror under the transparent textarea, serialized to [c=]/[o=] tags on send); with text selected,
   the pick restyles just that text. "remove color"
   clears it (default black text). Only names in COLORS render.
   Color and outline share one pop-up: the rainbow ball opens color swatches, in two steps (square box overlaid on the text input area, no scrolling): first the "color" box (remove color + swatches); picking one replaces it with the "outline" box (No Outline + every color).
   Outline: the outline section (black is the main one; also white/gold/red/blue/green). Saved in localStorage
   ds-mb-outline, sent as [o=name] prefix; outline with no color gets a white fill (black for white/gold outlines) (or [o=name]...[/o] around selected text). Rendered as a tight stroke hugging the glyphs (paint-order stroke fill,
   so the fill color stays fully visible, same text size) plus a 1px offset shadow. Color only = no outline.
   All [c=]/[o=] tags are stripped from the email notification.
   Pictures: picture button (file picker) or paste an image into the compose line (Ctrl/Cmd+V, or long-press Paste on phones); PIN-gated like sending. The image is resized in the browser (longest side <= 1000px, WebP/JPEG, aimed < 300 KB; GIFs are sent as-is, must be < 5 MB, to stay animated; a GIF copied from a web page is fetched by the server from its <img src>) and
   posted as its own message; the server stores it in D1 (msg_images) and the message reads "[img:<id>]", shown as "Name: <picture>"
   (thumbnail fits the message area; tap for full-screen view, tap again to close). */
(function(){
  var ENDPOINT = "https://formsubmit.co/ajax/f865a31f1882069405c71e61dc656f64";
  var API = "/api/messages", PIN_API = "/api/pin";
  var ARCHIVE = "/messages.json";
  var AD = window.DS_MB_ADAPTER || null;   // chat pages: {boxId,name,title,get():Promise<[{id,name,message,t}]>,post(text):Promise}
  var LOCAL = AD ? "ds-mb-chat-unused" : "ds-mb-msgs";           // offline cache of the last list seen
  var SHOW = 50, KEEP = 200;
  var box = document.getElementById(AD && AD.boxId || "ds-msgbox");
  if (!box) return;
  box.parentNode.appendChild(box);   // show messages at the bottom of the page (2026-10-18)
  var F = "'DS Coustard','Clarendon','Century Schoolbook',Georgia,serif";
  // Emoji: Twemoji SVGs (CC-BY 4.0, https://github.com/jdecked/twemoji), vendored in /emoji/ - see emoji/SOURCE.txt.
  var EMO_V = "2", EMO_DIR = "/emoji/", EMO_PX = 24;
  var EMOJI = ["cool","confused","dizzy","silly","angry","grin","shocked","surprised","meh","smile","sad","neutral",
    "worried","zipped","annoyed","wink","unsure","upset","sleepy","laugh","ninja","angel","devil","afk",
    "brb","music","duck","rainbow","stars","redstar","greenstar","bluestar"].map(function(n){ return [n, EMO_PX, EMO_PX]; });
  var EMO = {}; EMOJI.forEach(function(e){ EMO[e[0]] = e; });
  function emoImg(n){
    var e = EMO[n], im = document.createElement("img");
    im.src = EMO_DIR + n + ".svg?v=" + EMO_V; im.width = e[1]; im.height = e[2]; im.alt = ":" + n + ":"; im.title = ":" + n + ":";
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
  var CKEY = "ds-mb-color", OKEY = "ds-mb-outline";
  // outline colors: black + gold first, then every color/shade from the color box (same tag names, so older [o=red] etc. still render)
  var OUTLINES = [["black","#000000"],["gold","#f3bf56"]];
  COLORS.forEach(function(h){ h[1].forEach(function(c){ OUTLINES.push(c); }); });
  var OMAP = {}; OUTLINES.forEach(function(o){ OMAP[o[0]] = o[1]; });
  function oStyle(el, n, spaced){          // thick stroke behind the fill + slight offset shadow (3D)
    var h = OMAP[n];
    el.style.webkitTextStroke = "2.5px " + h; el.style.paintOrder = "stroke fill";   // tight: ~1px of stroke outside the glyph
    el.style.textShadow = "1px 1px 0 " + h;
    if (spaced) el.style.letterSpacing = "0.06em";   // posted messages only: a little air so outlined letters don't collide
                                                    // (not in the compose mirror, which must stay aligned with the textarea caret)
  }
  // outline with no color: light fill so the outline stays readable (white; dark fill kept for the light white/gold outlines)
  function oFill(n){ return (n === "gold" || /white/.test(n) || /^light/.test(n)) ? "#000" : "#ffffff"; }
  function oClear(el){ el.style.webkitTextStroke = ""; el.style.paintOrder = ""; }
  function stripTags(t){ return t.replace(/\[(c|o)=[a-z]+\]|\[\/(c|o)\]/g, ""); }
  function fillRich(el, text){   // [c=name]..[/c] color and [o=name]..[/o] outline runs (unclosed run to end), then emoji inside
    var re = /\[(c|o)=([a-z]+)\]|\[\/(c|o)\]/g, last = 0, m, col = "", ol = "";
    function put(t){
      if (!t) return;
      if (!col && !ol) { fillBody(el, t); return; }
      var sp = document.createElement("span");
      if (col) { sp.style.color = CMAP[col]; sp.style.textShadow = cShadow(col); }
      if (ol) { oStyle(sp, ol, true); if (!col) sp.style.color = oFill(ol); }
      fillBody(sp, t); el.appendChild(sp);
    }
    while ((m = re.exec(text))) {
      if (m[1] === "c" && !CMAP[m[2]]) continue;   // unknown name: leave as text
      if (m[1] === "o" && !OMAP[m[2]]) continue;
      put(text.slice(last, m.index)); last = re.lastIndex;
      if (m[1] === "c") col = m[2]; else if (m[1] === "o") ol = m[2];
      else if (m[3] === "c") col = ""; else ol = "";
    }
    put(text.slice(last));
  }
  function addText(el, t){       // plain text; http(s) URLs become links (new tab, noopener nofollow), built with DOM APIs (no innerHTML)
    var re = /\bhttps?:\/\/[^\s<>"]+/gi, last = 0, m;
    while ((m = re.exec(t))) {
      var u = m[0].replace(/[.,;:!?)\]}'"]+$/, "");
      if (m.index > last) el.appendChild(document.createTextNode(t.slice(last, m.index)));
      var a = document.createElement("a"); a.className = "mb-link"; a.href = u; a.target = "_blank"; a.rel = "noopener nofollow noreferrer"; a.textContent = u;
      el.appendChild(a); last = m.index + u.length; re.lastIndex = last;
    }
    if (last < t.length) el.appendChild(document.createTextNode(t.slice(last)));
  }
  function fillBody(el, text){   // text with :code: emoji -> text nodes + <img>
    var re = /:([a-z]+):/g, last = 0, m;
    while ((m = re.exec(text))) {
      if (!EMO[m[1]]) { re.lastIndex = m.index + 1; continue; }
      if (m.index > last) addText(el, text.slice(last, m.index));
      el.appendChild(emoImg(m[1])); last = re.lastIndex;
    }
    if (last < text.length) addText(el, text.slice(last));
  }
  box.style.cssText = "max-width:100%;width:100%;margin:24px 0 8px;padding:0 8px;box-sizing:border-box;font-family:" + F + ";";
  var css = document.createElement("style");
  css.textContent =
    "@font-face{font-family:'DS Coustard';font-style:normal;font-weight:900;font-display:swap;src:url(/fonts/coustard-900-latin-ext.woff2) format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF}" +
    "@font-face{font-family:'DS Coustard';font-style:normal;font-weight:400;font-display:swap;src:url(/fonts/coustard-400-latin-ext.woff2) format('woff2');unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF}" +
    "@font-face{font-family:'DS Coustard';font-style:normal;font-weight:900;font-display:swap;src:url(/fonts/coustard-900-latin.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}" +
    "@font-face{font-family:'DS Coustard';font-style:normal;font-weight:400;font-display:swap;src:url(/fonts/coustard-400-latin.woff2) format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}" +
    "#ds-msgbox .mb-card{background:#000;border:1px solid #f3bf56;border-radius:10px;padding:10px 12px;box-sizing:border-box;" +
      "display:flex;flex-direction:column;height:calc(100vh - 16px);height:calc(100dvh - 16px);min-height:340px}" +   // box = one screen tall; only the list scrolls
    "#ds-msgbox .mb-title{flex:none}" +
    "#ds-msgbox #mb-form{flex:1;min-height:0;display:flex;flex-direction:column}" +
    "#ds-msgbox .mb-title{color:#f3bf56;font-size:18px;font-weight:700;margin-bottom:8px;display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:baseline;gap:10px}" +
    "#ds-msgbox .mb-top{color:#f3bf56;font-size:18px;font-weight:700;text-decoration:none;white-space:nowrap;cursor:pointer}" +
    "#ds-msgbox .mb-top{justify-self:center}" +
    "#ds-msgbox .mb-home{justify-self:end;text-align:right;color:#f3bf56;font-size:18px;font-weight:700;text-decoration:none;cursor:pointer}" +
    "#ds-msgbox .mb-top:hover,#ds-msgbox .mb-top:focus-visible,#ds-msgbox .mb-home:hover,#ds-msgbox .mb-home:focus-visible{text-decoration:underline;outline:0}" +
    "@media (max-width:560px){#ds-msgbox .mb-title,#ds-msgbox .mb-top,#ds-msgbox .mb-home{font-size:14px}#ds-msgbox .mb-title{gap:6px}}" +
    "#ds-msgbox .mb-msgs{background:#f3bf56;border:1px solid #cb972e;border-radius:8px;padding:10px 12px;margin-bottom:12px;min-height:120px;overflow:auto;overscroll-behavior:contain}" +
    "#ds-msgbox .mb-wrap .mb-msgs{min-height:max(160px,calc(100vh - 230px));min-height:max(160px,calc(100dvh - 230px))}" +
    "#ds-msgbox .mb-msgs:empty::before{content:'Messages will show here';color:#666;font-size:14px}" +
    "#ds-msgbox .mb-line{font-size:20px;color:#000;line-height:1.18;padding:3px 0;border-bottom:1px solid #cb972e;overflow-wrap:anywhere;font-weight:400;-webkit-text-stroke:0.9px currentColor;}" +
    "#ds-msgbox .mb-line:last-child{border-bottom:0}" +
    "#ds-msgbox .mb-who{color:#008000;font-weight:400}" +
    "#ds-msgbox .mb-body{white-space:pre-wrap;overflow-wrap:anywhere;color:#000;font-weight:400}" +
    "#ds-msgbox .mb-wrap{background:#f3bf56;border:1px solid #cb972e;border-radius:8px;margin-bottom:6px;overflow:hidden;flex:1;min-height:0;display:flex;flex-direction:column}" +
    "#ds-msgbox .mb-wrap .mb-msgs{border:0;border-radius:0;margin:0;flex:1 1 auto}" +
    "#ds-msgbox .mb-compose,#ds-msgbox .mb-tools,#ds-msgbox .mb-status{flex:none}" +
    "#ds-msgbox .mb-compose{display:flex;flex-wrap:wrap;align-items:flex-start;border-top:2px solid #cb972e;padding:8px 12px;cursor:text;font-size:20px;line-height:1.4;font-weight:400;-webkit-text-stroke:0.9px currentColor;}" +
    "#ds-msgbox .mb-compose .mb-who{white-space:nowrap;cursor:pointer;padding-top:2px;margin-right:.3em}" +
    "#ds-msgbox .mb-compose .mb-colon{padding-top:2px;white-space:pre}" +
    "#ds-msgbox .mb-tawrap{flex:1;min-width:0;position:relative;display:block}" +
    "#ds-msgbox .mb-mirror{position:absolute;inset:0;padding:2px 0;margin:0;font:400 20px " + F + ";-webkit-text-stroke:0.9px currentColor;line-height:1.4;white-space:pre-wrap;overflow-wrap:anywhere;word-wrap:break-word;overflow:hidden;pointer-events:none;color:#000;display:none}" +
    "#ds-msgbox .mb-rich .mb-mirror{display:block}" +
    "#ds-msgbox .mb-rich #mb-text{color:transparent !important;-webkit-text-stroke:0 !important;text-shadow:none !important;caret-color:#000;position:relative}" +
    "#ds-msgbox #mb-text{width:100%;box-sizing:border-box;display:block;white-space:pre-wrap;overflow-wrap:anywhere;word-wrap:break-word;flex:1;min-width:0;background:transparent;color:#000;border:0;outline:0;resize:none;padding:2px 0;margin:0;font:400 20px " + F + ";-webkit-text-stroke:0.9px currentColor;line-height:1.4;height:28px;overflow:hidden}" +
    "#ds-msgbox #mb-text::placeholder{color:#6b5310;font-style:italic;-webkit-text-stroke:0}" +
    "#ds-msgbox #mb-pin{width:5.5em;background:#fff8e6;color:#000;border:1px solid #cb972e;border-radius:4px;outline:0;padding:1px 6px;margin:0;font:700 15px " + F + ";letter-spacing:4px}" +
    "#ds-msgbox #mb-email{flex:1;min-width:0;background:#fff8e6;color:#000;border:1px solid #cb972e;border-radius:4px;outline:0;padding:1px 6px;margin:0;font:700 15px " + F + "}" +
    "#ds-msgbox .mb-rem{display:flex;align-items:center;gap:4px;white-space:nowrap;color:#000;font:700 14px " + F + ";padding:2px 0 0 10px;cursor:pointer}" +
    "#ds-msgbox .mb-rem input{width:18px;height:18px;margin:0;accent-color:#008000;cursor:pointer}" +
    "#ds-msgbox .mb-pinhint{color:#6b5310;font-style:italic;padding:2px 0 0 8px;font-size:14px}" +
    "#ds-msgbox .mb-pinhint.mb-hintrow{order:9;flex-basis:100%;padding:4px 0 0;font-variant-ligatures:none;letter-spacing:.02em}" +
    "#ds-msgbox .mb-compose:focus-within{background:#f7cf78}" +
    "#ds-msgbox .mb-status{color:#f3bf56;font-size:14px;min-height:20px;margin-top:4px}" +
    "#ds-msgbox .mb-status:empty{min-height:0;margin:0}" +
    "#ds-msgbox #mb-text{min-height:0 !important;max-height:120px}" +
    "#ds-msgbox .mb-compose{max-height:240px}" +
    "#ds-msgbox .mb-wrap .mb-msgs{display:flex;flex-direction:column;padding-bottom:0}#ds-msgbox .mb-wrap .mb-msgs>:first-child{margin-top:auto}" +
    "#ds-msgbox .mb-wrap .mb-msgs .mb-msg:last-child .mb-line{border-bottom:1px solid #cb972e}" +
    "#ds-msgbox .mb-compose{border-top:0 !important;padding:3px 12px 8px !important;line-height:1.18}#ds-msgbox .mb-compose:focus-within{background:transparent}" +
    "#ds-msgbox .mb-compose .mb-who:empty,#ds-msgbox .mb-compose .mb-colon:empty{display:none}" +
    "#ds-msgbox .mb-emo{vertical-align:middle;display:inline-block;margin:0 1px;filter:drop-shadow(0 0 .6px #5a3d00) drop-shadow(0 0 .4px #5a3d00)}" +
    "#ds-msgbox .mb-emobtn img{filter:drop-shadow(0 0 .6px #5a3d00) drop-shadow(0 0 .4px #5a3d00)}" +
    "#ds-msgbox .mb-emobtn{flex:none;background:transparent;border:0;padding:2px;margin:0;cursor:pointer;line-height:0;min-width:32px;min-height:32px;display:flex;align-items:center;justify-content:center;border-radius:6px}" +
    "#ds-msgbox .mb-tools{display:flex;align-items:center;gap:6px;border-top:1px solid #cb972e;padding:4px 10px}" +
    "#ds-msgbox .mb-emobtn:hover,#ds-msgbox .mb-emobtn[aria-expanded=true]{background:#e6ad3a}" +
    "#ds-emopick{position:absolute;z-index:9999;width:281px;max-width:calc(100vw - 16px);max-height:min(60vh,434px);overflow-y:auto;overscroll-behavior:contain;" +
      "display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:62px;background:#5a1c08 url(/emoji/shelf.png?v=1) 0 0/100% 62px repeat-y;background-attachment:local;" +
      "border:2px solid #f3bf56;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.6);padding:0;box-sizing:border-box}" +
    "#ds-emopick button{background:transparent;border:0;margin:0;padding:0 0 13px;cursor:pointer;display:flex;align-items:center;justify-content:center;min-height:44px;border-radius:6px}" +
    "#ds-emopick button:hover,#ds-emopick button:focus-visible{background:rgba(243,191,86,.22);outline:0}" +
    "#ds-emopick img{pointer-events:none}" +
    "#ds-emopick .ep-credit{grid-column:1/-1;align-self:center;text-align:center;color:#f3bf56;font:11px Arial,sans-serif;text-decoration:none;opacity:.85}" +
    "#ds-emopick .ep-credit:hover{text-decoration:underline;opacity:1}" +
    "#ds-colpick .cp-panel{width:min(264px,calc(100vw - 32px));aspect-ratio:1/1;box-sizing:border-box;display:flex;flex-direction:column;padding:6px}" +
    "#ds-colpick .cp-top{display:grid;grid-template-columns:repeat(6,1fr);gap:2px;align-items:center}" +
    "#ds-colpick .cp-head{color:#f3bf56;font:900 16px " + F + ";text-align:center;padding:2px 0 4px;border-bottom:1px solid #6b5310;margin-bottom:4px}" +
    "#ds-colpick .cp-top > button{min-height:34px;padding:0;justify-content:center}" +
    "#ds-colpick .cp-top > button:first-child{justify-content:flex-start;gap:6px;padding:0 4px;font-size:14px}" +
    "#ds-msgbox .mb-ball{display:block;width:23px;height:23px;border-radius:50%;box-shadow:inset -2px -3px 5px rgba(0,0,0,.35),0 0 0 1px #6b5310;" +
      "background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.95) 0,rgba(255,255,255,.35) 18%,rgba(255,255,255,0) 40%)," +
      "conic-gradient(red,orange,yellow,lime,cyan,blue,magenta,red)}" +
    "#ds-colpick{position:absolute;z-index:9999;display:flex;align-items:flex-start;gap:6px;width:max-content;max-width:calc(100vw - 16px);background:#000;border:2px solid #f3bf56;border-radius:10px;" +
      "box-shadow:0 6px 20px rgba(0,0,0,.6);padding:4px;box-sizing:border-box;font-family:" + F + "}" +
    "#ds-colpick button{display:flex;align-items:center;gap:10px;width:100%;min-height:40px;background:transparent;border:0;border-radius:6px;padding:4px 8px;margin:0;" +
      "cursor:pointer;color:#f3bf56;font:700 15px " + F + ";text-align:left;white-space:nowrap}" +
    "#ds-colpick button:hover,#ds-colpick button:focus-visible{background:#2a2000;outline:0}" +
    "#ds-colpick button[aria-checked=true]{background:#3a2c00}" +
    "#ds-colpick .sw{flex:none;width:20px;height:20px;border-radius:50%;border:1px solid #f3bf56}" +
    "#ds-colpick .cp-grid{flex:1;display:grid;grid-template-columns:repeat(6,1fr);grid-auto-rows:1fr;gap:2px;align-items:center;margin-top:4px;border-top:1px solid #6b5310;padding-top:4px}" +
    "#ds-colpick .cp-h{color:#c9a227;font:700 12px " + F + ";text-align:center}" +
    "#ds-colpick .cp-hue{color:#f3bf56;font:700 14px " + F + ";padding-left:4px}" +
    "#ds-colpick .cp-grid button{justify-content:center;padding:0;min-height:0;height:100%}" +
    "#ds-colpick .cp-grid .sw{width:24px;height:24px}" +
    "#ds-colpick button[aria-checked=true] .sw{box-shadow:0 0 0 2px #000,0 0 0 4px #f3bf56}" +
    "#ds-msgbox .mb-pic{display:inline-block;vertical-align:top;max-width:100%;max-height:min(260px,40vh);width:auto;height:auto;border-radius:6px;border:1px solid #cb972e;cursor:zoom-in;background:#e6ad3a}" +
    "#ds-msgbox .mb-link{color:inherit;text-decoration:underline;text-underline-offset:2px;overflow-wrap:anywhere}" +
    "#ds-imgview{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;cursor:zoom-out}" +
    "#ds-imgview img{max-width:100vw;max-height:100vh;max-height:100dvh;object-fit:contain}";
  if (AD && box && box.id !== "ds-msgbox") {   // chat pages: give the tool buttons the board's look under the chat box id
    var B = "#" + box.id;
    css.textContent += B + " .mb-emobtn{flex:none;background:transparent !important;border:0 !important;padding:2px !important;margin:0;cursor:pointer;line-height:0;min-width:32px;min-height:32px;display:inline-flex !important;align-items:center;justify-content:center;border-radius:6px;vertical-align:middle}" +
      B + " .mb-emobtn:hover," + B + " .mb-emobtn[aria-expanded=true]{background:#e6ad3a !important}" +
      B + " .mb-ball{display:block;width:23px;height:23px;border-radius:50%;box-shadow:inset -2px -3px 5px rgba(0,0,0,.35),0 0 0 1px #6b5310;" +
      "background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.95) 0,rgba(255,255,255,.35) 18%,rgba(255,255,255,0) 40%),conic-gradient(red,orange,yellow,lime,cyan,blue,magenta,red)}";
  }
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
      if (byKey[k] && !AD) return;
      byKey[k] = 1; uniq.push(m);
    });
    return uniq;
  }
  function parseList(txt){
    try { var d = JSON.parse(txt); return Array.isArray(d) ? d : (d && Array.isArray(d.messages) ? d.messages : []); }
    catch(e){ return []; }
  }
  function getShared(){
    if (AD) return AD.get();
    return fetch(API + "?t=" + Date.now(), {cache: "no-store"})
      .then(function(r){ if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); }).then(parseList);
  }
  function postShared(entry){
    if (AD) return AD.post(entry.message, entry.image, entry.imageUrl).then(function(){ return AD.get(); });
    return fetch(API, {method: "POST", headers: {"Content-Type": "application/json", "Accept": "application/json"},
      body: JSON.stringify({id: entry.id, name: entry.name, message: entry.message, pin: entry.pin, image: entry.image || undefined, imageUrl: entry.imageUrl || undefined, cv: 57})})
      .then(function(r){
        return r.json().catch(function(){ return {}; }).then(function(d){
          if (!r.ok || !d.ok) { var e = new Error(d.error || ("HTTP " + r.status)); e.status = r.status; throw e; }
          return parseList(JSON.stringify(d));
        });
      });
  }
  function getArchive(){
    if (AD) return Promise.resolve([]);
    return fetch(ARCHIVE + "?t=" + Date.now(), {cache: "no-store"})
      .then(function(r){ return r.ok ? r.text() : "[]"; }).then(parseList).catch(function(){ return []; });
  }
  function localList(){ try { return parseList(localStorage.getItem(LOCAL) || "[]"); } catch(e){ return []; } }
  function saveLocal(list){ if (AD) return; try { localStorage.setItem(LOCAL, JSON.stringify(list.slice(-SHOW))); } catch(e){} }
  function viewImg(src){
    var v = document.createElement("div"); v.id = "ds-imgview"; v.setAttribute("role", "dialog"); v.setAttribute("aria-label", "Picture");
    var im = document.createElement("img"); im.src = src; im.alt = ""; v.appendChild(im);
    function close(){ v.remove(); document.removeEventListener("keydown", esc); }
    function esc(ev){ if (ev.key === "Escape") close(); }
    v.addEventListener("click", close); document.addEventListener("keydown", esc);
    document.body.appendChild(v);
  }
  function addUnsend(d, m){   // red X on my latest message: hover (or tap the message on touch) to show, click to remove for everyone
    d.classList.add("mb-mine"); d.tabIndex = 0;
    var x = document.createElement("button"); x.type = "button"; x.className = "mb-unsend"; x.textContent = "\u2715";
    x.title = "Delete this message"; x.setAttribute("aria-label", "Delete your last message");
    x.addEventListener("click", function(ev){
      ev.stopPropagation(); if (x.disabled) return; x.disabled = true;
      AD.del(m.id).then(function(){
        msgs = msgs.filter(function(o){ return o.id !== m.id; }); render(msgs);
      }).catch(function(e){ x.disabled = false; alert("Couldn't delete: " + ((e && e.message) || e)); });
    });
    d.addEventListener("click", function(){ d.classList.toggle("mb-tap"); });
    d.appendChild(x);
  }
  (function(){ var s = document.createElement("style"); s.textContent =
    ".mb-msg.mb-mine{position:relative;padding-right:34px}" +
    ".mb-unsend{position:absolute;right:2px;top:50%;transform:translateY(-50%);width:28px;height:28px;border-radius:50%;border:0;background:#d11;color:#fff;font:700 15px/28px Arial,sans-serif;padding:0;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .12s;box-shadow:0 1px 3px rgba(0,0,0,.4)}" +
    ".mb-msg.mb-mine:hover .mb-unsend,.mb-msg.mb-mine:focus-within .mb-unsend,.mb-msg.mb-mine.mb-tap .mb-unsend{opacity:1;pointer-events:auto}" +
    ".mb-unsend:hover{background:#f22}.mb-unsend:disabled{opacity:.5!important}";
    document.head.appendChild(s); })();
  function render(list){
    var el = document.getElementById("mb-msgs");
    // Skip identical re-renders and reuse <img> nodes: recreating them every poll restarted animated GIFs before they finished.
    var sig = list.map(function(m){ return m.id + "|" + m.t + "|" + m.message; }).join("\n") + "|" + savedName;
    if (sig === el.__sig && el.childNodes.length) return; el.__sig = sig;
    var oldPics = {}; Array.prototype.forEach.call(el.querySelectorAll("img.mb-pic"), function(o){ oldPics[o.getAttribute("src")] = o; });
    var atEnd = !el.childNodes.length || el.scrollHeight - el.scrollTop - el.clientHeight < 40, keep = el.scrollTop;
    el.innerHTML = ""; var lastMine = null;
    list.slice().sort(function(a, b){ return (a.t||0) - (b.t||0); }).slice(-SHOW).forEach(function(m){
      var d = document.createElement("div");
      d.className = "mb-msg";
      d.innerHTML = '<div class="mb-line"><span class="mb-who"></span><span class="mb-colon">: </span><span class="mb-body"></span></div>';
      d.querySelector(".mb-who").textContent = m.name;
      if (AD) { d.querySelector(".mb-who").style.display = "none"; d.querySelector(".mb-colon").style.display = "none"; }
      if (AD && !(savedName && String(m.name).toLowerCase() === String(savedName).toLowerCase())) { var gt = document.createElement("span"); gt.className = "mb-gt"; gt.textContent = "> "; gt.style.cssText = "margin-right:4px;font-weight:bold"; var ln2 = d.querySelector(".mb-line"); ln2.insertBefore(gt, ln2.firstChild); }
      if (false && AD && m.t) { var tm = document.createElement("span"); tm.className = "mb-time"; tm.style.cssText = "font-size:12px;color:#5c4210;margin-right:6px;-webkit-text-stroke:0;white-space:nowrap"; tm.textContent = new Date(m.t).toLocaleTimeString([], {hour:"numeric", minute:"2-digit"}); var ln = d.querySelector(".mb-line"); ln.insertBefore(tm, ln.firstChild); }
      var pm = /^\[img:([A-Za-z0-9_-]{6,40})\]$/.exec(m.message);
      if (pm) {
        var src = "/api/img/" + pm[1], im = oldPics[src];
        if (!im) { im = document.createElement("img"); im.className = "mb-pic"; im.alt = "picture from " + m.name; im.loading = "lazy";
          im.src = src; im.addEventListener("click", function(){ viewImg(im.src); }); }
        d.querySelector(".mb-body").appendChild(im);
      } else fillRich(d.querySelector(".mb-body"), m.message);
      if (AD && AD.del && m.id && savedName && String(m.name).toLowerCase() === String(savedName).toLowerCase()) lastMine = {el: d, m: m};
      el.appendChild(d);
    });
    if (lastMine) addUnsend(lastMine.el, lastMine.m);
    el.scrollTop = atEnd ? el.scrollHeight : keep;   // newest at the bottom; scroll up for earlier ones
    if (atEnd) Array.prototype.forEach.call(el.querySelectorAll("img"), function(im){ if (!im.complete) im.addEventListener("load", function(){ el.scrollTop = el.scrollHeight; }, {once: true}); });
  }

  box.innerHTML =
    '<div class="mb-card">' +
    '<div class="mb-title"><span>Messages</span><a href="#" class="mb-top" id="mb-top">top of page</a><a href="https://www.myleague.com/diamondspaders/" class="mb-home" target="_blank" rel="noopener">Diamond Spaders Home</a></div>' +
    '<form id="mb-form" autocomplete="off"><div class="mb-wrap">' +
    '<div class="mb-msgs" id="mb-msgs"></div>' +
    '<div class="mb-compose" id="mb-compose">' +
    '<span class="mb-who" id="mb-who" title="Click to change your name"></span>' +
    '<span class="mb-tawrap"><div class="mb-mirror" id="mb-mirror" aria-hidden="true"></div><textarea id="mb-text" rows="1" maxlength="1000" aria-label="Message" spellcheck="true" lang="en" autocorrect="on" autocapitalize="sentences"></textarea></span>' +
    '<input type="password" id="mb-pin" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" aria-label="3-digit PIN" style="display:none">' +
    '<input type="email" id="mb-email" maxlength="254" autocomplete="email" aria-label="Your email address" placeholder="you@example.com" style="display:none">' +
    '<span class="mb-pinhint" id="mb-pinhint" style="display:none"></span>' +
    '<label class="mb-rem" id="mb-rem" style="display:none" title="Stay signed in on this browser for 30 days"><input type="checkbox" id="mb-remcb"> remember me</label></div>' +
    '<div class="mb-tools" id="mb-tools">' +
    '<button type="button" class="mb-emobtn" id="mb-emobtn" aria-label="Emoji" aria-haspopup="true" aria-expanded="false" title="Emoji">' +
    '<img src="' + EMO_DIR + 'smile.svg?v=' + EMO_V + '" width="24" height="24" alt=""></button>' +
    '<button type="button" class="mb-emobtn" id="mb-colbtn" aria-label="Text color and outline" aria-haspopup="true" aria-expanded="false" title="Text color and outline"><span class="mb-ball"></span></button><label class="mb-emobtn" id="mb-imgbtn" for="mb-imgfile" role="button" tabindex="0" aria-label="Upload a picture" title="Upload a picture"><svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="4.5" width="19" height="15" rx="2" fill="#fff8e6" stroke="#5a3d00" stroke-width="1.6"/><circle cx="8" cy="9.5" r="2" fill="#f3bf56" stroke="#5a3d00" stroke-width="1"/><path d="M4 18l5.5-6 4 4 2.5-2.5L20 18z" fill="#2e8b57" stroke="#5a3d00" stroke-width="1"/></svg></label><input type="file" id="mb-imgfile" accept="image/*" style="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;clip:rect(0 0 0 0);pointer-events:none" tabindex="-1"></div></div>' +
    '<input type="text" id="mb-hp" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">' +
    '<div class="mb-status" id="mb-status"></div></form></div>';
  if (AD) {
    var _t = box.querySelector(".mb-title span"); if (_t) _t.textContent = AD.title || "Chat";
    var _tp = document.getElementById("mb-top"); if (_tp) _tp.style.display = "none";
    var _hm = box.querySelector(".mb-home"); if (_hm) { _hm.textContent = "Diamond Spaders Online home"; _hm.href = "/"; _hm.removeAttribute("target"); var _slot = document.getElementById("homeslot"); if (_slot) { _hm.style.cssText = "font-size:15px"; _slot.appendChild(_hm); } else { _hm.remove(); } }
  }

  var form = document.getElementById("mb-form"), st = document.getElementById("mb-status");
  var ta = document.getElementById("mb-text"), who = document.getElementById("mb-who"), colon = document.getElementById("mb-colon");
  if (ta) { ta.spellcheck = true; ta.setAttribute("spellcheck", "true"); }
  document.getElementById("mb-top").addEventListener("click", function(ev){
    ev.preventDefault();
    try { window.scrollTo({top: 0, behavior: "smooth"}); } catch(e){ window.scrollTo(0, 0); }
  });
  var remCb = document.getElementById("mb-remcb");
  remCb.addEventListener("change", function(){ if (pinMode === "email") addrIn.focus(); else if (pinMode && pinMode !== "check") pinIn.focus(); });
  var addrIn = document.getElementById("mb-email"), pinIn = document.getElementById("mb-pin"), pinHint = document.getElementById("mb-pinhint");
  var sending = false, askingName = false;
  var pinMode = "", firstPin = "", sendAfterPin = false;   // pinMode: "" | "check" (looking up) | "new" | "confirm" | "email" | "enter"
  var msgs = merge(localList());
  render(msgs);
  var savedName = ""; try { savedName = (localStorage.getItem("ds-mb-name") || "").trim().slice(0, 40); } catch(e){}
  if (AD) savedName = AD.name;

  var HINTKEY = "ds-mb-hint-seen", HINT = "type here (enter to send)";
  function hintSeen(){ try { return localStorage.getItem(HINTKEY) === "1"; } catch(e){ return false; } }
  function markHint(){ if (hintSeen()) return; try { localStorage.setItem(HINTKEY, "1"); } catch(e){} if (!askingName && !pinMode) ta.placeholder = ""; }
  // Compose stays compact: one line when empty (placeholder never makes it tall), up to ~4 lines while typing, then it scrolls.
  var TA_MAX = 120;
  function grow(){
    if (!ta.value || ta.offsetWidth < 60) { ta.style.height = "32px"; ta.style.overflow = "hidden"; }
    else { ta.style.height = "32px"; var h = ta.scrollHeight; ta.style.height = Math.min(Math.max(h, 32), TA_MAX) + "px"; ta.style.overflow = h > TA_MAX ? "auto" : "hidden"; }
    if (typeof mirror !== "undefined" && mirror) mirror.scrollTop = ta.scrollTop;
  }
  // Verified PIN is remembered for the browser session: sessionStorage (this tab, survives reloads) plus a session cookie
  // (no expiry, so it's shared by every tab/new-tab page and cleared when the browser is closed). Sent silently with each post.
  var PINKEY = "ds-mb-pin", PINCOOKIE = "ds_pin_session";
  function readPin(){
    try { var d = JSON.parse(sessionStorage.getItem(PINKEY) || "null"); if (d && d.pin) return d; } catch(e){}
    try { var m = document.cookie.match(/(?:^|;\s*)ds_pin_session=([^;]*)/); if (m) { var c = JSON.parse(decodeURIComponent(m[1])); if (c && c.pin) return c; } } catch(e){}
    return null;
  }
  // "remember me": the server keeps a 30-day HttpOnly cookie (ds_pin_token, only its hash in D1). This browser just remembers
  // {name, exp} in localStorage (no PIN, no token) so it knows not to ask; the server stays the judge (401 -> ask again).
  var REMKEY = "ds-mb-remember";
  function remembered(){ try { var r = JSON.parse(localStorage.getItem(REMKEY) || "null"); return !!(r && r.name === savedName && r.exp > Date.now()); } catch(e){ return false; } }
  function setRemember(exp){ try { if (exp) localStorage.setItem(REMKEY, JSON.stringify({name: savedName, exp: exp})); else localStorage.removeItem(REMKEY); } catch(e){} }
  function getPin(){ if (AD) return "*"; if (remembered()) return "*"; return sessionPin(); }
  function sessionPin(){ var d = readPin(); if (!d || d.name !== savedName || !/^\d{3}$/.test(d.pin)) return ""; try { sessionStorage.setItem(PINKEY, JSON.stringify(d)); } catch(e){} return d.pin; }
  function savePin(p){
    var v = JSON.stringify({name: savedName, pin: p});
    try { if (p) sessionStorage.setItem(PINKEY, v); else sessionStorage.removeItem(PINKEY); } catch(e){}
    try { document.cookie = PINCOOKIE + "=" + (p ? encodeURIComponent(v) : "") + "; path=/; SameSite=Strict" + (location.protocol === "https:" ? "; Secure" : "") + (p ? "" : "; Max-Age=0"); } catch(e){}
  }
  function pinPost(action, pin, email){
    return fetch(PIN_API, {method: "POST", headers: {"Content-Type": "application/json", "Accept": "application/json"},
      body: JSON.stringify({name: savedName, pin: pin, email: email, action: action, remember: !!(remCb && remCb.checked)})})
      .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(d){ d.status = r.status; d.ok = r.ok && d.ok; return d; }); });
  }
  function showCompose(){
    var pinning = !!pinMode && !askingName;
    ta.style.display = pinning ? "none" : "";
    if (ta.parentNode && ta.parentNode.className === "mb-tawrap") ta.parentNode.style.display = pinning ? "none" : "";
    if (typeof paintMirror === "function" && mirror) paintMirror();
    pinIn.style.display = (pinning && pinMode !== "check" && pinMode !== "email") ? "" : "none";
    addrIn.style.display = (pinning && pinMode === "email") ? "" : "none";
    pinHint.style.display = pinning ? "" : "none";
    pinHint.classList.toggle("mb-hintrow", pinning && pinMode === "email");   // long email note gets its own line under the box
    var remEl = document.getElementById("mb-rem");
    if (remEl) remEl.style.display = (pinning && pinMode !== "check") ? "" : "none";
    if (pinning) {
      who.textContent = "";
      pinHint.textContent = {check: "checking PIN…", "new": "create a 3-digit PIN (000-999), then press Enter",
        confirm: "type the same PIN again to confirm", email: "email needed only for initial login-- to discourage duplicate accounts",
        enter: "enter your 3-digit PIN, then press Enter"}[pinMode];
      return;
    }
    if (askingName) {
      who.textContent = "Your name:";
      ta.placeholder = "type your name or username, then press Enter"; ta.maxLength = 40;
    } else if (savedName) {
      who.textContent = "";
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
      .then(function(d){
        if (forName !== savedName || pinMode !== "check") return;
        if (d.remembered) { pinDone("", {remembered: true}); return; }
        startPin(d.hasPin ? "enter" : "new");
      })
      .catch(function(){ if (pinMode === "check") { pinMode = ""; showCompose(); st.textContent = "Couldn't check your PIN (network). Click the message line to try again."; } });
    return true;
  }
  function startPin(mode){ pinMode = mode; pinIn.value = ""; showCompose(); (mode === "email" ? addrIn : pinIn).focus(); }
  function pinDone(p, d){
    if (d && d.remembered) { savePin(""); setRemember(d.expires || Date.now() + 30 * 86400000); }   // no plaintext PIN kept
    else savePin(p); pinMode = ""; firstPin = ""; pinIn.value = ""; addrIn.value = ""; showCompose(); ta.focus();
    if (sendAfterPin && ta.value.trim()) { sendAfterPin = false; form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event("submit", {cancelable: true})); }
    sendAfterPin = false;
    runAfterPin();
  }
  // Emoji / color buttons: require a verified PIN first (same gate as sending); run fn once the PIN is OK.
  var afterPin = null;
  function runAfterPin(){ var f = afterPin; afterPin = null; if (f) setTimeout(f, 0); }
  function gate(fn){
    if (savedName && !askingName && !pinMode && getPin()) { fn(); return; }
    afterPin = fn;
    if (!savedName && !askingName) { askName(); st.textContent = "Type your name, then your PIN, to use emoji and colors."; return; }
    if (askingName) { ta.focus(); st.textContent = "Type your name first (enter), then your PIN."; return; }
    if (pinMode) { (pinMode === "email" ? addrIn : pinIn).focus(); st.textContent = "Enter your PIN first."; return; }
    if (needPin()) st.textContent = "Enter your PIN first.";
    else runAfterPin();
  }
  function cancelPin(){ pinMode = ""; firstPin = ""; sendAfterPin = false; afterPin = null; addrIn.value = ""; showCompose(); st.textContent = "You need your PIN to send a message."; }
  addrIn.addEventListener("keydown", function(ev){
    if (ev.key === "Escape") { cancelPin(); return; }
    if (ev.key !== "Enter" || ev.isComposing) return;
    ev.preventDefault();
    var a = addrIn.value.trim().toLowerCase(), p = firstPin;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(a)) { st.textContent = "Please enter a valid email address (like name@example.com)."; return; }
    st.textContent = "Saving PIN…"; addrIn.readOnly = true;
    pinPost("set", p, a).then(function(d){
      if (d.ok) { st.textContent = "PIN saved. Remember it: you'll need it to send messages as " + savedName + "."; pinDone(p, d); return; }
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
        if (d.ok) { st.textContent = ""; pinDone(p, d); return; }
        if (d.status === 428) { st.textContent = "This name has no PIN yet. Please create one."; startPin("new"); return; }
        st.textContent = d.error || "Wrong PIN. Please try again."; pinIn.value = ""; pinIn.focus();
      }).catch(function(){ st.textContent = "Couldn't check the PIN (network). Please try again."; })
        .finally(function(){ pinIn.readOnly = false; });
    }
  });
  showCompose();
  document.getElementById("mb-compose").addEventListener("mousedown", function(ev){
    if (emoBtn.contains(ev.target) || document.getElementById("mb-tools").contains(ev.target)) { ev.preventDefault(); return; }   // keep the textarea's cursor; click handler toggles the picker
    if (ev.target === who) { ev.preventDefault(); if (!askingName && !AD) askName(); return; }
    if (ev.target === pinIn) return;
    if (ev.target === addrIn) return;
    if (document.getElementById("mb-rem").contains(ev.target)) return;   // remember-me checkbox
    if (pinMode) { ev.preventDefault(); if (pinMode === "email") addrIn.focus(); else if (pinMode !== "check") pinIn.focus(); return; }
    if (ev.target !== ta) { ev.preventDefault(); ta.focus(); }
  });
  ta.addEventListener("focus", function(){ if (!askingName && !pinMode) { try { localStorage.setItem(HINTKEY, "1"); } catch(e){} }   // seen once: keep it this visit, gone next time
    if (!savedName && !askingName) askName(); else needPin(); });
  ta.addEventListener("input", function(){ syncRuns(); grow(); if (!askingName && !pinMode && ta.value) markHint(); });
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
      if (!needPin()) { ta.focus(); runAfterPin(); }
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
    ta.value = v.slice(0, a) + code + v.slice(b); selA = selB = a + code.length; syncRuns();
    grow(); markHint();
    if (!pinMode && ta.style.display !== "none") {
      if (document.activeElement === ta) { try { ta.setSelectionRange(selA, selB); } catch(e){} }
      else if (!(window.matchMedia && matchMedia("(pointer: coarse)").matches)) { ta.focus(); try { ta.setSelectionRange(selA, selB); } catch(e){} }
    }
  }
  function openPick(){
    if (pick) return;
    if (menus) closeMenus();
    pick = document.createElement("div"); pick.id = "ds-emopick"; pick.setAttribute("role", "menu"); pick.setAttribute("aria-label", "Emoji");
    EMOJI.forEach(function(e){
      var b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "menuitem"); b.title = ":" + e[0] + ":"; b.setAttribute("aria-label", e[0]);
      var im = emoImg(e[0]); im.className = ""; im.width = im.height = 32; b.appendChild(im);
      b.addEventListener("mousedown", function(ev){ ev.preventDefault(); });   // don't steal focus from the textarea
      b.addEventListener("click", function(ev){ ev.preventDefault(); insertEmo(e[0]); });
      pick.appendChild(b);
    });
    var cr = document.createElement("a"); cr.className = "ep-credit"; cr.href = "https://github.com/jdecked/twemoji"; cr.target = "_blank"; cr.rel = "noopener";
    cr.textContent = "Emoji: Twemoji (CC-BY 4.0)"; cr.addEventListener("mousedown", function(ev){ ev.preventDefault(); }); pick.appendChild(cr);
    document.body.appendChild(pick); emoBtn.setAttribute("aria-expanded", "true"); placePick();
  }
  function closePick(){ if (!pick) return; pick.remove(); pick = null; emoBtn.setAttribute("aria-expanded", "false"); }
  emoBtn.addEventListener("click", function(ev){ ev.preventDefault(); ev.stopPropagation(); if (pick) closePick(); else gate(function(){ rememberSel(); openPick(); }); });
  document.addEventListener("mousedown", function(ev){ if (pick && !pick.contains(ev.target) && !emoBtn.contains(ev.target)) closePick(); }, true);
  document.addEventListener("touchstart", function(ev){ if (pick && !pick.contains(ev.target) && !emoBtn.contains(ev.target)) closePick(); }, {capture: true, passive: true});
  document.addEventListener("keydown", function(ev){ if (ev.key === "Escape" && pick) { closePick(); emoBtn.focus(); } });
  window.addEventListener("resize", placePick);
  window.addEventListener("resize", grow);
  try { document.fonts && document.fonts.ready.then(grow); } catch(e){}

  // ---- text color + outline (two menus built by one factory) ----
  function getPref(key, map){ try { var c = localStorage.getItem(key) || ""; return map[c] ? c : ""; } catch(e){ return ""; } }
  function getColor(){ return getPref(CKEY, CMAP); }
  function getOutline(){ return getPref(OKEY, OMAP); }
  // Compose styling: the color/outline picked is the "pen" for text typed from now on; text already typed keeps its own style.
  // runs[i] = {c, o} for each character of the draft; a styled mirror div sits under the (transparent-text) textarea.
  var runs = [], prevVal = "", mirror = document.getElementById("mb-mirror"), taWrap = ta.parentNode;
  function pen(){ return {c: getColor(), o: getOutline()}; }
  function syncRuns(){                     // diff old vs new draft: inserted chars take the pen, the rest keep their style
    if (askingName || pinMode) return;
    var v = ta.value, pl = prevVal.length, nl = v.length, a = 0;
    while (a < pl && a < nl && prevVal[a] === v[a]) a++;
    var e = 0;
    while (e < pl - a && e < nl - a && prevVal[pl - 1 - e] === v[nl - 1 - e]) e++;
    var p = pen(), ins = [];
    for (var i = 0; i < nl - a - e; i++) ins.push({c: p.c, o: p.o});
    runs = runs.slice(0, a).concat(ins, runs.slice(pl - e));
    prevVal = v; paintMirror();
  }
  function styleSpan(st0){
    var sp = document.createElement("span");
    if (st0.c) { sp.style.color = CMAP[st0.c]; sp.style.textShadow = cShadow(st0.c); }
    if (st0.o) { oStyle(sp, st0.o); if (!st0.c) sp.style.color = oFill(st0.o); }
    return sp;
  }
  function paintMirror(){
    var rich = !askingName && !pinMode;
    taWrap.classList.toggle("mb-rich", rich);
    if (!rich) return;
    mirror.textContent = "";
    var v = ta.value, i = 0;
    while (i < v.length) {
      var r = runs[i] || {c: "", o: ""}, j = i + 1;
      while (j < v.length && runs[j] && runs[j].c === r.c && runs[j].o === r.o) j++;
      var sp = styleSpan(r); sp.textContent = v.slice(i, j); mirror.appendChild(sp); i = j;
    }
    mirror.appendChild(document.createTextNode("\u200b"));
    mirror.scrollTop = ta.scrollTop;
  }
  function serialize(a, b){                 // draft[a:b] -> text with [c=]/[o=] tags where the style changes
    var out = "", c = "", o = "";
    for (var i = a; i < b; i++) {
      var r = runs[i] || {c: "", o: ""};
      if (r.c !== c) { out += r.c ? "[c=" + r.c + "]" : "[/c]"; c = r.c; }
      if (r.o !== o) { out += r.o ? "[o=" + r.o + "]" : "[/o]"; o = r.o; }
      out += ta.value[i];
    }
    return out;
  }
  ta.addEventListener("scroll", function(){ mirror.scrollTop = ta.scrollTop; });
  function applyColor(){ paintMirror(); }
  syncRuns();
  var menus = [];
  function closeMenus(){ menus.forEach(function(mn){ mn.close(); }); }
  // one pop-up (rainbow ball): color swatches + outline swatches together
  function makeMenu(btn){
    var el = null;
    function close(){ if (!el) return; el.remove(); el = null; btn.setAttribute("aria-expanded", "false"); }
    function choose(kind, n){
      var isCol = kind === "c", key = isCol ? CKEY : OKEY, tag = kind, noun = isCol ? "color" : "outline";
      var label = isCol ? (n ? CLABEL[n] : "") : n;
      var v = ta.value, a = Math.min(selA, v.length), b = Math.min(Math.max(selB, a), v.length);
      if (b > a && !askingName && !pinMode) {   // text selected: restyle just that text (selection kept for step 2)
        syncRuns();
        for (var i = a; i < b; i++) { runs[i] = runs[i] || {c: "", o: ""}; runs[i][kind] = n; }
        paintMirror();
      } else {                                  // nothing selected: only text typed from now on uses this
        try { if (n) localStorage.setItem(key, n); else localStorage.removeItem(key); } catch(e){}
      }
      st.textContent = "";
      close();
      if (isCol) { open(true); return; }   // two-step: after a color pick, stay open for outline / No Outline
      if (!pinMode && !askingName && !(window.matchMedia && matchMedia("(pointer: coarse)").matches)) { ta.focus(); try { ta.setSelectionRange(selA, selB); } catch(e){} }
    }
    function open(step2){
      if (el) return;
      closePick();
      el = document.createElement("div"); el.id = "ds-colpick"; el.setAttribute("role", "menu"); el.setAttribute("aria-label", "Text color and outline");
      var curC = getColor(), curO = getOutline();
      function mkBtn(kind, n, lab){
        var map = kind === "c" ? CMAP : OMAP, cur = kind === "c" ? curC : curO;
        var b = document.createElement("button"); b.type = "button"; b.setAttribute("role", "menuitemradio");
        b.setAttribute("aria-checked", String(n ? n === cur : !cur)); b.title = lab; b.setAttribute("aria-label", lab);
        var sw = document.createElement("span"); sw.className = "sw";
        sw.style.background = n ? map[n] : (kind === "c" ? "linear-gradient(135deg,#000 45%,#c00000 45%,#c00000 55%,#000 55%)"
                                                         : "linear-gradient(135deg,#f3bf56 45%,#c00000 45%,#c00000 55%,#f3bf56 55%)");
        b.appendChild(sw);
        b.addEventListener("mousedown", function(ev){ ev.preventDefault(); });
        b.addEventListener("click", function(ev){ ev.preventDefault(); choose(kind, n); });
        return b;
      }
      function textBtn(kind, lab){ var b = mkBtn(kind, "", lab), t = document.createElement("span"); t.textContent = lab; b.appendChild(t); return b; }
      function panel(head){
        var p = document.createElement("div"); p.className = "cp-panel";
        var h = document.createElement("div"); h.className = "cp-head"; h.textContent = head; p.appendChild(h);
        el.appendChild(p); return p;
      }
      // square box: heading, a top row (remove/No Outline [+ black, gold]), then 6 columns = two hues (light/medium/dark) per row
      var box = panel(step2 ? "outline" : "color"), top = document.createElement("div"); top.className = "cp-top";
      var g = document.createElement("div"); g.className = "cp-grid";
      if (!step2) {                       // step 1: color box only
        var rc = textBtn("c", "remove color"); rc.style.gridColumn = "1 / -1"; top.appendChild(rc);
        COLORS.forEach(function(h){ h[1].forEach(function(c){ g.appendChild(mkBtn("c", c[0], CLABEL[c[0]])); }); });
      } else {                            // step 2 (after a color pick): outline box replaces it
        var no = textBtn("o", "No Outline"); no.style.gridColumn = "span 4"; top.appendChild(no);
        top.appendChild(mkBtn("o", "black", "black outline")); top.appendChild(mkBtn("o", "gold", "gold outline"));
        COLORS.forEach(function(h){ h[1].forEach(function(c){ g.appendChild(mkBtn("o", c[0], CLABEL[c[0]] + " outline")); }); });
      }
      box.appendChild(top); box.appendChild(g);
      document.body.appendChild(el); btn.setAttribute("aria-expanded", "true");
      // overlay the text input area: bottom edge on the compose line, kept fully inside the window (no scrolling needed)
      var r = document.getElementById("mb-compose").getBoundingClientRect(), pw = el.offsetWidth, ph = el.offsetHeight;
      var vw = document.documentElement.clientWidth, vh = window.innerHeight;
      var left = Math.max(8, Math.min(r.left + 8, vw - pw - 8));
      var topY = Math.max(8, Math.min(r.bottom - ph, vh - ph - 8));
      el.style.left = (left + window.scrollX) + "px"; el.style.top = (topY + window.scrollY) + "px";
    }
    btn.addEventListener("click", function(ev){ ev.preventDefault(); ev.stopPropagation(); if (el) close(); else gate(function(){ rememberSel(); open(); }); });
    document.addEventListener("mousedown", function(ev){ if (el && !el.contains(ev.target) && !btn.contains(ev.target)) close(); }, true);
    document.addEventListener("touchstart", function(ev){ if (el && !el.contains(ev.target) && !btn.contains(ev.target)) close(); }, {capture: true, passive: true});
    document.addEventListener("keydown", function(ev){ if (ev.key === "Escape" && el) { close(); btn.focus(); } });
    var mn = {close: close}; menus.push(mn); return mn;
  }
  makeMenu(document.getElementById("mb-colbtn"));

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
  setInterval(function(){ if (!document.hidden) refresh(); }, AD ? 2500 : 30000);

  form.addEventListener("submit", function(ev){
    ev.preventDefault();
    if (sending || askingName || pinMode) return;
    syncRuns();
    var name = savedName, raw = ta.value, s0 = raw.length - raw.replace(/^\s+/, "").length, e0 = raw.replace(/\s+$/, "").length;
    var msg = e0 > s0 ? serialize(s0, e0) : "";
    if (msg.length > 1000) { st.textContent = "Message is too long with all those colors. Please shorten it."; return; }
    if (!name) { askName(); return; }
    if (!stripTags(msg).trim()) { st.textContent = "Type a message, then press Enter."; return; }
    if (document.getElementById("mb-hp").value) return;   // bot filled the honeypot
    var pin = getPin();
    if (!pin) { sendAfterPin = true; needPin(); return; }
    sending = true; ta.readOnly = true; st.textContent = "Sending…"; st.dataset.err = "";
    var entry = {id: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8), name: name, message: msg, pin: pin === "*" ? "" : pin, t: Date.now()};
    postShared(entry).then(function(list){
      ta.value = ""; syncRuns(); markHint(); grow();
      msgs = merge(list);
      saveLocal(msgs); render(msgs);
      st.textContent = "";
      var el = document.getElementById("mb-msgs"); el.scrollTop = el.scrollHeight;
      // email notification only after the message is saved for everyone; failures here don't matter to the poster
      if (!AD) fetch(ENDPOINT, {method: "POST", headers: {"Content-Type": "application/json", "Accept": "application/json"},
        body: JSON.stringify({name: name, message: stripTags(msg), _subject: "Diamond Spaders message from " + name,
                              _template: "table", _captcha: "false", _honey: ""})}).catch(function(){});
    }).catch(function(e){
      if (e && (e.status === 401 || e.status === 428)) {   // PIN changed/reset on the server: ask again, keep the draft
        savePin(""); setRemember(0); sending = false; ta.readOnly = false; sendAfterPin = true;
        needPin(); st.textContent = (e.message || "Please enter your PIN.") + " Your message was NOT posted yet.";
        return;
      }
      st.textContent = "Sorry, your message was NOT posted (" + (e && e.message || "network error") + "). Please try again.";
      st.dataset.err = "send";
    }).finally(function(){ sending = false; ta.readOnly = false; });
  });

  // ---- pictures: file picker / paste -> resize + compress in the browser -> POST as its own message ----
  var imgBusy = false;
  var MAX_SIDE = 1000, TARGET = 300 * 1024, HARD = 390 * 1024;
  function loadImage(file){
    return new Promise(function(res, rej){
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function(){ res(im); setTimeout(function(){ URL.revokeObjectURL(url); }, 1000); };
      im.onerror = function(){ URL.revokeObjectURL(url); rej(new Error(/heic|heif/i.test((file.type || "") + (file.name || "")) ? "this browser can't open HEIC photos; choose a JPEG or PNG" : "that picture couldn't be opened; try a JPEG or PNG")); };
      im.src = url;
    });
  }
  function shrink(file){
    return loadImage(file).then(function(im){
      var w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
      if (!w || !h) throw new Error("That picture couldn't be opened.");
      var side = MAX_SIDE, out = "";
      for (var pass = 0; pass < 4; pass++) {
        var k = Math.min(1, side / Math.max(w, h)), cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
        var c = document.createElement("canvas"); c.width = cw; c.height = ch;
        var g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cw, ch); g.drawImage(im, 0, 0, cw, ch);
        var webpOk = c.toDataURL("image/webp", .5).indexOf("data:image/webp") === 0;
        var type = webpOk ? "image/webp" : "image/jpeg";
        for (var q = .82; q >= .4; q -= .12) {
          out = c.toDataURL(type, q);
          if (out.length * 3 / 4 <= TARGET) return out;
        }
        if (out.length * 3 / 4 <= HARD) return out;
        side = Math.round(side * .75);
      }
      throw new Error("That picture is too big, even after shrinking.");
    });
  }
  // GIFs skip the canvas (which would flatten animation): original bytes are sent as data:image/gif (<= 5 MB).
  function gifData(file){
    return new Promise(function(res, rej){
      var r = new FileReader();
      r.onload = function(){ var u = String(r.result || "");
        res(u.replace(/^data:[^;,]*;base64,/, "data:image/gif;base64,")); };
      r.onerror = function(){ rej(new Error("That GIF couldn't be read.")); };
      r.readAsDataURL(file);
    });
  }
  function postImage(file, gifUrl, fallback){
    if (imgBusy || sending) return;
    if (gifUrl) {        // pasted GIF from a web page: server fetches the original (animated) by URL
      var pin0 = getPin();
      if (!savedName || !pin0) { gate(function(){}); return; }
      imgBusy = true; st.dataset.err = ""; st.textContent = "Posting GIF…";
      var e0 = {id: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8), name: savedName, message: "", imageUrl: gifUrl, pin: pin0 === "*" ? "" : pin0};
      postShared(e0).then(function(list){
        msgs = merge(list); saveLocal(msgs); render(msgs); st.textContent = "";
        var el = document.getElementById("mb-msgs"); el.scrollTop = el.scrollHeight;
      }).catch(function(e){
        if (e && e.message === "NOTGIF" && fallback) { imgBusy = false; postImage(fallback); return; }
        if (e && (e.status === 401 || e.status === 428)) { savePin(""); setRemember(0); needPin(); st.textContent = (e.message || "Please enter your PIN.") + " Your picture was NOT posted."; return; }
        st.textContent = "Sorry, your picture was NOT posted (" + (e && e.message === "NOTGIF" ? "that link isn't a GIF" : (e && e.message || "network error")) + ")."; st.dataset.err = "send";
      }).finally(function(){ imgBusy = false; });
      return;
    }
    if (!file || !(/^image\//.test(file.type || "") || /\.(jpe?g|png|gif|webp|bmp|heic|heif)$/i.test(file.name || ""))) { st.textContent = "Please choose a picture (JPEG, PNG, WebP, GIF)."; st.dataset.err = "send"; return; }
    if (file.size > 25 * 1024 * 1024) { st.textContent = "That picture is too big (25 MB max)."; return; }
    var pin = getPin();
    if (!savedName || !pin) { gate(function(){}); return; }
    var isGif = /^image\/gif$/i.test(file.type || "") || /\.gif$/i.test(file.name || "");
    if (isGif && file.size > 5 * 1024 * 1024) { st.textContent = "GIFs must be under 5 MB (this one is " + (file.size / 1048576).toFixed(1) + " MB). Your picture was NOT posted."; st.dataset.err = "send"; return; }
    imgBusy = true; st.dataset.err = ""; st.textContent = "Uploading picture…";
    (isGif ? gifData(file) : shrink(file)).then(function(data){
      var entry = {id: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8), name: savedName, message: "", image: data, pin: pin === "*" ? "" : pin};
      return postShared(entry).then(function(list){
        msgs = merge(list); saveLocal(msgs); render(msgs); st.textContent = "";
        var el = document.getElementById("mb-msgs"); el.scrollTop = el.scrollHeight;
        if (!AD) fetch(ENDPOINT, {method: "POST", headers: {"Content-Type": "application/json", "Accept": "application/json"},
          body: JSON.stringify({name: savedName, message: "(posted a picture)", _subject: "Diamond Spaders picture from " + savedName,
                                _template: "table", _captcha: "false", _honey: ""})}).catch(function(){});
      });
    }).catch(function(e){
      if (e && (e.status === 401 || e.status === 428)) { savePin(""); setRemember(0); needPin(); st.textContent = (e.message || "Please enter your PIN.") + " Your picture was NOT posted."; return; }
      st.textContent = "Sorry, your picture was NOT posted (" + (e && e.message || "network error") + ")."; st.dataset.err = "send";
    }).finally(function(){ imgBusy = false; });
  }
  // A GIF copied from a web page arrives as a still PNG plus HTML; take the <img src> so the original animated GIF is posted.
  function gifFromHtml(html){
    if (!html) return "";
    try {
      var d = new DOMParser().parseFromString(html, "text/html"), im = d.querySelector("img[src]");
      var u = im && im.getAttribute("src") || "";
      if (!/^https:\/\//i.test(u)) return "";
      if (/\.gif(\?|#|$)/i.test(u) || /giphy\.com|tenor\.com|senorgif|gifer\.com|imgur\.com\/.*\.gif/i.test(u)) return u;
    } catch (e) {}
    return "";
  }
  ta.addEventListener("paste", function(ev){
    var items = ev.clipboardData && ev.clipboardData.items; if (!items) return;
    for (var i = 0; i < items.length; i++) if (items[i].kind === "file" && /^image\//.test(items[i].type)) {
      var f = items[i].getAsFile(); if (!f) continue;
      ev.preventDefault();
      if (askingName || pinMode || !getPin()) { gate(function(){}); return; }
      var gu = /^image\/gif$/i.test(f.type) ? "" : gifFromHtml(ev.clipboardData.getData("text/html"));
      if (gu) { postImage(null, gu, f); return; }
      postImage(f); return;
    }
  });
  // Picture button is a <label for=file input>: the browser opens the picker natively (no scripted click that can be blocked).
  // The PIN check happens after a file is chosen; the file waits and is posted once the PIN is OK.
  var imgBtn = document.getElementById("mb-imgbtn"), imgFile = document.getElementById("mb-imgfile");
  if (imgBtn && imgFile) {
    imgBtn.addEventListener("click", function(ev){ ev.stopPropagation(); imgFile.value = ""; });
    imgBtn.addEventListener("keydown", function(ev){ if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); imgFile.value = ""; imgFile.click(); } });
    imgFile.addEventListener("change", function(){
      var f = imgFile.files && imgFile.files[0]; if (!f) return;
      gate(function(){ postImage(f); });
    });
  }

})();
