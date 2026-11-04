(function(){
var D=window.WX_DEFAULT,K='wxloc:'+location.pathname.replace(/\/$/,''),tmr;
function get(){try{var o=JSON.parse(localStorage.getItem(K));if(!o)return null;if(o.until&&Date.now()>o.until){localStorage.removeItem(K);return null;}return o;}catch(e){return null;}}
window.wxCur=function(){return get()||D;};
function sched(){clearTimeout(tmr);var o=get();if(o&&o.until)tmr=setTimeout(function(){localStorage.removeItem(K);upd();loadTemp();},o.until-Date.now()+50);}
var wx=document.getElementById('wx');if(!wx)return;
var wrap=document.createElement('div');wrap.className='wxwrap';var cs=getComputedStyle(wx);wrap.style.cssText='position:'+(cs.position==='static'?'relative':cs.position)+';right:'+cs.right+';bottom:'+cs.bottom+';z-index:'+(cs.zIndex==='auto'?30:cs.zIndex);wx.parentNode.insertBefore(wrap,wx);wrap.appendChild(wx);wx.style.position='static';
var st=document.createElement('style');st.textContent='.wxwrap .wxp{display:none;position:absolute;right:0;bottom:100%;z-index:50;background:rgba(10,10,10,.95);border:1px solid #c9a227;border-radius:8px;padding:8px;font:13px sans-serif;color:#f0d78c;min-width:230px;box-shadow:0 4px 14px rgba(0,0,0,.6);text-align:left}.wxwrap:hover .wxp,.wxwrap .wxp:focus-within{display:block}.wxp input[type=text]{width:140px;background:#111;color:#f0d78c;border:1px solid #806a1f;border-radius:4px;padding:3px 5px}.wxp button{background:#c9a227;color:#111;border:0;border-radius:4px;padding:3px 8px;margin-left:4px;cursor:pointer;font-weight:bold}.wxp label{display:block;margin-top:6px;cursor:pointer}.wxp .m{margin-top:5px;font-size:12px;opacity:.85}.wxp .sg{position:relative}.wxp .sl{display:none;position:absolute;left:0;top:100%;margin-top:2px;width:100%;max-height:220px;overflow:auto;background:#0d0d0d;border:1px solid #c9a227;border-radius:6px;z-index:60;box-shadow:0 4px 12px rgba(0,0,0,.7)}.wxp .sl div{padding:4px 7px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wxp .sl div small{opacity:.6;margin-left:4px}.wxp .sl div.on,.wxp .sl div:hover{background:#c9a227;color:#111}.wxp a{color:#f0d78c;cursor:pointer;text-decoration:underline}';document.head.appendChild(st);
var p=document.createElement('div');p.className='wxp';
p.innerHTML='<div>Show weather for:</div><form><span class="sg"><input type="text" placeholder="City, e.g. Chicago" autocomplete="off"><div class="sl"></div></span><button>Go</button><label><input type="checkbox" checked> revert after 5 minutes</label></form><div class="m"></div>';
wrap.appendChild(p);
var f=p.querySelector('form'),inp=p.querySelector('input[type=text]'),cb=p.querySelector('input[type=checkbox]'),m=p.querySelector('.m');
function upd(){var o=get();m.innerHTML=o?'Showing '+o.name+(o.until?' until '+new Date(o.until).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true}):'')+' · <a>back to '+D.name+'</a>':'Default: '+D.name;var a=m.querySelector('a');if(a)a.onclick=function(){localStorage.removeItem(K);clearTimeout(tmr);upd();loadTemp();};}
var sl=p.querySelector('.sl'),res=[],sel=-1,dt,seq=0;
function nm(r){return r.name+(r.admin1?', '+r.admin1:(r.country?', '+r.country:''));}
function full(r){return [r.name,r.admin1,r.country].filter(Boolean).join(', ');}
function pick(r){var o={lat:r.latitude,lon:r.longitude,name:nm(r)};if(cb.checked)o.until=Date.now()+300000;localStorage.setItem(K,JSON.stringify(o));inp.value='';hide();upd();sched();loadTemp();}
function hide(){sl.style.display='none';res=[];sel=-1;}
function esc(t){return String(t).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
function draw(){if(!res.length){sl.style.display='none';return;}sl.innerHTML=res.map(function(r,i){return '<div data-i="'+i+'"'+(i===sel?' class="on"':'')+'>'+esc(r.name)+'<small>'+esc([r.admin1,r.country].filter(Boolean).join(', '))+'</small></div>';}).join('');sl.style.display='block';}
function geo(q,n){return fetch('https://geocoding-api.open-meteo.com/v1/search?count='+n+'&language=en&name='+encodeURIComponent(q.split(',')[0].trim())).then(function(r){return r.json();}).then(function(j){var a=j.results||[],h=q.split(',').slice(1).join(',').trim().toLowerCase();if(h){var b=a.filter(function(r){return full(r).toLowerCase().indexOf(h)>=0;});if(b.length)a=b;}return a;});}
inp.addEventListener('input',function(){clearTimeout(dt);var q=inp.value.trim();if(q.length<2){hide();return;}var my=++seq;dt=setTimeout(function(){geo(q,8).then(function(a){if(my!==seq)return;res=a;sel=-1;draw();}).catch(function(){});},250);});
inp.addEventListener('keydown',function(e){if(sl.style.display!=='block')return;if(e.key==='ArrowDown'){e.preventDefault();sel=(sel+1)%res.length;draw();}else if(e.key==='ArrowUp'){e.preventDefault();sel=(sel-1+res.length)%res.length;draw();}else if(e.key==='Escape'){hide();}else if(e.key==='Enter'&&sel>=0){e.preventDefault();pick(res[sel]);}});
sl.addEventListener('mousedown',function(e){var d=e.target.closest('[data-i]');if(d){e.preventDefault();pick(res[+d.getAttribute('data-i')]);}});
inp.addEventListener('blur',function(){setTimeout(hide,150);});
f.onsubmit=function(e){e.preventDefault();var q=inp.value.trim();if(!q)return;if(res.length){pick(res[sel>=0?sel:0]);return;}m.textContent='Searching…';
geo(q,5).then(function(a){if(!a[0]){m.textContent='Not found: '+q;return;}pick(a[0]);}).catch(function(){m.textContent='Lookup failed';});};
upd();sched();
if(get())loadTemp();
})();
