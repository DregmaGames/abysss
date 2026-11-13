// Save backup panel (step UX): EXPORT SAVE and IMPORT SAVE, opened from Settings. The code itself is made and read by src/backup.js.
// The code is shown in a real DOM text box laid over the canvas (a canvas cannot select or paste text): it is also the manual-copy
// fallback when the clipboard is blocked (inside an iframe, say). Import: paste, CHECK, a summary of what the code holds, then confirm.
(function (G) {
  var UI = G.UI, P = G.Panels;
  P.bak = { mode: 'export', phase: 'input', text: '', status: '', err: '', res: null };

  var ERR = { empty: 'bak.err.empty', format: 'bak.err.format', checksum: 'bak.err.checksum', data: 'bak.err.data', shape: 'bak.err.shape', version: 'bak.err.version' };
  var ta = null;      // the DOM text box while the panel is open
  function dropBox() {
    if (!ta) return;
    P.bak.text = ta.value;
    if (ta.parentNode) ta.parentNode.removeChild(ta);
    ta = null;
  }
  function hexCss(key) { return '#' + ('000000' + UI.hex(key).toString(16)).slice(-6); }
  function box(scene, x, y, w, h, readonly, value) {
    var S = G.view.S, el = document.createElement('textarea');      // in the DOM layer (src/main.js): game CSS px, turned with the game
    el.value = value; el.readOnly = readonly; el.spellcheck = false; el.setAttribute('autocomplete', 'off'); el.setAttribute('aria-label', G.t('bak.label'));
    var st = el.style;
    st.position = 'absolute'; st.pointerEvents = 'auto'; st.left = Math.round(x * S) + 'px'; st.top = Math.round(y * S) + 'px';
    st.width = Math.round(w * S) + 'px'; st.height = Math.round(h * S) + 'px'; st.boxSizing = 'border-box'; st.margin = '0'; st.padding = Math.round(2 * S) + 'px';
    st.background = hexCss('ui_bg'); st.color = hexCss('ui_text'); st.border = Math.max(1, S) + 'px solid ' + hexCss('ui_line');
    st.font = Math.max(11, 4 * S) + 'px monospace'; st.resize = 'none'; st.outline = 'none'; st.overflowY = 'auto';
    st.wordBreak = 'break-all'; st.zIndex = '20'; st.userSelect = 'text'; st.webkitUserSelect = 'text'; st.touchAction = 'auto';
    st.opacity = '0.99';      // without it Chromium leaves a hole in the page under the box in screenshots (headless compositor quirk)
    // keys typed or pasted here belong to the box, never to the game (I, WASD, ESC and 1-3 are bound)
    ['keydown', 'keyup', 'keypress'].forEach(function (k) { el.addEventListener(k, function (e) { e.stopPropagation(); }); });
    el.addEventListener('focus', function () { if (readonly) el.select(); });
    G.domLayer().appendChild(el);
    if (!readonly && !G.touch) el.focus();
    return el;
  }
  P.backupBoxValue = function () { return ta ? ta.value : P.bak.text; };      // QA hook

  function copyText(text, done) {
    var viaOld = function () {
      try { if (ta) { ta.focus(); ta.select(); return !!document.execCommand('copy'); } } catch (e) { /* blocked */ }
      return false;
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(viaOld()); }); return; }
    } catch (e) { /* fall through */ }
    done(viaOld());
  }
  function download(text) {
    try {
      var url = URL.createObjectURL(new Blob([text + '\n'], { type: 'text/plain' })), a = document.createElement('a');
      a.href = url; a.download = 'riftscar-save.txt'; a.style.display = 'none';
      document.body.appendChild(a); a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
      return true;
    } catch (e) { return false; }
  }

  // mode 'export' | 'import'; phase (import): 'input' | 'confirm'
  P.openBackup = function (scene, mode, keep) {
    dropBox();
    if (P.L) P.L.destroy();
    var B = P.bak, V = G.view, t = G.t;
    if (mode) { B.mode = mode; if (!keep) { B.phase = 'input'; B.text = ''; B.status = ''; B.err = ''; B.res = null; } }
    var exp = B.mode === 'export', confirm = !exp && B.phase === 'confirm';
    if (exp) B.text = G.encodeSave(G.save);
    P.current = 'backup'; P.scene = scene; G.paused = true;
    var pw = Math.min(V.W - 8, 250), ph = 160, L = P.L = UI.modal(scene, pw, ph, t(exp ? 'set.export' : 'set.import')), x0 = L.x, y0 = L.y, inner = pw - 16, bw = Math.floor((inner - 6) / 2);
    var plainDestroy = L.destroy;
    L.destroy = function () { dropBox(); plainDestroy(); };
    function back() { dropBox(); P.openSettings(scene, P.back); }
    function status(s, color) { return L.text(x0 + 8, y0 + 98, s, color || 'ui_dim').setMaxWidth(inner); }
    L.button(x0 + pw - 22, y0 + 3, 18, 16, '', back, { icon: 'i_close', name: 'bak_close' });

    if (confirm) {
      var r = B.res.info, y = y0 + 22;
      L.text(x0 + 8, y, t('bak.found'), 'ui_warn'); y += 11;
      r.chars.forEach(function (c) {
        var tx = L.text(x0 + 8, y, t('bak.char', { name: G.classLabel(c.id), items: G.plural('items', c.items), gold: c.gold }), 'ui_text').setMaxWidth(inner); y += tx.height + 3;
      });
      if (!r.chars.length) { L.text(x0 + 8, y, t('bak.none'), 'ui_dim'); y += 10; }
      var tt = L.text(x0 + 8, y + 2, t('bak.total', { items: G.plural('items', r.items), gold: r.gold, runs: r.runs }), 'gold').setMaxWidth(inner); y += tt.height + 8;
      L.text(x0 + 8, y, t('bak.warn'), 'ui_bad').setMaxWidth(inner);
      L.button(x0 + 8, y0 + ph - 26, bw, 18, t('bak.replace'), function () {
        var keepSet = G.save.settings, s = B.res.save;
        s.settings = keepSet;      // zoom, shake and language belong to this device, not to the backup
        G.save = s; G.storeSave(G.save); B.res = null; B.text = '';
        P.close(true); G.toTitle();
      }, { name: 'bak_replace', color: 'ui_bad' });
      L.button(x0 + 14 + bw, y0 + ph - 26, bw, 18, t('bak.cancel'), function () { B.phase = 'input'; B.res = null; P.openBackup(scene, 'import', true); }, { name: 'bak_cancel' });
      return;
    }

    var hint = L.text(x0 + 8, y0 + 20, t(exp ? 'bak.exportHint' : 'bak.importHint'), 'ui_dim').setMaxWidth(inner), by = y0 + 22 + hint.height;
    ta = box(scene, x0 + 8, by, inner, Math.max(28, y0 + 95 - by), exp, B.text);
    if (B.err) status(t(B.err), 'ui_bad'); else if (B.status) status(t(B.status), B.status === 'bak.copied' || B.status === 'bak.downloaded' ? 'ui_good' : 'ui_warn');
    if (exp) {
      L.button(x0 + 8, y0 + 118, bw, 18, t('bak.copy'), function () {
        var code = ta ? ta.value : B.text;
        copyText(code, function (okc) {
          B.err = ''; B.status = okc ? 'bak.copied' : 'bak.copyBlocked';
          if (P.current === 'backup' && B.mode === 'export') { var keepSel = !okc; dropBox(); P.openBackup(scene, null); if (keepSel && ta) { ta.focus(); ta.select(); } }
        });
      }, { name: 'bak_copy', color: 'ui_good' });
      L.button(x0 + 14 + bw, y0 + 118, bw, 18, t('bak.download'), function () {
        var code = ta ? ta.value : B.text, okd = download(code);
        B.err = ''; B.status = okd ? 'bak.downloaded' : 'bak.noDownload';
        dropBox(); P.openBackup(scene, null);
      }, { name: 'bak_download' });
    } else {
      L.button(x0 + 8, y0 + 118, bw, 18, t('bak.paste'), function () {
        var fail = function () { B.err = 'bak.pasteBlocked'; B.status = ''; dropBox(); P.openBackup(scene, null); if (ta) ta.focus(); };
        try {
          if (!navigator.clipboard || !navigator.clipboard.readText) { fail(); return; }
          navigator.clipboard.readText().then(function (s) { B.text = s; B.err = ''; B.status = ''; if (P.current === 'backup') { dropBox(); B.text = s; P.openBackup(scene, null, true); } }, fail);
        } catch (e) { fail(); }
      }, { name: 'bak_paste' });
      L.button(x0 + 14 + bw, y0 + 118, bw, 18, t('bak.check'), function () {
        var code = ta ? ta.value : B.text, res = G.decodeSave(code);
        dropBox(); B.text = code;
        if (res.ok) { B.res = res; B.phase = 'confirm'; B.err = ''; } else { B.err = ERR[res.err] || ERR.data; B.status = ''; }
        P.openBackup(scene, null, true);
      }, { name: 'bak_check', color: 'ui_good' });
    }
    L.button(x0 + 8, y0 + ph - 22, inner, 16, t('bak.back'), back, { name: 'bak_back' });
  };
})(globalThis.G = globalThis.G || {});
