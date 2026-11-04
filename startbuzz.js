// Lower-left "buzz X" button; this page listens for buzzes aimed at its own owner.
(function () {
  var s = document.currentScript, to = s.getAttribute("data-to"), me = s.getAttribute("data-me");
  var snd = new Audio("/buzz.mp3?v=3"); snd.preload = "auto"; snd.volume = 1;
  var b = document.createElement("button"); b.type = "button"; b.id = "dsBuzzBtn";
  b.innerHTML = "&#128264; buzz " + to.charAt(0).toUpperCase() + to.slice(1);
  b.title = "Play a loud buzz on " + to + "'s screen (their start page must be open)";
  b.style.cssText = "position:fixed;left:10px;bottom:10px;z-index:9998;background:rgba(0,0,0,.55);color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:14px;padding:3px 10px;font:12px sans-serif;cursor:pointer";
  function add() { document.body.appendChild(b); }
  document.body ? add() : document.addEventListener("DOMContentLoaded", add);
  b.onclick = function () {
    fetch("/api/startbuzz", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: to, from: me }) })
      .then(function (r) { b.lastChild.textContent = r.ok ? " buzzed!" : (r.status === 429 ? " wait…" : " failed"); })
      .catch(function () { b.lastChild.textContent = " failed"; })
      .then(function () { setTimeout(function () { b.innerHTML = "&#128264; buzz " + to.charAt(0).toUpperCase() + to.slice(1); }, 2000); });
  };
  // unlock audio on first interaction (browsers block autoplay otherwise)
  function unlock() { snd.muted = true; snd.play().then(function () { snd.pause(); snd.currentTime = 0; snd.muted = false; }).catch(function () {}); document.removeEventListener("pointerdown", unlock); document.removeEventListener("keydown", unlock); }
  document.addEventListener("pointerdown", unlock); document.addEventListener("keydown", unlock);
  var last = null;
  function fx(from) {
    try { snd.currentTime = 0; snd.volume = 1; snd.play(); } catch (e) {}
    var o2 = document.getElementById("dsBuzzOv");
    if (!o2) { o2 = document.createElement("div"); o2.id = "dsBuzzOv"; o2.style.cssText = "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.75);color:#f3bf56;font:bold 48px sans-serif;text-align:center;padding:20px;text-shadow:0 0 20px #000"; document.body.appendChild(o2); }
    var w0 = from || to, who = w0.charAt(0).toUpperCase() + w0.slice(1);
    o2.innerHTML = ""; var t = document.createElement("div"); t.textContent = who + " is buzzing you"; o2.appendChild(t);
    var GM = "https://messages.google.com/web/conversations", w = null;
    try { w = window.open(GM, "dsGoogleMessages"); } catch (e) {}
    if (!w) { var a = document.createElement("a"); a.href = GM; a.target = "dsGoogleMessages"; a.textContent = "Open Google Messages"; a.style.cssText = "display:block;margin-top:18px;font-size:24px;color:#fff;text-decoration:underline"; t.appendChild(a); }
    var sb = document.createElement("button"); sb.type = "button"; sb.innerHTML = "&#128263; Silence";
    sb.style.cssText = "margin-top:30px;font:bold 30px sans-serif;padding:16px 50px;border:0;border-radius:14px;background:#f3bf56;color:#000;cursor:pointer";
    function hide() { try { snd.pause(); snd.currentTime = 0; } catch (e) {} o2.style.display = "none"; }
    sb.onclick = hide; snd.onended = function () { o2.style.display = "none"; }; o2.appendChild(sb);
    o2.style.flexDirection = "column"; o2.style.display = "flex"; clearTimeout(o2._t);
  }
  function poll() {
    fetch("/api/startbuzz?for=" + me, { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
      if (last !== null && j.ts > last && j.now - j.ts < 20000) fx(j.from);
      last = j.ts || 0;
    }).catch(function () {});
  }
  poll(); setInterval(poll, 3000);
})();
