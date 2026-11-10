// Boot: decode the embedded art (data URIs), register textures and fonts, then go to the title.
(function (G) {
  G.BootScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function BootScene() { Phaser.Scene.call(this, { key: 'boot' }); },
    create: function () {
      var self = this, A = G_ASSETS, left = 3, imgs = {};
      function done() {
        if (--left) return;
        self.textures.addAtlas('atlas', imgs.atlas, A.atlasJson);
        self.textures.addSpriteSheet('tiles', imgs.tiles, { frameWidth: 16, frameHeight: 16 });
        self.textures.addImage('font', imgs.font);
        G.UI.registerFonts(self);
        G.save = G.loadSave();
        G.params = new URLSearchParams(location.search);
        self.scene.start(G.params.get('scene') === 'game' ? 'game' : 'title');
      }
      ['atlas', 'tiles', 'font'].forEach(function (k) {
        var im = new Image();
        im.onload = done;
        im.onerror = function () { throw new Error('asset failed to decode: ' + k); };
        im.src = A[k];
        imgs[k] = im;
      });
    }
  });
})(globalThis.G = globalThis.G || {});
