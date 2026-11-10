// Entry point. Logical resolution 960x540, FIT scaling, landscape only.
(function (G) {
  var scenes = [G.BootScene, G.BackdropScene, G.TitleScene, G.GameScene, G.HudScene].filter(Boolean);
  G.game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'game',
    width: 960, height: 540,
    backgroundColor: G_ASSETS.palette.rift_void,
    pixelArt: true, roundPixels: true,
    disableContextMenu: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 3 },
    banner: false,
    scene: scenes
  });
})(globalThis.G = globalThis.G || {});
