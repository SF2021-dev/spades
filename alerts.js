/* Diamond Spaders tour alerts: "alert" switch right of the NEXT countdown.
   When ON, a sound menu appears; the chosen sound plays when the next tour
   starts (or N min before). Settings: localStorage (dsAlertOn, dsAlertSound,
   dsAlertVol, dsAlertCustomName, dsAlertUrl, dsAlertLead). Custom uploads
   live in IndexedDB (dsAlertCustomAudio); URL sounds use dsAlertUrl. */
(function () {
  var LS = window.localStorage;
  var K_ON = "dsAlertOn", K_SND = "dsAlertSound", K_VOL = "dsAlertVol";
  var K_CUS_NAME = "dsAlertCustomName", K_URL = "dsAlertUrl", K_LEAD = "dsAlertLead";
  var IDB_NAME = "dsAlertDB", IDB_STORE = "sounds", IDB_KEY = "custom";
  var DEFAULT_ID = "ballgame";
  var SOUNDS = [
    { id: "ballgame", name: "Retro \"Take Me Out to the Ball Game\"", src: "/alert-sounds/ballgame-retro.mp3" },
    { id: "bell", name: "Simple bell", src: "/alert-sounds/bell.mp3" },
    { id: "birds", name: "Birds chirping", src: "/alert-sounds/birds.mp3" },
    { id: "upload", name: "Upload a file…" },
    { id: "url", name: "From a URL…" }
  ];
  var DEFAULT_SRC = SOUNDS[0].src;

  function get(k, d) { try { var v = LS.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function set(k, v) { try { LS.setItem(k, v); return true; } catch (e) { return false; } }

  /* IndexedDB helpers for large custom uploads */
  function idbOpen() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) return reject(new Error("no idb"));
      var r = indexedDB.open(IDB_NAME, 1);
      r.onupgradeneeded = function () {
        var db = r.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      };
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
    });
  }
  function idbPut(blob) {
    return idbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).put(blob, IDB_KEY);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }
  function idbGet() {
    return idbOpen().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(IDB_STORE, "readonly");
        var req = tx.objectStore(IDB_STORE).get(IDB_KEY);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }
  function idbDel() {
    return idbOpen().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(IDB_STORE, "readwrite");
        tx.objectStore(IDB_STORE).delete(IDB_KEY);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { resolve(false); };
      });
    }).catch(function () { return false; });
  }

  /* Migrate old localStorage data-URL custom sound into IndexedDB once */
  (function migrateOldCustom() {
    try {
      var old = LS.getItem("dsAlertCustom");
      if (!old || old.indexOf("data:") !== 0) return;
      fetch(old).then(function (r) { return r.blob(); }).then(function (b) {
        return idbPut(b).then(function () {
          try { LS.removeItem("dsAlertCustom"); } catch (e) {}
          if (get(K_SND, "") === "custom") set(K_SND, "upload");
        });
      }).catch(function () {});
    } catch (e) {}
  })();

  var currentAudio = null;
  function stop() {
    try {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.removeAttribute("src");
        currentAudio.load();
        currentAudio = null;
      }
    } catch (e) {}
  }

  function playSrc(src, vol, onFail) {
    stop();
    if (!src) { if (onFail) onFail(); return; }
    var a = PLAYER;
    currentAudio = a;
    a.loop = false; a.muted = false;
    a.volume = Math.max(0, Math.min(1, vol));
    a.onended = function () { if (currentAudio === a) currentAudio = null; };
    a.onerror = function () {
      if (currentAudio === a) currentAudio = null;
      if (onFail) onFail();
    };
    a.src = src;
    var p = a.play();
    if (p && p.catch) p.catch(function (e) {
      if (e && e.name === "NotAllowedError") { blocked(); return; }   /* browser blocked autoplay */
      if (onFail) onFail();
    });
  }
  /* One reusable audio element, unlocked by the first click/key/tap on the page, so the
     browser lets it play later when the alert fires with nobody touching the page. */
  var PLAYER = new Audio(), unlocked = false;
  PLAYER.preload = "auto";
  function unlock() {
    if (unlocked) return; unlocked = true;
    try {
      if (currentAudio) return;
      PLAYER.muted = true; PLAYER.src = DEFAULT_SRC;
      var q = PLAYER.play();
      var done = function () { try { if (!currentAudio) { PLAYER.pause(); PLAYER.currentTime = 0; } PLAYER.muted = false; } catch (e) {} };
      if (q && q.then) q.then(done, function () { unlocked = false; PLAYER.muted = false; }); else done();
    } catch (e) { unlocked = false; }
  }
  ["pointerdown", "keydown", "touchstart"].forEach(function (ev) { document.addEventListener(ev, unlock, true); });
  /* If the browser still blocks sound, show a big banner + flash the tab title; any click plays it. */
  function blocked() {
    var b = document.getElementById("ds-alert-blocked");
    if (!b) {
      b = document.createElement("div"); b.id = "ds-alert-blocked";
      b.style.cssText = "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:100000;background:#3a2a00;color:#fbe646;border:2px solid #fbe646;border-radius:12px;padding:14px 22px;font:800 20px Arial,sans-serif;box-shadow:0 0 18px rgba(251,230,70,.6);cursor:pointer";
      b.textContent = "\uD83D\uDD14 Tour alert! Click to play the sound";
      b.onclick = function () { b.remove(); document.title = t0; clearInterval(fl); unlocked = true; play(); };
      document.body.appendChild(b);
    }
    var t0 = document.title, n = 0, fl = setInterval(function () { document.title = (n++ % 2) ? t0 : "\uD83D\uDD14 TOUR ALERT"; if (n > 120) { clearInterval(fl); document.title = t0; } }, 1000);
  }

  function playDefault(vol) {
    playSrc(DEFAULT_SRC, vol, null);
  }

  function play() {
    var id = get(K_SND, DEFAULT_ID);
    var vol = parseFloat(get(K_VOL, "0.8"));
    if (isNaN(vol)) vol = 0.8;
    var s = SOUNDS.filter(function (x) { return x.id === id; })[0] || SOUNDS[0];

    if (s.src) {
      playSrc(s.src, vol, function () { playDefault(vol); });
      return;
    }
    if (s.id === "url") {
      var u = (get(K_URL, "") || "").trim();
      if (!u) { playDefault(vol); return; }
      playSrc(u, vol, function () { playDefault(vol); });
      return;
    }
    if (s.id === "upload") {
      idbGet().then(function (blob) {
        if (!blob) {
          /* fallback: legacy localStorage data URL */
          var legacy = null;
          try { legacy = LS.getItem("dsAlertCustom"); } catch (e) {}
          if (legacy) playSrc(legacy, vol, function () { playDefault(vol); });
          else playDefault(vol);
          return;
        }
        var obj = URL.createObjectURL(blob);
        playSrc(obj, vol, function () {
          try { URL.revokeObjectURL(obj); } catch (e) {}
          playDefault(vol);
        });
        /* revoke after a while so memory frees; audio keeps its own buffer once started */
        setTimeout(function () { try { URL.revokeObjectURL(obj); } catch (e) {} }, 60000);
      }).catch(function () { playDefault(vol); });
      return;
    }
    playDefault(vol);
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
    + "#ds-alert .at{padding:1px 6px;border-radius:4px}#ds-alert.on .at{background:#1e5bd8;color:#fff}"
    + "#ds-alert .st{font-size:12px;min-width:26px}"
    + "#ds-alert .am{display:none;position:absolute;right:0;top:100%;margin-top:6px;background:#120c08;border:2px solid #fbe646;border-radius:10px;padding:10px 12px;min-width:250px;max-width:320px;box-shadow:0 4px 18px #000;z-index:10000}"
    + "#ds-alert.open .am{display:block}#ds-alert .am b{font-family:'Cinzel Decorative',Georgia,serif;font-size:14px;display:block;margin-bottom:6px}"
    + "#ds-alert .am label{display:block;font-size:13px;margin:3px 0;cursor:pointer;line-height:1.35}"
    + "#ds-alert input[type=radio]{accent-color:#fbe646;margin-right:6px}"
    + "#ds-alert input[type=range]{width:100%;accent-color:#fbe646}"
    + "#ds-alert .tb{margin-top:8px;background:#2a1608;color:#fbe646;border:1px solid #fbe646;border-radius:6px;padding:5px 12px;font-weight:800;cursor:pointer}"
    + "#ds-alert .tb:hover{background:#3a2610}"
    + "#ds-alert .cn{font-size:12px;opacity:.85;margin:2px 0 2px 22px;word-break:break-all}"
    + "#ds-alert .urlrow{display:none;margin:4px 0 4px 22px}"
    + "#ds-alert .urlrow.show{display:block}"
    + "#ds-alert .urlrow input[type=url],#ds-alert .urlrow input[type=text]{width:100%;box-sizing:border-box;background:#2a1608;color:#fbe646;border:1px solid #7a5a00;border-radius:5px;padding:4px 6px;font-size:12px}"
    + "#ds-alert select{width:100%;background:#2a1608;color:#fbe646;border:1px solid #fbe646;border-radius:6px;padding:3px}";
  document.head.appendChild(css);

  var w = document.createElement("div"); w.id = "ds-alert";
  var h = '<label class="ck"><span class="at">alert</span><input type="checkbox" role="switch" id="ds-alert-btn"><span class="sw"></span></label>'
    + '<div class="am"><b>Alert sound</b>';
  SOUNDS.forEach(function (s) {
    h += '<label><input type="radio" name="dsas" value="' + s.id + '">' + s.name + '</label>';
  });
  h += '<div class="cn" id="ds-alert-cn"></div>'
    + '<div class="urlrow" id="ds-alert-urlrow"><input type="url" id="ds-alert-url" placeholder="https://…/sound.mp3" autocomplete="off"></div>'
    + '<input type="file" id="ds-alert-file" accept="audio/*" style="display:none">'
    + '<div style="font-size:13px;margin-top:6px">Play</div>'
    + '<select id="ds-alert-lead">'
    + '<option value="1">1 min before start</option>'
    + '<option value="0">when the next tour starts</option>'
    + '<option value="5">5 min before start</option>'
    + '<option value="10">10 min before start</option>'
    + '</select>'
    + '<div style="font-size:13px;margin-top:6px">Volume</div>'
    + '<input type="range" id="ds-alert-vol" min="0" max="1" step="0.05">'
    + '<button type="button" class="tb" id="ds-alert-test" title="Preview">&#9654; Test</button> '
    + '<button type="button" class="tb" id="ds-alert-stop" title="Stop">Silence</button> '
    + '<button type="button" class="tb" id="ds-alert-close">Close</button>'
    + '<div style="font-size:12px;opacity:.8;margin-top:6px">Keep this page open to hear it.</div></div>';
  w.innerHTML = h;

  var cnt = document.getElementById("ds-next-count");
  var row = null;
  if (cnt) {
    row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;justify-content:flex-end";
    cnt.parentNode.insertBefore(row, cnt);
    row.appendChild(cnt);
    cnt.style.marginTop = "0";
    row.style.marginTop = "2px";
    row.appendChild(w);
  } else {
    document.body.appendChild(w);
  }

  var ch = document.createElement("a");
  ch.id = "ds-chatbtn";
  ch.href = "/chat/";
  ch.innerHTML = '<img src="/chat-icon.png?v=1" alt="" style="width:22px;height:22px;vertical-align:-5px;margin-right:7px">Chat';
  ch.style.cssText = "display:inline-block;margin-left:14px;background:#120c08;color:#fbe646;border:2px solid #fbe646;border-radius:20px;padding:7px 18px;font-size:17px;font-weight:800;text-decoration:none;white-space:nowrap;";
  ch.onmouseover = function () { ch.style.background = "#2a1608"; };
  ch.onmouseout = function () { ch.style.background = "#120c08"; };
  if (row) row.appendChild(ch); else document.body.appendChild(ch);

  var btn = w.querySelector("#ds-alert-btn");
  var file = w.querySelector("#ds-alert-file");
  var vol = w.querySelector("#ds-alert-vol");
  var lead = w.querySelector("#ds-alert-lead");
  var urlInput = w.querySelector("#ds-alert-url");
  var urlRow = w.querySelector("#ds-alert-urlrow");
  var cn = w.querySelector("#ds-alert-cn");

  function on() { return get(K_ON, "0") === "1"; }

  function normalizeSoundId(id) {
    /* map legacy ids to new ones */
    if (id === "custom" || id === "buzz" || id === "buzzclip" || id === "chime" || id === "fanfare") {
      if (id === "custom") return "upload";
      if (id === "bell") return "bell";
      return DEFAULT_ID;
    }
    if (!SOUNDS.some(function (s) { return s.id === id; })) return DEFAULT_ID;
    return id;
  }

  function refresh() {
    btn.checked = on();
    w.classList.toggle("on", on());
    var cur = normalizeSoundId(get(K_SND, DEFAULT_ID));
    if (get(K_SND, DEFAULT_ID) !== cur) set(K_SND, cur);
    [].forEach.call(w.querySelectorAll("input[name=dsas]"), function (r) { r.checked = r.value === cur; });
    urlRow.classList.toggle("show", cur === "url");
    urlInput.value = get(K_URL, "");
    if (cur === "upload") {
      var nm = get(K_CUS_NAME, "");
      cn.textContent = nm ? ("file: " + nm) : "no file chosen yet";
    } else if (cur === "url") {
      cn.textContent = "";
    } else {
      cn.textContent = "";
    }
    vol.value = get(K_VOL, "0.8");
    lead.value = get(K_LEAD, "1");
  }

  btn.onchange = function () {
    set(K_ON, btn.checked ? "1" : "0");
    w.classList.toggle("open", btn.checked);
    if (btn.checked) play();
    else stop();
    refresh();
  };
  w.querySelector(".ck").addEventListener("click", function (e) {
    if (on() && e.target !== btn && !e.target.classList.contains("sw")) {
      e.preventDefault();
      w.classList.toggle("open");
    }
  });
  w.querySelector("#ds-alert-close").onclick = function () {
    w.classList.remove("open");
    stop();
  };
  w.querySelector("#ds-alert-test").onclick = function () { play(); };
  w.querySelector("#ds-alert-stop").onclick = function () { stop(); };
  vol.oninput = function () { set(K_VOL, vol.value); };
  lead.onchange = function () { set(K_LEAD, lead.value); };

  urlInput.onchange = urlInput.onblur = function () {
    set(K_URL, urlInput.value.trim());
  };
  urlInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      set(K_URL, urlInput.value.trim());
      set(K_SND, "url");
      refresh();
      play();
    }
  });

  w.addEventListener("change", function (e) {
    if (e.target.name !== "dsas") return;
    var val = e.target.value;
    if (val === "upload") {
      set(K_SND, "upload");
      refresh();
      /* always offer a new file pick when choosing Upload; keep prior if they cancel */
      file.click();
      return;
    }
    if (val === "url") {
      set(K_SND, "url");
      refresh();
      setTimeout(function () { urlInput.focus(); }, 0);
      if (get(K_URL, "").trim()) play();
      return;
    }
    set(K_SND, val);
    refresh();
    play();
  });

  /* click the upload label again to re-pick */
  [].forEach.call(w.querySelectorAll("input[name=dsas]"), function (r) {
    if (r.value !== "upload") return;
    r.parentNode.addEventListener("click", function (e) {
      if (get(K_SND, "") === "upload" && r.checked) {
        e.preventDefault();
        file.click();
      }
    });
  });

  file.onchange = function () {
    var f = file.files[0];
    if (!f) { refresh(); return; }
    if (!(/^audio\//.test(f.type) || /\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(f.name))) {
      alert("Please pick an audio file.");
      return;
    }
    /* Prefer IndexedDB (handles large files). Fall back to localStorage data URL under 1.5 MB. */
    idbPut(f).then(function () {
      set(K_CUS_NAME, f.name);
      set(K_SND, "upload");
      try { LS.removeItem("dsAlertCustom"); } catch (e) {}
      refresh();
      play();
    }).catch(function () {
      if (f.size > 1500000) {
        alert("That file is too big for this browser to save. Try a smaller clip (under 1.5 MB), or use a URL.");
        refresh();
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        try {
          if (!set("dsAlertCustom", reader.result)) {
            alert("That file is too big to save in this browser. Try a URL instead.");
            return;
          }
        } catch (e) {
          alert("Could not save that file in this browser. Try a URL instead.");
          return;
        }
        set(K_CUS_NAME, f.name);
        set(K_SND, "upload");
        refresh();
        play();
      };
      reader.onerror = function () { alert("Could not read that file."); };
      reader.readAsDataURL(f);
    });
  };

  document.addEventListener("click", function (e) {
    if (!w.contains(e.target)) {
      if (w.classList.contains("open")) {
        w.classList.remove("open");
        /* don't auto-stop on outside click — only Close / Silence / turning off */
      }
    }
  });

  /* one-time: if no sound chosen yet (or legacy), default to ballgame */
  if (!get(K_SND, "")) set(K_SND, DEFAULT_ID);
  else set(K_SND, normalizeSoundId(get(K_SND, DEFAULT_ID)));

  refresh();

  /* next-tour-start alert: watch the board's NEXT countdown (#ds-next-count)
     and play once per tour when it reaches the chosen lead time (0 = at start). */
  var fired = {}, last = null;
  setInterval(function () {
    if (!on()) return;
    var c = document.getElementById("ds-next-count"), m = document.getElementById("ds-next-main");
    if (!c || !m) return;
    var p = c.textContent.split(":");
    if (p.length !== 3) return;
    var secs = (+p[0]) * 3600 + (+p[1]) * 60 + (+p[2]);
    var leadSec = parseInt(get(K_LEAD, "1"), 10) * 60;
    var k = m.textContent + "|" + new Date().toDateString();
    if (!/\d/.test(m.textContent)) return;
    /* Background tabs only run timers about once a minute, so use a wide window instead of 5 seconds:
       fire any time in the last 2 minutes before the lead time... */
    if (leadSec > 0 && secs <= leadSec && secs > Math.max(0, leadSec - 120) && !fired[k]) { fired[k] = 1; play(); }
    /* ...and if the countdown already rolled over to the next tour before we saw it (lead 0, or a
       sleeping tab), fire for the tour that just started as long as we saw it close to start. */
    if (last && last.k !== k && !fired[last.k] && last.secs <= leadSec + 150 && Date.now() - last.t < 4 * 60e3) { fired[last.k] = 1; play(); }
    last = { k: k, secs: secs, t: Date.now() };
  }, 1000);
})();
