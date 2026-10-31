/* Diamond Spaders tour alerts: "alert" checkbox right of the NEXT countdown. When alerts are ON, a sound menu appears;
   the chosen sound plays when the next tour starts (or N min before).
   Settings live in localStorage (dsAlertOn, dsAlertSound, dsAlertVol, dsAlertCustom, dsAlertLead). */
(function () {
  var LS = window.localStorage, K_ON = "dsAlertOn", K_SND = "dsAlertSound", K_VOL = "dsAlertVol", K_CUS = "dsAlertCustom", K_LEAD = "dsAlertLead";
  var SOUNDS = [
    { id: "buzz", name: "Buzz", src: "/buzz.wav" },
    { id: "buzzclip", name: "Buzz (clip)", src: "/buzz-clip.mp3" },
    { id: "chime", name: "Chime", tones: [[880, 0, .35], [1320, .18, .5]] },
    { id: "bell", name: "Bell", tones: [[660, 0, 1.2], [1320, 0, .8]] },
    { id: "fanfare", name: "Fanfare", tones: [[523, 0, .18], [659, .18, .18], [784, .36, .18], [1047, .54, .5]] },
    { id: "custom", name: "My own file…" }
  ];
  function get(k, d) { try { var v = LS.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function set(k, v) { try { LS.setItem(k, v); return true; } catch (e) { return false; } }
  var ctx;
  function tones(list, vol) {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume();
      var t0 = ctx.currentTime + .02;
      list.forEach(function (t) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "sine"; o.frequency.value = t[0];
        g.gain.setValueAtTime(0, t0 + t[1]); g.gain.linearRampToValueAtTime(.4 * vol, t0 + t[1] + .02);
        g.gain.exponentialRampToValueAtTime(.0001, t0 + t[1] + t[2]);
        o.connect(g); g.connect(ctx.destination); o.start(t0 + t[1]); o.stop(t0 + t[1] + t[2] + .05);
      });
    } catch (e) {}
  }
  function play() {
    var id = get(K_SND, "buzz"), vol = parseFloat(get(K_VOL, "0.8")), s = SOUNDS.filter(function (x) { return x.id === id; })[0] || SOUNDS[0];
    if (s.tones) return tones(s.tones, vol);
    var src = s.id === "custom" ? get(K_CUS, "") : s.src;
    if (!src) return tones(SOUNDS[2].tones, vol);
    var a = new Audio(src); a.volume = vol; a.play().catch(function () {});
  }
  /* UI */
  var css = document.createElement("style");
  css.textContent = "#ds-alert{position:relative;display:inline-block;margin-left:12px;vertical-align:middle;z-index:9999;font-family:Arial,Helvetica,sans-serif;color:#fbe646;text-align:left}"
    + "#ds-alert .ck{display:inline-flex;align-items:center;gap:6px;font-size:16px;font-weight:800;cursor:pointer;padding:0}"
    + "#ds-alert .ck input{position:absolute;opacity:0;width:0;height:0}"
    + "#ds-alert .sw{position:relative;width:30px;height:16px;border-radius:9px;background:#333;border:1px solid #7a5a00;transition:.2s;flex:0 0 auto}"
    + "#ds-alert .sw:after{content:'';position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:#888;transition:.2s}"
    + "#ds-alert .ck input:checked+.sw{background:#3a2a00;border-color:#fbe646;box-shadow:0 0 8px rgba(251,230,70,.5)}"
    + "#ds-alert .ck input:checked+.sw:after{left:16px;background:#fbe646}"
    + "#ds-alert .st{font-size:12px;min-width:26px}"
    + "#ds-alert .am{display:none;position:absolute;right:0;top:100%;margin-top:6px;background:#120c08;border:2px solid #fbe646;border-radius:10px;padding:10px 12px;min-width:210px;box-shadow:0 4px 18px #000}"
    + "#ds-alert.open .am{display:block}#ds-alert .am b{font-family:'Cinzel Decorative',Georgia,serif;font-size:14px;display:block;margin-bottom:6px}"
    + "#ds-alert input[type=radio]{accent-color:#fbe646}#ds-alert input[type=range]{width:100%;accent-color:#fbe646}"
    + "#ds-alert .tb{margin-top:8px;background:#2a1608;color:#fbe646;border:1px solid #fbe646;border-radius:6px;padding:5px 12px;font-weight:800;cursor:pointer}"
    + "#ds-alert .cn{font-size:12px;opacity:.8;margin-left:24px}";
  document.head.appendChild(css);
  var w = document.createElement("div"); w.id = "ds-alert";
  var h = '<label class="ck">alert<input type="checkbox" role="switch" id="ds-alert-btn"><span class="sw"></span></label><div class="am"><b>Alert sound</b>';
  SOUNDS.forEach(function (s) { h += '<label><input type="radio" name="dsas" value="' + s.id + '">' + s.name + '</label>'; });
  h += '<div class="cn" id="ds-alert-cn"></div><input type="file" id="ds-alert-file" accept="audio/*" style="display:none">'
    + '<div style="font-size:13px;margin-top:6px">Play</div><select id="ds-alert-lead" style="width:100%;background:#2a1608;color:#fbe646;border:1px solid #fbe646;border-radius:6px;padding:3px"><option value="1">1 min before start</option><option value="0">when the next tour starts</option><option value="5">5 min before start</option><option value="10">10 min before start</option></select>'
    + '<div style="font-size:13px;margin-top:6px">Volume</div><input type="range" id="ds-alert-vol" min="0" max="1" step="0.05">'
    + '<button class="tb" id="ds-alert-test">&#9654; Test</button> <button class="tb" id="ds-alert-close">Close</button>'
    + '<div style="font-size:12px;opacity:.8;margin-top:6px">Keep this page open to hear it.</div></div>'
    ;
  w.innerHTML = h;
  var cnt = document.getElementById("ds-next-count");
  if (cnt) { var row = document.createElement("div"); row.style.cssText = "display:flex;align-items:center;justify-content:flex-end"; cnt.parentNode.insertBefore(row, cnt); row.appendChild(cnt); cnt.style.marginTop = "0"; row.style.marginTop = "2px"; var col = document.createElement("div"); col.style.cssText = "display:flex;flex-direction:column;align-items:flex-end;gap:4px;margin-left:12px";
    col.innerHTML = '<a id="ds-chatbtn" href="/chat/" style="display:inline-block;background:#120c08;color:#fbe646;border:2px solid #fbe646;border-radius:16px;padding:3px 12px;font-weight:800;font-size:14px;text-decoration:none;">&#128172; Chat</a>';
    w.style.marginLeft = "0"; col.appendChild(w); row.appendChild(col); }
  else document.body.appendChild(w);
  var btn = w.querySelector("#ds-alert-btn"), file = w.querySelector("#ds-alert-file"), vol = w.querySelector("#ds-alert-vol"), lead = w.querySelector("#ds-alert-lead");
  function on() { return get(K_ON, "0") === "1"; }
  function refresh() {
    btn.checked = on();
    var cur = get(K_SND, "buzz");
    [].forEach.call(w.querySelectorAll("input[name=dsas]"), function (r) { r.checked = r.value === cur; });
    w.querySelector("#ds-alert-cn").textContent = cur === "custom" ? (get(K_CUS, "") ? (get(K_CUS + "Name", "custom sound")) : "no file chosen") : "";
    vol.value = get(K_VOL, "0.8"); lead.value = get(K_LEAD, "1");
  }
  btn.onchange = function () {
    set(K_ON, btn.checked ? "1" : "0");
    w.classList.toggle("open", btn.checked);
    if (btn.checked) play();
    refresh();
  };
  w.querySelector(".ck").addEventListener("click", function (e) { if (on() && e.target !== btn && !e.target.classList.contains("sw")) { e.preventDefault(); w.classList.toggle("open"); } });
  w.querySelector("#ds-alert-close").onclick = function () { w.classList.remove("open"); };
  w.querySelector("#ds-alert-test").onclick = play;
  vol.oninput = function () { set(K_VOL, vol.value); };
  lead.onchange = function () { set(K_LEAD, lead.value); };
  w.addEventListener("change", function (e) {
    if (e.target.name !== "dsas") return;
    if (e.target.value === "custom" && !get(K_CUS, "")) { file.click(); return refresh(); }
    set(K_SND, e.target.value); refresh(); play();
  });
  w.querySelector("label:last-of-type").addEventListener("click", function (e) { if (get(K_CUS, "") && get(K_SND, "") === "custom") { e.preventDefault(); file.click(); } });
  file.onchange = function () {
    var f = file.files[0]; if (!f) return;
    if (f.size > 1500000) { alert("Please pick a sound under 1.5 MB."); return; }
    var r = new FileReader();
    r.onload = function () {
      if (!set(K_CUS, r.result)) { alert("That file is too big to save in this browser."); return; }
      set(K_CUS + "Name", f.name); set(K_SND, "custom"); refresh(); play();
    };
    r.readAsDataURL(f);
  };
  document.addEventListener("click", function (e) { if (!w.contains(e.target)) w.classList.remove("open"); });
  refresh();
  /* next-tour-start alert: watch the board's NEXT countdown (#ds-next-count) and play once per tour
     when it reaches the chosen lead time (0 = at start). */
  var fired = {};
  setInterval(function () {
    if (!on()) return;
    var c = document.getElementById("ds-next-count"), m = document.getElementById("ds-next-main");
    if (!c || !m) return;
    var p = c.textContent.split(":"); if (p.length !== 3) return;
    var secs = (+p[0]) * 3600 + (+p[1]) * 60 + (+p[2]), lead = parseInt(get(K_LEAD, "1"), 10) * 60;
    var k = m.textContent + "|" + new Date().toDateString();
    if (secs <= lead && secs > lead - 5 && !fired[k] && /\d/.test(m.textContent)) { fired[k] = 1; play(); }
  }, 1000);
})();
