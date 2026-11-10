// Boss: the Rift Tyrant. Chases, then cycles four telegraphed attacks; faster when enraged.
(function (G) {
  var S = G.Sim.prototype;
  var CYCLE = ['slam', 'burst', 'charge', 'summon'];

  S.bossAI = function (m, dt, d, dx, dy) {
    var D = m.def, enr = m.hp < m.maxHp * D.enrageAt, rate = enr ? D.enrageRate : 1, p = this.player, i, a;
    if (enr && !m.enraged) { m.enraged = true; this.emit({ t: 'enrage', id: m.id, x: m.x, y: m.y }); }
    m.t -= dt;
    switch (m.st) {
      case 'chase':
        this.move(m, dx / d * D.speed * (enr ? 1.25 : 1) * dt, dy / d * D.speed * (enr ? 1.25 : 1) * dt);
        if (m.t <= 0) {
          m.st = CYCLE[m.atk % CYCLE.length]; m.atk++;
          if (m.st === 'slam') {
            m.t = D.slamWindup * rate;
            this.teles.push({ id: this.nextId++, x: m.x, y: m.y, r: D.slamRadius, t: 0, dur: m.t, dmg: D.slamDmg * m.mul });
            this.emit({ t: 'windup', id: m.id, dur: m.t });
          } else if (m.st === 'burst') {
            m.t = D.burstGap * 2 * rate; m.vol = 0;
          } else if (m.st === 'charge') {
            m.t = D.chargeWindup * rate; m.lx = dx / d; m.ly = dy / d; m.st = 'chargeWind';
            this.emit({ t: 'windup', id: m.id, dur: m.t });
          } else {
            m.t = 0.7;
            var n = D.summon + (enr ? 1 : 0);
            for (i = 0; i < n; i++) {
              a = i / n * 6.283 + 0.6;
              this.spawnMonster(enr && i === 0 ? 'gazer' : 'riftling', m.x + Math.cos(a) * 22, m.y + Math.sin(a) * 22, m.fid);
            }
            this.emit({ t: 'summon', x: m.x, y: m.y });
          }
        }
        break;
      case 'burst':
        var due = m.vol === 0 || (m.vol === 1 && m.t <= D.burstGap * rate);
        if (due && m.vol < 2) {
          var shots = D.burstShots + (enr ? 4 : 0), off = m.vol * Math.PI / shots + Math.atan2(dy, dx);
          for (i = 0; i < shots; i++) this.fireShot(m, off + i / shots * 6.283, D.burstSpeed, D.burstDmg * m.mul, true);
          m.vol++;
          this.emit({ t: 'shoot', id: m.id, x: m.x, y: m.y });
        }
        if (m.t <= 0) { m.st = 'chase'; m.t = D.chaseTime * rate; }
        break;
      case 'chargeWind':
        if (m.t <= 0) { m.st = 'charge'; m.t = D.chargeTime; }
        break;
      case 'charge':
        this.move(m, m.lx * D.chargeSpeed * dt, m.ly * D.chargeSpeed * dt);
        if (m.t <= 0) { m.st = 'chase'; m.t = D.chaseTime * rate; }
        break;
      default:   // slam, summon: stand still until the timer runs out
        if (m.t <= 0) { m.st = 'chase'; m.t = D.chaseTime * rate; }
    }
  };
})(globalThis.G = globalThis.G || {});
