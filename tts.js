// Lazy-loaded TTS composer for /chat and /group-chat (only fetched when speaker is tapped)
(function(){
  if (window.__dsTtsUi) { window.__dsTtsUi(); return; }
  var menu = document.createElement("div"), panel = document.createElement("div");
  menu.id = "dsTtsMenu"; panel.id = "dsTtsPanel";
  var css = "position:fixed;z-index:9999;background:#fff8e6;border:2px solid #cb972e;border-radius:10px;padding:8px;font:15px 'Comic Sans MS','Comic Sans',cursive;box-shadow:0 4px 14px rgba(0,0,0,.35)";
  menu.style.cssText = css + ";display:none"; panel.style.cssText = css + ";display:none;width:min(420px,90vw)";
  var b = document.createElement("button"); b.type = "button"; b.textContent = "\uD83D\uDDE3 Text to speech";
  b.style.cssText = "font:inherit;background:#f3bf56;border:2px solid #cb972e;border-radius:8px;padding:4px 10px;cursor:pointer";
  menu.appendChild(b);
  var inp = document.createElement("input"); inp.maxLength = 1000; inp.placeholder = "Type, then press Enter \u2014 it will be spoken to them";
  inp.style.cssText = "width:100%;box-sizing:border-box;font:inherit;padding:6px;border:1px solid #cb972e;border-radius:6px";
  var st = document.createElement("div"); st.style.cssText = "font-size:12px;color:#6a4a10;margin-top:4px"; st.textContent = "Enter = send as voice \u00b7 Esc = close";
  panel.appendChild(inp); panel.appendChild(st); document.body.appendChild(menu); document.body.appendChild(panel);
  function place(el){ var s = document.getElementById("dsSpkBtn"), r = s ? s.getBoundingClientRect() : {left:20, top:innerHeight-60};
    el.style.left = Math.max(8, Math.min(r.left, innerWidth - 440)) + "px"; el.style.bottom = (innerHeight - r.top + 6) + "px"; el.style.top = "auto"; }
  function closeAll(){ menu.style.display = panel.style.display = "none"; }
  b.onclick = function(){ menu.style.display = "none"; place(panel); panel.style.display = "block"; inp.focus(); };
  inp.onkeydown = function(e){
    if (e.key === "Escape") { closeAll(); return; }
    if (e.key !== "Enter") return; e.preventDefault();
    var t = inp.value.trim(); if (!t || !window.DS_TTS) return; inp.disabled = true; st.textContent = "Sending\u2026";
    window.DS_TTS.send(t).then(function(){ inp.value = ""; st.textContent = "Sent \u2014 they'll hear it."; try { var u = new SpeechSynthesisUtterance(t); speechSynthesis.cancel(); speechSynthesis.speak(u); } catch(_){} if (window.DS_TTS.refresh) window.DS_TTS.refresh(); })
      .catch(function(er){ st.textContent = "Couldn't send: " + ((er && er.message) || er); }).then(function(){ inp.disabled = false; inp.focus(); });
  };
  document.addEventListener("mousedown", function(e){ var s = document.getElementById("dsSpkBtn"); if (!menu.contains(e.target) && !panel.contains(e.target) && e.target !== s) closeAll(); });
  window.__dsTtsUi = function(){ if (menu.style.display === "block" || panel.style.display === "block") { closeAll(); return; } place(menu); menu.style.display = "block"; };
  window.__dsTtsUi();
})();
