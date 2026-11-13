// Entry point. The canvas fills the window (RESIZE); G.view holds the integer pixel scale S
// and the art-pixel viewport. 960x540 -> 480x270 @2x; 540x960 -> 270x480 @2x.
//
// Phones are landscape only. A page cannot turn the device, so a phone held upright (or with its rotation locked) gets
// the game turned a quarter instead: the game is laid out for the long side and drawn rotated 90 degrees clockwise,
// which reads upright once the phone is turned on its left side. G.rot says so. How: #game (the box Phaser measures)
// gets the swapped size and is NOT rotated (a rotated parent would measure as the upright box again); the canvas and
// the layer of DOM boxes (G.domLayer) carry the rotation, and pointer positions are turned back in transformPointer.
// When the browser itself goes landscape the rotation is off. ?rotate=0 never, ?rotate=1 on any upright window (QA).
(function (G) {
  G.params = new URLSearchParams(location.search);
  var host = document.getElementById('game'), clip = document.createElement('div'), dom = document.createElement('div');
  clip.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;overflow:hidden';      // keeps the wider-than-screen #game from widening the page
  host.parentNode.insertBefore(clip, host); clip.appendChild(host); clip.appendChild(dom);
  dom.id = 'dom';
  host.style.cssText = 'position:absolute;left:0;top:0';
  dom.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;z-index:20;transform-origin:0 0';
  G.domLayer = function () { return dom; };      // DOM boxes over the game go here, in game CSS pixels (position:absolute; pointer-events:auto)
  function wantRot() {
    var p = G.params.get('rotate'), tall = window.innerHeight > window.innerWidth;
    if (p === '0' || !tall) return false;
    if (p === '1') return true;
    return navigator.maxTouchPoints > 0 && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  }
  // size #game for the window and set / clear the quarter turn; returns the game size in CSS px
  G.fitHost = function () {
    var w = window.innerWidth, h = window.innerHeight, rot = wantRot(), gw = rot ? h : w, gh = rot ? w : h;
    var tf = rot ? 'translateX(' + w + 'px) rotate(90deg)' : 'none', cv = G.game && G.game.canvas;
    G.rot = rot;
    host.style.width = dom.style.width = gw + 'px'; host.style.height = dom.style.height = gh + 'px';
    dom.style.transform = tf;
    if (cv) { cv.style.transformOrigin = '0 0'; cv.style.transform = tf; }
    return { w: gw, h: gh };
  };
  var size0 = G.fitHost();
  // before Phaser's own listeners, so it measures the box already fitted
  window.addEventListener('resize', G.fitHost);
  window.addEventListener('orientationchange', G.fitHost);
  // where the browser allows it (installed app, fullscreen) the screen is locked to landscape and no turn is needed
  window.addEventListener('touchend', function lock() {
    window.removeEventListener('touchend', lock);
    try { var o = screen.orientation; if (o && o.lock) o.lock('landscape').catch(function () {}); } catch (e) { /* not supported */ }
  }, { passive: true });
  G.view = G.computeView(size0.w, size0.h, 0);
  // the first finger on the screen, seen before any button handles it: buttons built from then on get finger-sized hit boxes (UI.button)
  window.addEventListener('touchstart', function () { G.finger = true; }, { capture: true, passive: true });
  window.addEventListener('error', function (e) { G.qa.errors.push(String(e.message)); });
  var scenes = [G.BootScene, G.BackdropScene, G.TitleScene, G.CityScene, G.CityHudScene, G.GameScene, G.HudScene].filter(Boolean);
  G.game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'game',
    backgroundColor: G_ASSETS.palette.void,
    pixelArt: true, roundPixels: true,
    disableContextMenu: true,
    scale: { mode: Phaser.Scale.RESIZE, width: size0.w, height: size0.h },
    input: { activePointers: 3 },
    banner: false,
    scene: scenes
  });
  // a turned game: a point of the page (x right, y down) is the game point (y, page width - x); the game size is in CSS px
  var transformPointer = G.game.input.transformPointer;
  G.game.input.transformPointer = function (pointer, pageX, pageY, wasMove) {
    if (!G.rot) return transformPointer.call(this, pointer, pageX, pageY, wasMove);
    var p0 = pointer.position, p1 = pointer.prevPosition, x = pageY, y = window.innerWidth - pageX, a = pointer.smoothFactor;
    p1.x = p0.x; p1.y = p0.y;
    if (wasMove && a !== 0) { p0.x = x * a + p1.x * (1 - a); p0.y = y * a + p1.y * (1 - a); } else { p0.x = x; p0.y = y; }
  };
  G.game.events.once('ready', G.fitHost);      // the canvas exists now: give it the turn
  // recompute scale + viewport; scenes re-run their layout on 'viewchange'
  G.applyView = function () {
    G.fitHost();
    var sz = G.game.scale.gameSize;
    G.view = G.computeView(sz.width, sz.height, G.save ? G.save.settings.zoom : 0);
    G.qa.hits = {};
    // Phaser resizes each scene's cameras on this same 'resize' event, but after this handler (the scenes listen later): a scene
    // that centres its camera on 'viewchange' would centre it for the old window (the title's backdrop sat off to one side after
    // the window grew). So the full-window cameras get the new size first.
    G.game.scene.getScenes(true).forEach(function (sc) {
      sc.cameras.cameras.forEach(function (cam) { if (cam.x === 0 && cam.y === 0 && (cam.width !== sz.width || cam.height !== sz.height)) cam.setSize(sz.width, sz.height); });
    });
    G.game.events.emit('viewchange');
  };
  G.game.scale.on('resize', G.applyView);
})(globalThis.G = globalThis.G || {});
