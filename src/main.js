// Entry point. The canvas fills the window (RESIZE); G.view holds the integer pixel scale S
// and the art-pixel viewport. 960x540 -> 480x270 @2x; 540x960 -> 270x480 @2x.
(function (G) {
  G.params = new URLSearchParams(location.search);
  G.view = G.computeView(window.innerWidth, window.innerHeight, 0);
  window.addEventListener('error', function (e) { G.qa.errors.push(String(e.message)); });
  var scenes = [G.BootScene, G.BackdropScene, G.TitleScene, G.CityScene, G.CityHudScene, G.GameScene, G.HudScene].filter(Boolean);
  G.game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'game',
    backgroundColor: G_ASSETS.palette.void,
    pixelArt: true, roundPixels: true,
    disableContextMenu: true,
    scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
    input: { activePointers: 3 },
    banner: false,
    scene: scenes
  });
  // recompute scale + viewport; scenes re-run their layout on 'viewchange'
  G.applyView = function () {
    var sz = G.game.scale.gameSize;
    G.view = G.computeView(sz.width, sz.height, G.save ? G.save.settings.zoom : 0);
    G.qa.hits = {};
    G.game.events.emit('viewchange');
  };
  G.game.scale.on('resize', G.applyView);
})(globalThis.G = globalThis.G || {});
