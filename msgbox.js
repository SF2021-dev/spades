/* Diamond Spaders message box: fills <div id="ds-msgbox"> on the main page; messages are emailed via FormSubmit */
(function(){
  var ENDPOINT = "https://formsubmit.co/ajax/f865a31f1882069405c71e61dc656f64";
  var box = document.getElementById("ds-msgbox");
  if (!box) return;
  var F = "'Comic Sans MS','Comic Sans',cursive";
  box.style.cssText = "max-width:900px;margin:24px auto 8px;padding:0 12px;font-family:" + F + ";";
  var css = document.createElement("style");
  css.textContent =
    "#ds-msgbox .mb-card{background:#1a1200;border:1px solid #3a2c00;border-radius:10px;padding:14px 16px}" +
    "#ds-msgbox .mb-title{color:#fbe646;font-size:18px;font-weight:700;margin-bottom:8px}" +
    "#ds-msgbox label{color:#fbe646;font-size:15px}" +
    "#ds-msgbox input[type=text],#ds-msgbox textarea{display:block;width:100%;box-sizing:border-box;background:#0a0a0a;color:#eee;border:1px solid #fbe646;border-radius:6px;padding:8px 10px;font:16px " + F + ";margin:4px 0 10px}" +
    "#ds-msgbox textarea{height:110px;resize:vertical}" +
    "#ds-msgbox button{background:#fbe646;color:#000;border:0;border-radius:6px;padding:8px 22px;font:700 16px " + F + ";cursor:pointer}" +
    "#ds-msgbox button:disabled{opacity:.5;cursor:default}" +
    "#ds-msgbox .mb-status{color:#fbe646;font-size:14px;min-height:20px;margin-top:8px}";
  document.head.appendChild(css);
  box.innerHTML =
    '<div class="mb-card"><div class="mb-title">Send a message</div>' +
    '<form id="mb-form" autocomplete="off">' +
    '<label for="mb-name">name or username:</label><input type="text" id="mb-name" maxlength="40" required>' +
    '<textarea id="mb-text" maxlength="1000" required aria-label="Message" placeholder="your message"></textarea>' +
    '<input type="text" id="mb-hp" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">' +
    '<button type="submit" id="mb-send">Send</button><div class="mb-status" id="mb-status"></div></form></div>';
  var form = document.getElementById("mb-form"), st = document.getElementById("mb-status"), btn = document.getElementById("mb-send");
  var saved = localStorage.getItem("ds-mb-name"); if (saved) document.getElementById("mb-name").value = saved;
  form.addEventListener("submit", function(ev){
    ev.preventDefault();
    var name = document.getElementById("mb-name").value.trim(), msg = document.getElementById("mb-text").value.trim();
    if (!name || !msg) { st.textContent = "Please fill in your name and a message."; return; }
    btn.disabled = true; st.textContent = "Sending…";
    fetch(ENDPOINT, {method: "POST", headers: {"Content-Type": "application/json", "Accept": "application/json"},
      body: JSON.stringify({name: name, message: msg, _subject: "Diamond Spaders message from " + name,
                            _template: "table", _captcha: "false", _honey: document.getElementById("mb-hp").value})})
      .then(function(r){ return r.json(); }).then(function(d){
        if (String(d.success) !== "true") { st.textContent = "Sorry, that didn't send. Please try again later."; return; }
        localStorage.setItem("ds-mb-name", name);
        document.getElementById("mb-text").value = "";
        st.textContent = "Thanks! Your message was sent.";
      }).catch(function(){ st.textContent = "Sorry, that didn't send. Please try again later."; })
      .finally(function(){ btn.disabled = false; });
  });
})();
