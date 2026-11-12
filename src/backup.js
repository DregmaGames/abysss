// Save backup (step UX): the whole save as one text code the player can copy, keep and paste back. No server, no Phaser, no clock.
//   code = "RS1." + base64(LZW(save JSON, ASCII-escaped)) + "." + checksum (8 hex digits, FNV-1a of the body)
// RS1 is the code format; the save inside carries its own version `v` and goes through G.parseSave (the normal migration) on import.
(function (G) {
  var HEAD = 'RS1', B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  // LZW over bytes, 16-bit codes (a full dictionary starts again): about 3-5x smaller than the JSON on a real save, ~30 lines
  function lzw(bytes) {
    var dict = new Map(), next = 256, out = [], w = '', i, c, wc;
    for (i = 0; i < bytes.length; i++) {
      c = String.fromCharCode(bytes[i]); wc = w + c;
      if (wc.length === 1 || dict.has(wc)) { w = wc; continue; }
      out.push(w.length === 1 ? w.charCodeAt(0) : dict.get(w));
      dict.set(wc, next++); w = c;
      if (next >= 65535) { dict = new Map(); next = 256; }
    }
    if (w) out.push(w.length === 1 ? w.charCodeAt(0) : dict.get(w));
    return out;
  }
  function unlzw(codes) {
    var dict = [], next = 256, out = [], w = null, i, e, k;
    for (i = 0; i < codes.length; i++) {
      k = codes[i];
      if (k < 256) e = String.fromCharCode(k);
      else if (dict[k - 256] !== undefined) e = dict[k - 256];
      else if (k === next && w !== null) e = w + w.charAt(0);
      else return null;
      out.push(e);
      if (w !== null) { dict[next - 256] = w + e.charAt(0); next++; if (next >= 65535) { dict = []; next = 256; w = null; continue; } }
      w = e;
    }
    return out.join('');
  }
  function toB64(bytes) {
    var s = '', i, n;
    for (i = 0; i < bytes.length; i += 3) {
      n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
      s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? B64[n & 63] : '=');
    }
    return s;
  }
  function fromB64(s) {
    if (s.length % 4 || /[^A-Za-z0-9+\/=]/.test(s) || /=[^=]/.test(s)) return null;
    var out = [], i, a, b, c, d;
    for (i = 0; i < s.length; i += 4) {
      a = B64.indexOf(s[i]); b = B64.indexOf(s[i + 1]); c = s[i + 2] === '=' ? 0 : B64.indexOf(s[i + 2]); d = s[i + 3] === '=' ? 0 : B64.indexOf(s[i + 3]);
      out.push((a << 2) | (b >> 4));
      if (s[i + 2] !== '=') out.push(((b & 15) << 4) | (c >> 2));
      if (s[i + 3] !== '=') out.push(((c & 3) << 6) | d);
    }
    return out;
  }
  function crc(str) {
    var h = 0x811c9dc5, i;
    for (i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('00000000' + h.toString(16)).slice(-8);
  }
  function ascii(json) { return json.replace(/[\u0080-￿]/g, function (ch) { return '\\u' + ('0000' + ch.charCodeAt(0).toString(16)).slice(-4); }); }

  G.encodeSave = function (save) {
    var json = ascii(JSON.stringify(save)), bytes = [], codes, i;
    for (i = 0; i < json.length; i++) bytes.push(json.charCodeAt(i));
    codes = lzw(bytes);
    var raw = [];
    codes.forEach(function (k) { raw.push(k >> 8, k & 255); });
    var body = toB64(raw);
    return HEAD + '.' + body + '.' + crc(body);
  };

  // text -> { ok: true, save, info } or { ok: false, err } (err: empty | format | checksum | data | version | shape). Never touches the current save.
  G.decodeSave = function (text) {
    var t = String(text == null ? '' : text).replace(/\s+/g, '');
    if (!t) return { ok: false, err: 'empty' };
    var parts = t.split('.');
    if (parts.length !== 3 || parts[0] !== HEAD) return { ok: false, err: 'format' };
    if (crc(parts[1]) !== parts[2].toLowerCase()) return { ok: false, err: 'checksum' };
    var raw = fromB64(parts[1]);
    if (!raw || raw.length % 2) return { ok: false, err: 'data' };
    var codes = [], i, json, s;
    for (i = 0; i < raw.length; i += 2) codes.push(raw[i] * 256 + raw[i + 1]);
    json = unlzw(codes);
    if (json === null) return { ok: false, err: 'data' };
    try { s = JSON.parse(json); } catch (e) { return { ok: false, err: 'data' }; }
    if (!s || typeof s !== 'object' || typeof s.v !== 'number' || !((s.gears && typeof s.gears === 'object') || Array.isArray(s.chars))) return { ok: false, err: 'shape' };
    if (s.v > 9 || s.v < 2 || s.v !== Math.floor(s.v)) return { ok: false, err: 'version' };
    var save = G.parseSave(json);      // the normal migration and sanitizing
    return { ok: true, save: save, from: s.v, info: G.saveSummary(save) };
  };

  // what a save holds, for the confirmation: { chars: [{ id, name, cls, items, gold, scrolls }], gold, items, scrolls, runs }
  G.saveSummary = function (save) {
    var out = { chars: [], gold: 0, items: 0, scrolls: 0, runs: save.stats ? save.stats.runs | 0 : 0 };
    save.chars.forEach(function (g) {
      var n = g.bag.length + G.SLOTS.filter(function (k) { return g.equipped[k]; }).length;
      out.chars.push({ id: g.id, name: g.name, cls: g.cls, items: n, gold: g.gold | 0, scrolls: g.scrolls | 0 });
      out.gold += g.gold | 0; out.items += n; out.scrolls += g.scrolls | 0;
    });
    return out;
  };
})(globalThis.G = globalThis.G || {});
