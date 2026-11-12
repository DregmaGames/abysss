// Boot: decode the embedded art (data URIs), register textures and fonts, then go to the title.
(function (G) {
  G.BootScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function BootScene() { Phaser.Scene.call(this, { key: 'boot' }); },
    create: function () {
      var self = this, A = G_ASSETS, keys = ['atlas', 'tiles', 'font'].concat(A.hd_atlas ? ['hd_atlas'] : [], A.hd_floor ? ['hd_floor'] : []), left = keys.length, imgs = {};
      function done() {
        if (--left) return;
        self.textures.addAtlas('atlas', imgs.atlas, A.atlasJson);
        self.textures.addSpriteSheet('tiles', imgs.tiles, { frameWidth: 16, frameHeight: 16 });
        self.textures.addImage('font', imgs.font);
        // HD art pilot (src/view/hd.js): the double-density atlas and the dungeon floor tile, when built
        if (imgs.hd_atlas) self.textures.addAtlas('hd', imgs.hd_atlas, A.hd_atlasJson);
        if (imgs.hd_floor) self.textures.addImage('hd_floor', imgs.hd_floor);
        G.UI.registerFonts(self);
        G.save = G.loadSave();
        if (G.params.get('fresh') === '1') G.save = G.newSave();
        if (G.params.has('zoom')) G.save.settings.zoom = parseInt(G.params.get('zoom'), 10) || 0;
        G.setLang(G.detectLang(G.save.settings.lang, G.params.get('lang')));      // ?lang=en|es (QA) > saved choice > browser language
        // QA: ?fresh=1 is a save that has done the tutorial (so the other scripts see the game they always saw); ?tutorial=1 brings it back (pending, pop-ups on)
        if (G.params.get('fresh') === '1') G.save.hints.tut = G.newTut(true);
        if (G.params.get('tutorial') === '1') { G.save.hints.tut = G.newTut(false); G.save.hints.off = false; G.tutorial = G.params.get('scene') === 'game'; }
        G.HD.init();                                       // ?hd=0|1 > saved setting > on
        G.touch = G.params.get('touch') === '1';
        G.testRoom = G.params.get('room') === 'test';     // ?scene=game&room=test, or the TEST ROOM button
        G.applyView();
        var sc = G.params.get('scene');
        self.scene.start(sc === 'game' ? 'game' : sc === 'city' ? 'city' : 'title');
      }
      keys.forEach(function (k) {
        var im = new Image();
        im.onload = done;
        im.onerror = function () { throw new Error('asset failed to decode: ' + k); };
        im.src = A[k];
        imgs[k] = im;
      });
    }
  });
})(globalThis.G = globalThis.G || {});
