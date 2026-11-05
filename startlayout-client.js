/* startlayout-client.js — load/save icon layout via /api/startlayout
 * Usage: <script src="/startlayout-client.js" data-page="start"></script>
 * Requires .icons-area / .icon-row / .icon-sq structure and existing drag handlers
 * that call window.__startLayoutSave() after a successful reorder.
 */
(function () {
  var s = document.currentScript;
  var PAGE = (s && s.getAttribute('data-page')) || 'start';
  var saveTimer = null;

  function serializeLayout() {
    return Array.prototype.map.call(document.querySelectorAll('.icon-row'), function (row) {
      return {
        top: false,
        items: Array.prototype.map.call(row.querySelectorAll('.icon-sq'), function (a) {
          var img = a.querySelector('img');
          var src = img ? (img.getAttribute('src') || img.src) : '';
          try {
            var u = new URL(src, location.origin);
            if (u.origin === location.origin) src = u.pathname + u.search;
          } catch (e) {}
          return { href: a.href, title: a.title || '', img: src, label: null };
        })
      };
    }).filter(function (r) { return r.items.length; });
  }

  function applyLayout(layout) {
    var area = document.querySelector('.icons-area');
    if (!area || !layout || !layout.length) return;
    area.innerHTML = '';
    layout.forEach(function (row) {
      var div = document.createElement('div');
      div.className = 'icon-row';
      (row.items || []).forEach(function (it) {
        var a = document.createElement('a');
        a.className = 'icon-sq';
        a.href = it.href;
        a.title = it.title || '';
        var img = document.createElement('img');
        img.src = it.img;
        img.alt = it.title || '';
        a.appendChild(img);
        div.appendChild(a);
      });
      area.appendChild(div);
    });
    if (typeof window.__startLayoutAfterApply === 'function') window.__startLayoutAfterApply();
  }

  function toast(msg, ok) {
    var el = document.getElementById('layout-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'layout-toast';
      el.style.cssText = 'position:fixed;bottom:48px;left:50%;transform:translateX(-50%);z-index:10000;padding:10px 18px;border-radius:10px;font-size:0.9rem;font-weight:600;pointer-events:none;transition:opacity 0.3s;background:rgba(0,0,0,0.75);color:#fff;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = '1';
    el.style.color = ok ? '#7dffa3' : '#ffb4b4';
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.style.opacity = '0'; }, 2800);
  }

  async function ensureLogin() {
    var st = await fetch('/api/startlogin?page=' + encodeURIComponent(PAGE), { credentials: 'same-origin' })
      .then(function (r) { return r.json(); }).catch(function () { return {}; });
    if (st.loggedIn) return true;
    var pw = prompt('Owner password to save ' + PAGE + ' layout:');
    if (!pw) return false;
    var res = await fetch('/api/startlogin', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: PAGE, password: pw })
    });
    if (!res.ok) {
      var err = await res.json().catch(function () { return {}; });
      toast(err.error || 'Login failed', false);
      return false;
    }
    return true;
  }

  async function saveLayout() {
    var layout = serializeLayout();
    if (!layout.length) return;
    try {
      var res = await fetch('/api/startlayout?page=' + encodeURIComponent(PAGE), {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: layout })
      });
      if (res.status === 403) {
        if (!(await ensureLogin())) return;
        res = await fetch('/api/startlayout?page=' + encodeURIComponent(PAGE), {
          method: 'PUT',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ layout: layout })
        });
      }
      if (!res.ok) {
        var err = await res.json().catch(function () { return {}; });
        toast(err.error || ('Save failed (' + res.status + ')'), false);
        return;
      }
      toast('Layout saved', true);
    } catch (e) {
      toast('Save failed (network)', false);
    }
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveLayout, 400);
  }

  window.__startLayoutSave = scheduleSave;

  async function loadLayout() {
    try {
      var res = await fetch('/api/startlayout?page=' + encodeURIComponent(PAGE), { credentials: 'same-origin' });
      if (!res.ok) return;
      var data = await res.json();
      if (data && data.layout && data.layout.length) applyLayout(data.layout);
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadLayout);
  else loadLayout();
})();
