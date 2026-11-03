// Lower-left "buzz X" button; this page listens for buzzes aimed at its own owner.
(function () {
  var s = document.currentScript, to = s.getAttribute("data-to"), me = s.getAttribute("data-me");
  var snd = new Audio("/buzz.wav?v=2"); snd.preload = "auto"; snd.volume = 1;
  var b = document.createElement("button"); b.type = "button"; b.id = "dsBuzzBtn";
  b.innerHTML = "&#128264; buzz " + to.charAt(0).toUpperCase() + to.slice(1);
  b.title = "Play a loud buzz on " + to + "'s screen (their start page must be open)";
  b.style.cssText = "position:fixed;left:10px;bottom:10px;z-index:9998;background:rgba(0,0,0,.55);color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:14px;padding:3px 10px;font:12px sans-serif;cursor:pointer";
  function add() { document.body.appendChild(b); }
  document.body ? add() : document.addEventListener("DOMContentLoaded", add);
  b.onclick = function () {
    fetch("/api/startbuzz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: to }) })
      .then(function (r) { b.lastChild.textContent = r.ok ? " buzzed!" : (r.status === 429 ? " wait…" : " failed"); })
      .catch(function () { b.lastChild.textContent = " failed"; })
      .then(function () { setTimeout(function () { b.innerHTML = "&#128264; buzz " + to.charAt(0).toUpperCase() + to.slice(1); }, 2000); });
  };
  // unlock audio on first interaction (browsers block autoplay otherwise)
  function unlock() { snd.muted = true; snd.play().then(function () { snd.pause(); snd.currentTime = 0; snd.muted = false; }).catch(function () {}); document.removeEventListener("pointerdown", unlock); document.removeEventListener("keydown", unlock); }
  document.addEventListener("pointerdown", unlock); document.addEventListener("keydown", unlock);
  var last = null;
  function fx() {
    try { snd.currentTime = 0; snd.volume = 1; snd.play(); } catch (e) {}
    try { var ac = new (window.AudioContext || window.webkitAudioContext)(), o = ac.createOscillator(), g = ac.createGain(); o.type = "sawtooth"; o.frequency.value = 110; g.gain.value = 0.6; o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 1.2); } catch (e) {}
    var d = document.documentElement; d.style.transition = "filter .1s"; d.style.filter = "invert(1)"; setTimeout(function () { d.style.filter = ""; }, 300);
  }
  function poll() {
    fetch("/api/startbuzz?for=" + me, { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
      if (last !== null && j.ts > last && j.now - j.ts < 20000) fx();
      last = j.ts || 0;
    }).catch(function () {});
  }
  poll(); setInterval(poll, 3000);
})();
