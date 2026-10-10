/* CubeRing: the cube as a "ring diagram" (turn topology), kept in sync with CubeView.
 *
 * Every sticker is a dot. Its 3D position on the cube is pushed out onto a sphere and
 * projected flat (Lambert azimuthal, looking straight at the URF corner, so the picture has
 * three-fold symmetry). For every face we also draw its "belt": the closed loop through the
 * 12 side stickers that a turn of that face carries around. So:
 *   - a turn of a face = the dots on its belt slide one quarter along it
 *     (plus the 8 dots of the face itself spin around its centre);
 *   - a corner sticker sits where two belts cross (2 belts + its own face can move it);
 *   - an edge sticker sits on exactly one belt;
 *   - a centre sits on no belt at all: no turn ever moves it.
 *
 * Same API as CubeNet: update / getState / highlight / clearHighlight / setFacing / setTurning(move, ms).
 */
(function (root) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var FACE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B'];
  var N = { U: [0, 1, 0], D: [0, -1, 0], R: [1, 0, 0], L: [-1, 0, 0], F: [0, 0, 1], B: [0, 0, -1] };
  var COLORS = { W: '#F2F2F2', Y: '#FFD500', G: '#009B48', B: '#0046AD', O: '#FF5800', R: '#B71234' };
  var COLOR_NAME = { W: '白', Y: '黄', G: '绿', B: '蓝', O: '橙', R: '红' };
  var MOVE_FACE = { U: 'U', D: 'D', F: 'F', B: 'B', R: 'R', L: 'L', x: 'R', y: 'U', z: 'F' };

  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function scale(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function unit(a) { var l = Math.sqrt(dot(a, a)); return scale(a, 1 / l); }
  // rotate v about unit axis a by angle t (right-handed)
  function rot(v, a, t) {
    var c = Math.cos(t), s = Math.sin(t), d = dot(a, v), x = cross(a, v);
    return [v[0] * c + x[0] * s + a[0] * d * (1 - c), v[1] * c + x[1] * s + a[1] * d * (1 - c), v[2] * c + x[2] * s + a[2] * d * (1 - c)];
  }

  // sticker centres on a 3x3x3 cube with faces at +-1.5 (Kociemba facelet order)
  function stickerPos() {
    var M = root.CubeModel;
    if (M && M.GEOMETRY) return M.GEOMETRY.map(function (g) { return toSphere([g.p[0] + g.n[0] * 0.5, g.p[1] + g.n[1] * 0.5, g.p[2] + g.n[2] * 0.5]); });
    throw new Error('CubeRing 需要 CubeModel.GEOMETRY');
  }

  // ---- projection ------------------------------------------------------------------
  var W_DIR = unit([1, 1, 1]);                         // look at the URF corner
  var E1 = unit(cross([0, 1, 0], W_DIR));              // screen right
  var E2 = cross(W_DIR, E1);                           // screen up
  // Put every sticker on the unit sphere so that the 12 stickers of each belt lie on the
  // circle v.n = C, exactly 30 degrees apart (C = 1/sqrt(5)). The embedding commutes with
  // cube rotations, so a quarter turn is a rigid rotation of the sphere and every dot glides
  // along its belt circle onto the next sticker position.
  var C = 1 / Math.sqrt(5);
  function faceOf(p) { return Math.abs(p[0]) > 1.4 ? [Math.sign(p[0]), 0, 0] : Math.abs(p[1]) > 1.4 ? [0, Math.sign(p[1]), 0] : [0, 0, Math.sign(p[2])]; }
  function toSphere(p) {
    if (Math.abs(Math.sqrt(dot(p, p)) - 1) < 1e-9) return p;          // already on the sphere
    var n = faceOf(p), o = sub(p, scale(n, 1.5));
    var k = Math.sqrt(Math.max(0, 1 - C * C * dot(o, o)));
    return [o[0] * C + n[0] * k, o[1] * C + n[1] * k, o[2] * C + n[2] * k];
  }
  function project(p) {
    var v = toSphere(p), s = dot(v, W_DIR);
    var tx = dot(v, E1), ty = dot(v, E2), tl = Math.sqrt(tx * tx + ty * ty) || 1e-9;
    var theta = Math.acos(Math.max(-1, Math.min(1, s)));
    var r = 2 * Math.sin(theta / 2);                    // Lambert azimuthal equal-area, r in [0, 2]
    return [r * tx / tl, -r * ty / tl];
  }

  // belt of face f: the circle v.n = C on the sphere
  function beltPoints(f, steps) {
    var n = N[f], a = Math.abs(n[0]) ? [0, 1, 0] : [1, 0, 0], b = cross(n, a), r = Math.sqrt(1 - C * C), pts = [];
    for (var i = 0; i < steps; i++) {
      var t = i / steps * 2 * Math.PI, ct = Math.cos(t) * r, sn = Math.sin(t) * r;
      pts.push(project([n[0] * C + a[0] * ct + b[0] * sn, n[1] * C + a[1] * ct + b[1] * sn, n[2] * C + a[2] * ct + b[2] * sn]));
    }
    return pts;
  }

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var a in attrs) e.setAttribute(a, attrs[a]);
    if (parent) parent.appendChild(e);
    return e;
  }

  var POS = null, XY = null, SIGN = 1;
  function setup() {
    if (POS) return;
    POS = stickerPos();
    XY = POS.map(project);
    // find the rotation sense that matches CubeModel's U permutation (new[i] = old[P[i]])
    var P = root.CubeModel && root.CubeModel.PERM && root.CubeModel.PERM.U;
    if (P) {
      var test = function (sg) {
        for (var i = 0; i < 54; i++) {
          if (dot(POS[i], N.U) < C / 2) continue;              // only the turning layer moves
          var q = rot(POS[P[i]], N.U, sg * Math.PI / 2);
          if (Math.abs(q[0] - POS[i][0]) + Math.abs(q[1] - POS[i][1]) + Math.abs(q[2] - POS[i][2]) > 1e-6) return false;
        }
        return true;
      };
      SIGN = test(-1) ? -1 : test(1) ? 1 : 0;
      if (!SIGN) { SIGN = -1; if (root.console) console.warn('CubeRing: 转动方向校验失败'); }
      CubeRing.SIGN = SIGN;
    }
  }

  function CubeRing(container, opts) {
    opts = opts || {};
    setup();
    var self = this;
    this.onPick = opts.onPick || null;
    this.state = null;
    this._lit = null;
    this._anim = null;

    var S = 100;                                       // px per projected unit
    this.S = S;
    var R = 2 * S + 14;
    var svg = this.svg = el('svg', { viewBox: (-R) + ' ' + (-R) + ' ' + (2 * R) + ' ' + (2 * R), class: 'ring-svg', role: 'img',
      'aria-label': '魔方环形拓扑图：每个面的转动是一圈点沿着一条环滑动；角块贴纸在两条环的交点上，棱块贴纸只在一条环上，中心不在任何环上' });
    this.beltPath = {};
    var gb = el('g', { class: 'ring-belts' }, svg);
    FACE_ORDER.forEach(function (f) {
      var d = beltPoints(f, 160).map(function (p, i) { return (i ? 'L' : 'M') + (p[0] * S).toFixed(1) + ' ' + (p[1] * S).toFixed(1); }).join('') + 'Z';
      self.beltPath[f] = el('path', { d: d, class: 'ring-belt', 'data-face': f }, gb);
    });
    var gd = el('g', { class: 'ring-dots' }, svg);
    this.dots = [];
    this.labels = {};
    for (var k = 0; k < 54; k++) {
      var c = k % 9 === 4;
      var d = el('circle', { cx: (XY[k][0] * S).toFixed(1), cy: (XY[k][1] * S).toFixed(1), r: c ? 11.5 : 8.6,
        class: 'ring-dot' + (c ? ' is-center' : ''), 'data-i': k }, gd);
      this.dots.push(d);
      if (c) {
        var f = FACE_ORDER[(k - 4) / 9];
        var t = el('text', { x: (XY[k][0] * S).toFixed(1), y: (XY[k][1] * S + 0.5).toFixed(1), class: 'ring-letter',
          'text-anchor': 'middle', 'dominant-baseline': 'central', 'data-i': k }, gd);
        t.textContent = f;
        this.labels[f] = t;
      }
    }
    container.appendChild(svg);

    this._onClick = function (e) {
      var t = e.target, k = t && t.getAttribute && t.getAttribute('data-i');
      if (k == null || !self.onPick) return;
      var slot = root.CubeNet ? root.CubeNet.SLOT_OF[+k] : null;
      var f0 = FACE_ORDER[Math.floor(+k / 9)];
      self.onPick(slot ? f0 + slot.replace(f0, '') : f0, +k);
    };
    svg.addEventListener('click', this._onClick);
    this.update(opts.state || 'YYYYYYYYYOOOOOOOOOGGGGGGGGGWWWWWWWWWRRRRRRRRRBBBBBBBBB');
  }

  var P = CubeRing.prototype;

  P._place = function (k, xy) {
    var d = this.dots[k];
    d.setAttribute('cx', (xy[0] * this.S).toFixed(1)); d.setAttribute('cy', (xy[1] * this.S).toFixed(1));
    if (k % 9 === 4) {
      var t = this.labels[FACE_ORDER[(k - 4) / 9]];
      t.setAttribute('x', (xy[0] * this.S).toFixed(1)); t.setAttribute('y', (xy[1] * this.S + 0.5).toFixed(1));
    }
  };

  P.update = function (state) {
    if (!state || state.length !== 54) return;
    this._stopAnim();
    this.state = state;
    for (var k = 0; k < 54; k++) {
      this._place(k, XY[k]);
      this.dots[k].setAttribute('fill', COLORS[state[k]] || '#777');
      this.dots[k].setAttribute('data-c', state[k]);
    }
    var self = this;
    FACE_ORDER.forEach(function (f, fi) {
      var c = state[fi * 9 + 4];
      self.labels[f].setAttribute('class', 'ring-letter' + (c === 'W' || c === 'Y' ? ' on-light' : ''));
      self.beltPath[f].setAttribute('data-name', f + ' · ' + (COLOR_NAME[c] || ''));
    });
    this._paint();
  };

  P.getState = function () { return this.dots.map(function (d) { return d.getAttribute('data-c'); }).join(''); };

  P.highlight = function (selectors, state) {
    this._lit = root.CubeNet ? root.CubeNet.resolve(selectors, state || this.state) : null;
    this._paint();
  };
  P.clearHighlight = function () { this._lit = null; this._paint(); };

  P.setFacing = function (facing) {
    var self = this;
    FACE_ORDER.forEach(function (f, fi) {
      self.dots[fi * 9 + 4].classList.toggle('is-visible', !!(facing && facing[f] > 0.12));
    });
  };

  // animate the dots of the turning layer sliding along their belt
  P.setTurning = function (move, ms) {
    this._stopAnim();
    var self = this;
    FACE_ORDER.forEach(function (f) { self.beltPath[f].classList.remove('is-turning'); });
    var m = /^([UDFBRLxyz])(2|'|)$/.exec(move || '');
    if (!m) return;
    var f = MOVE_FACE[m[1]], whole = 'xyz'.indexOf(m[1]) >= 0, n = N[f];
    var q = m[2] === '2' ? 2 : m[2] === "'" ? -1 : 1;
    if (!whole) this.beltPath[f].classList.add('is-turning');
    var ks = [];
    for (var k = 0; k < 54; k++) if (whole || dot(POS[k], n) > C / 2) ks.push(k);
    var angle = SIGN * q * Math.PI / 2;
    if (!ms || ms <= 0 || !root.requestAnimationFrame) return;
    var start = null;
    var ease = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
    var tick = function (now) {
      if (self._anim !== anim) return;
      if (start == null) start = now;
      var p = Math.min(1, (now - start) / ms), a = angle * ease(p);
      ks.forEach(function (k) { self._place(k, project(rot(POS[k], n, a))); });
      if (p < 1) anim.raf = root.requestAnimationFrame(tick);
    };
    var anim = this._anim = { raf: root.requestAnimationFrame(tick) };
  };
  P._stopAnim = function () {
    if (this._anim && this._anim.raf && root.cancelAnimationFrame) root.cancelAnimationFrame(this._anim.raf);
    this._anim = null;
    var self = this;
    if (this.beltPath) FACE_ORDER.forEach(function (f) { self.beltPath[f].classList.remove('is-turning'); });
  };

  P._paint = function () {
    var lit = this._lit, st = this.state, key = root.CubeNet && root.CubeNet.stickerKey;
    for (var k = 0; k < 54; k++) {
      var on = !!lit && !!key && lit.has(key(st, k));
      this.dots[k].classList.toggle('is-dim', !!lit && !on);
      this.dots[k].classList.toggle('is-lit', on);
    }
  };

  P.destroy = function () {
    this._stopAnim();
    this.svg.removeEventListener('click', this._onClick);
    if (this.svg.parentNode) this.svg.parentNode.removeChild(this.svg);
  };

  CubeRing.project = project;
  if (typeof module !== 'undefined' && module.exports) module.exports = CubeRing; else root.CubeRing = CubeRing;
})(typeof window !== 'undefined' ? window : this);
