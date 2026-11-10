// Input abstraction. The game only ever reads Controls.read(): keyboard and the touch
// controls (virtual stick + two buttons, drawn by the HUD) fill the same four fields.
(function (G) {
  function Controls(scene) {
    var kb = scene.input.keyboard, K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = kb.addKeys({ up: K.W, down: K.S, left: K.A, right: K.D, up2: K.UP, down2: K.DOWN, left2: K.LEFT, right2: K.RIGHT });
    this.virtual = { mx: 0, my: 0 };      // touch stick writes here
    this._dodge = false; this._pulse = false;
    var self = this;
    kb.on('keydown-SPACE', function () { self._dodge = true; });
    kb.on('keydown-SHIFT', function () { self._dodge = true; });
    kb.on('keydown-Q', function () { self._pulse = true; });
    kb.on('keydown-E', function () { self._pulse = true; });
    scene.input.on('pointerdown', function (p) { if (p.rightButtonDown()) self._pulse = true; });
  }
  Controls.prototype.dodge = function () { this._dodge = true; };
  Controls.prototype.pulse = function () { this._pulse = true; };
  Controls.prototype.read = function (out) {
    var k = this.keys, v = this.virtual;
    var mx = (k.right.isDown || k.right2.isDown ? 1 : 0) - (k.left.isDown || k.left2.isDown ? 1 : 0);
    var my = (k.down.isDown || k.down2.isDown ? 1 : 0) - (k.up.isDown || k.up2.isDown ? 1 : 0);
    if (!mx && !my) { mx = v.mx; my = v.my; }
    out.mx = mx; out.my = my; out.dodge = this._dodge; out.pulse = this._pulse;
    this._dodge = false; this._pulse = false;
    return out;
  };
  Controls.prototype.clear = function () { this._dodge = false; this._pulse = false; this.virtual.mx = 0; this.virtual.my = 0; };
  G.Controls = Controls;
})(globalThis.G = globalThis.G || {});
