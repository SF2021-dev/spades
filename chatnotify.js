/* Main-page hook for /chat and /group-chat: if this browser is logged in (remember-me PIN cookie) and someone has asked to chat
   privately, show a small banner with Allow / Deny. Does not touch the message board. */
(function(){
  fetch("/api/chat?action=pending", {credentials:"same-origin", cache:"no-store"}).then(function(r){ return r.ok ? r.json() : null; }).then(function(j){
    if (!j || !j.requests || !j.requests.length) return;
    var b = document.createElement("div");
    b.style.cssText = "position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:9999;background:#000;color:#f3bf56;border:1px solid #f3bf56;border-radius:10px;padding:10px 14px;font:16px Georgia,serif;max-width:92vw;box-shadow:0 4px 18px rgba(0,0,0,.6)";
    j.requests.forEach(function(q){
      var d = document.createElement("div"); d.style.margin = "4px 0";
      d.appendChild(document.createTextNode(q.from + " wants to chat privately with you. "));
      [["Allow", true], ["Deny", false]].forEach(function(o){
        var x = document.createElement("button"); x.textContent = o[0];
        x.style.cssText = "margin-left:6px;background:#161616;color:#fbe646;border:1px solid #f3bf56;border-radius:6px;padding:3px 10px;cursor:pointer";
        x.onclick = function(){ fetch("/api/chat", {method:"POST", credentials:"same-origin", headers:{"Content-Type":"application/json"}, body:JSON.stringify({action:"answer", from:q.from, ok:o[1]})})
          .then(function(){ if (o[1]) location.href = "/chat?to=" + encodeURIComponent(q.from); else { d.remove(); if (!b.querySelector("button")) b.remove(); } }); };
        d.appendChild(x);
      });
      b.appendChild(d);
    });
    document.body.appendChild(b);
  }).catch(function(){});
  fetch("/api/groupchat?action=pending", {credentials:"same-origin", cache:"no-store"}).then(function(r){ return r.ok ? r.json() : null; }).then(function(j){
    if (!j || !j.invites || !j.invites.length) return;
    var b = document.createElement("div");
    b.style.cssText = "position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:9999;background:#000;color:#f3bf56;border:1px solid #f3bf56;border-radius:10px;padding:10px 14px;font:16px Georgia,serif;max-width:92vw";
    b.innerHTML = "You have " + j.invites.length + " group chat invitation" + (j.invites.length > 1 ? "s" : "") + ". ";
    var a = document.createElement("a"); a.href = "/group-chat"; a.textContent = "Review (join / decline)"; a.style.color = "#fbe646"; b.appendChild(a);
    document.body.appendChild(b);
  }).catch(function(){});
})();
