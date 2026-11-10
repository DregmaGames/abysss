// Input abstraction. The game only ever reads Controls.read(); Phase 2 adds a touch
// source (virtual stick + two buttons) by filling the same fields, with no game changes.
(function (G) {
  function Controls(scene) {
    var kb = scene.input.keyboard, K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = kb.addKeys({ up: K.W, down: K.S, left: K.A, right: K.D, up2: K.UP, down2: K.DOWN, left2: K.LEFT, right2: K.RIGHT,
      dodge: K.SPACE, pulse: K.Q, pulse2: K.E });
    this.virtual = { mx: 0, my: 0, dodge: false, pulse: false };   // touch / bot write here
    this.useVirtual = false;
    this._dodge = false; this._pulse = false;
    var self = this;
    kb.on('keydown-SPACE', function () { self._dodge = true; });
    kb.on('keydown-Q', function () { self._pulse = true; });
    kb.on('keydown-E', function () { self._pulse = true; });
    scene.input.on('pointerdown', function (p) { if (p.rightButtonDown()) self._pulse = true; });
  }
  Controls.prototype.read = function (out) {
    if (this.useVirtual) {
      var v = this.virtual;
      out.mx = v.mx; out.my = v.my; out.dodge = v.dodge; out.pulse = v.pulse;
      v.dodge = false; v.pulse = false;
      return out;
    }
    var k = this.keys;
    var mx = (k.right.isDown || k.right2.isDown ? 1 : 0) - (k.left.isDown || k.left2.isDown ? 1 : 0);
    var my = (k.down.isDown || k.down2.isDown ? 1 : 0) - (k.up.isDown || k.up2.isDown ? 1 : 0);
    out.mx = mx; out.my = my; out.dodge = this._dodge; out.pulse = this._pulse;
    this._dodge = false; this._pulse = false;
    return out;
  };
  Controls.prototype.clear = function () { this._dodge = false; this._pulse = false; };
  G.Controls = Controls;
})(globalThis.G = globalThis.G || {});
