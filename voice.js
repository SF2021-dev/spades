// Diamond Spaders lobby audio feed (WebRTC mesh, signaling via /api/voice)
(function(){
var css=document.createElement("style");css.textContent="#dsv{position:fixed;left:10px;bottom:10px;z-index:9999;font:14px Arial,sans-serif}#dsv a{color:#7a3fc4;font-weight:bold;cursor:pointer;text-decoration:underline}#dsvp{display:none;margin-top:6px;background:#fff;border:2px solid #7a3fc4;border-radius:8px;padding:8px;min-width:200px;box-shadow:0 2px 8px rgba(0,0,0,.3);color:#222}#dsvp button{background:#7a3fc4;color:#fff;border:0;border-radius:5px;padding:5px 14px;cursor:pointer}#dsvl{margin-top:6px;font-size:12px}";
document.head.appendChild(css);
var w=document.createElement("div");w.id="dsv";w.innerHTML='<div id="dsvp"><button id="dsvj">Join</button> <label><input type="checkbox" id="dsvo"> listen only</label><div id="dsvs" style="font-size:12px;color:#666"></div><div id="dsvl"></div></div><a id="dsva" style="display:block;line-height:1.15;cursor:pointer"><span style="display:block;font-size:18px;font-weight:bold">Diamond Spaders lobby</span><span style="display:block;font-size:13px">shared audio</span></a>';
document.body.appendChild(w);
var $=function(i){return document.getElementById(i)},on=false,ME="",stream=null,pcs={},timer=null,ICE=[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:stun.cloudflare.com:3478"}];
$("dsva").onclick=function(){var p=$("dsvp");p.style.display=p.style.display==="block"?"none":"block";};
function post(b){return fetch("/api/voice",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)}).then(function(r){return r.json();});}
function sig(to,type,data){post({action:"signal",to:to,type:type,data:JSON.stringify(data)});}
function status(t){$("dsvs").textContent=t;}
function mk(name){if(pcs[name])return pcs[name];var pc=new RTCPeerConnection({iceServers:ICE});pcs[name]=pc;
 if(stream)stream.getTracks().forEach(function(t){pc.addTrack(t,stream);});else pc.addTransceiver("audio",{direction:"recvonly"});
 pc.onicecandidate=function(e){if(e.candidate)sig(name,"ice",e.candidate);};
 pc.ontrack=function(e){var a=document.getElementById("dsva-"+name);if(!a){a=document.createElement("audio");a.id="dsva-"+name;a.autoplay=true;document.body.appendChild(a);}a.srcObject=e.streams[0]||new MediaStream([e.track]);a.play().catch(function(){});};
 pc.onconnectionstatechange=function(){if(pc.connectionState==="failed"||pc.connectionState==="closed")drop(name);};
 return pc;}
function drop(n){var pc=pcs[n];if(pc){try{pc.close();}catch(e){}delete pcs[n];}var a=document.getElementById("dsva-"+n);if(a)a.remove();}
function call(name){var pc=mk(name);pc.createOffer().then(function(o){return pc.setLocalDescription(o);}).then(function(){sig(name,"offer",pc.localDescription);});}
function poll(){if(!on)return;fetch("/api/voice",{credentials:"same-origin",cache:"no-store"}).then(function(r){return r.json();}).then(function(j){
 var names={};(j.peers||[]).forEach(function(p){names[p.name.toLowerCase()]=1;});
 $("dsvl").innerHTML="<b>In the lobby:</b><br>"+(j.peers||[]).map(function(p){return p.name+(p.listen?" (listening)":" 🎤");}).join("<br>");
 Object.keys(pcs).forEach(function(n){if(!names[n.toLowerCase()])drop(n);});
 (j.signals||[]).forEach(function(s){var d=JSON.parse(s.data),pc;
  if(s.type==="offer"){if(pcs[s.from])drop(s.from);pc=mk(s.from);pc.setRemoteDescription(d).then(function(){return pc.createAnswer();}).then(function(a){return pc.setLocalDescription(a);}).then(function(){sig(s.from,"answer",pc.localDescription);});}
  else if(s.type==="answer"&&pcs[s.from])pcs[s.from].setRemoteDescription(d).catch(function(){});
  else if(s.type==="ice"&&pcs[s.from])pcs[s.from].addIceCandidate(d).catch(function(){});
  else if(s.type==="hello"&&!pcs[s.from])call(s.from);});
 // newcomer rule: whoever joined later calls; we greet existing peers once on join
}).catch(function(){}).then(function(){if(on)timer=setTimeout(poll,1500);});}
$("dsvj").onclick=function(){
 if(on){on=false;clearTimeout(timer);Object.keys(pcs).forEach(drop);if(stream)stream.getTracks().forEach(function(t){t.stop();});stream=null;post({action:"leave"});$("dsvj").textContent="Join";$("dsvo").disabled=false;$("dsvl").innerHTML="";status("");return;}
 var lo=$("dsvo").checked;status("Connecting…");
 (lo?Promise.resolve(null):navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}})).then(function(s){stream=s;
  return post({action:"join",listen:lo});}).then(function(j){if(j.error)throw new Error(j.error);ME=j.me;on=true;$("dsvj").textContent="Leave";$("dsvo").disabled=true;status(lo?"Joined — listening only":"Joined — your mic is live");
  return fetch("/api/voice",{credentials:"same-origin",cache:"no-store"}).then(function(r){return r.json();});}).then(function(j){
  (j.peers||[]).forEach(function(p){if(p.name.toLowerCase()!==ME.toLowerCase())call(p.name);});poll();})
 .catch(function(e){status("Couldn't join: "+(e.message||e));if(stream)stream.getTracks().forEach(function(t){t.stop();});stream=null;});};
window.addEventListener("pagehide",function(){if(on)navigator.sendBeacon&&navigator.sendBeacon("/api/voice",new Blob([JSON.stringify({action:"leave"})],{type:"application/json"}));});
})();
