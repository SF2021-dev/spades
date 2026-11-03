(function(){
var D=window.WX_DEFAULT,K='wxloc:'+location.pathname.replace(/\/$/,''),tmr;
function get(){try{var o=JSON.parse(localStorage.getItem(K));if(!o)return null;if(o.until&&Date.now()>o.until){localStorage.removeItem(K);return null;}return o;}catch(e){return null;}}
window.wxCur=function(){return get()||D;};
function sched(){clearTimeout(tmr);var o=get();if(o&&o.until)tmr=setTimeout(function(){localStorage.removeItem(K);upd();loadTemp();},o.until-Date.now()+50);}
var wx=document.getElementById('wx');if(!wx)return;
var wrap=document.createElement('div');wrap.className='wxwrap';wx.parentNode.insertBefore(wrap,wx);wrap.appendChild(wx);
var st=document.createElement('style');st.textContent='.wxwrap{position:relative}.wxwrap .wxp{display:none;position:absolute;right:0;top:100%;z-index:50;background:rgba(10,10,10,.95);border:1px solid #c9a227;border-radius:8px;padding:8px;font:13px sans-serif;color:#f0d78c;min-width:230px;box-shadow:0 4px 14px rgba(0,0,0,.6);text-align:left}.wxwrap:hover .wxp,.wxwrap .wxp:focus-within{display:block}.wxp input[type=text]{width:140px;background:#111;color:#f0d78c;border:1px solid #806a1f;border-radius:4px;padding:3px 5px}.wxp button{background:#c9a227;color:#111;border:0;border-radius:4px;padding:3px 8px;margin-left:4px;cursor:pointer;font-weight:bold}.wxp label{display:block;margin-top:6px;cursor:pointer}.wxp .m{margin-top:5px;font-size:12px;opacity:.85}.wxp a{color:#f0d78c;cursor:pointer;text-decoration:underline}';document.head.appendChild(st);
var p=document.createElement('div');p.className='wxp';
p.innerHTML='<div>Show weather for:</div><form><input type="text" placeholder="City, e.g. Chicago"><button>Go</button><label><input type="checkbox" checked> revert after 5 minutes</label></form><div class="m"></div>';
wrap.appendChild(p);
var f=p.querySelector('form'),inp=p.querySelector('input[type=text]'),cb=p.querySelector('input[type=checkbox]'),m=p.querySelector('.m');
function upd(){var o=get();m.innerHTML=o?'Showing '+o.name+(o.until?' until '+new Date(o.until).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}):'')+' · <a>back to '+D.name+'</a>':'Default: '+D.name;var a=m.querySelector('a');if(a)a.onclick=function(){localStorage.removeItem(K);clearTimeout(tmr);upd();loadTemp();};}
f.onsubmit=function(e){e.preventDefault();var q=inp.value.trim();if(!q)return;m.textContent='Searching…';
fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&name='+encodeURIComponent(q.split(',')[0].trim())).then(function(r){return r.json();}).then(function(j){var r=j.results&&j.results[0];if(!r){m.textContent='Not found: '+q;return;}
var o={lat:r.latitude,lon:r.longitude,name:r.name+(r.admin1?', '+r.admin1:(r.country?', '+r.country:''))};if(cb.checked)o.until=Date.now()+300000;
localStorage.setItem(K,JSON.stringify(o));inp.value='';upd();sched();loadTemp();}).catch(function(){m.textContent='Lookup failed';});};
upd();sched();
if(get())loadTemp();
})();
