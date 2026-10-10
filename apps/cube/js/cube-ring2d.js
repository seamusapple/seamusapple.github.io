/* CubeRing2D: a flat, readable "ring diagram" of the cube, kept in sync with CubeView.
 *
 * Construction (pure plane geometry, no projection):
 *   - Three ring pairs ("annuli"), one per axis:  A = U/D belts,  B = L/R belts,  C = F/B belts.
 *     Each annulus is three concentric circles: radius R+d and R-d are the two belts of that axis,
 *     radius R is the middle slice (drawn faint).
 *   - The three centres sit on an equilateral triangle of side R*sqrt(2), so every two annuli cross
 *     at exactly 90 degrees, twice: once near the middle, once outside.
 *   - Each face sits at one of those six crossings, as a 3x3 cluster whose rows follow one annulus and
 *     columns follow the other:  inner U F R (the corner you look at), outer L B D.
 *   - Every sticker is placed exactly on the intersection of its row circle and its column circle, so
 *     a face turn = the 12 dots on that face's belt slide along one circle (the 8 dots of the face itself
 *     spin around the cluster centre). Corners sit where two belts cross; edges on one belt; centres on none.
 *
 * Sign / mirror choices are picked at start-up by checking against CubeModel.PERM, so the picture is
 * guaranteed to move the same way the real cube does.
 *
 * API identical to CubeNet / CubeRing: update / getState / highlight / clearHighlight / setFacing / setTurning(move, ms)
 */
(function (root) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var FACE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B'];
  var OPP = { U: 'D', D: 'U', L: 'R', R: 'L', F: 'B', B: 'F' };
  var AXIS = { U: 'A', D: 'A', L: 'B', R: 'B', F: 'C', B: 'C' };
  var EDGE_NB = { U: ['B', 'F', 'L', 'R'], R: ['U', 'D', 'F', 'B'], F: ['U', 'D', 'L', 'R'],
                  D: ['F', 'B', 'L', 'R'], L: ['U', 'D', 'B', 'F'], B: ['U', 'D', 'R', 'L'] };
  var COLORS = { W: '#F2F2F2', Y: '#FFD500', G: '#009B48', B: '#0046AD', O: '#FF5800', R: '#B71234' };
  var COLOR_NAME = { W: '白', Y: '黄', G: '绿', B: '蓝', O: '橙', R: '红' };
  var MOVE_FACE = { U: 'U', D: 'D', F: 'F', B: 'B', R: 'R', L: 'L', x: 'R', y: 'U', z: 'F' };
  var TAU = Math.PI * 2;

  var Rr = 100, D = 14;                         // ring radius, belt offset (= sticker spacing)

  function circleX(c1, r1, c2, r2, near) {
    var dx = c2[0] - c1[0], dy = c2[1] - c1[1], d = Math.sqrt(dx * dx + dy * dy);
    var a = (r1 * r1 - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
    var mx = c1[0] + a * dx / d, my = c1[1] + a * dy / d;
    var p1 = [mx + h * dy / d, my - h * dx / d], p2 = [mx - h * dy / d, my + h * dx / d];
    var d1 = (p1[0] - near[0]) * (p1[0] - near[0]) + (p1[1] - near[1]) * (p1[1] - near[1]);
    var d2 = (p2[0] - near[0]) * (p2[0] - near[0]) + (p2[1] - near[1]) * (p2[1] - near[1]);
    return d1 <= d2 ? p1 : p2;
  }
  function ang(c, p) { return Math.atan2(p[1] - c[1], p[0] - c[0]); }
  function mod(a) { a %= TAU; return a < 0 ? a + TAU : a; }

  // Build one candidate layout. mirror flips the triangle; s = radius sign of U, L, F belts.
  function build(mirror, sU, sL, sF) {
    var side = Rr * Math.SQRT2, h = side * Math.sqrt(3) / 2;
    var cen = { A: [0, -h * 2 / 3], B: [side / 2, h / 3], C: [-side / 2, h / 3] };
    if (mirror) { var t = cen.B; cen.B = cen.C; cen.C = t; }
    var sgn = { U: sU, D: -sU, L: sL, R: -sL, F: sF, B: -sF };
    var g = [0, 0];
    // inner crossing of two annuli = the one nearer the triangle centre
    function cross(p, q, inner) {
      var a = circleX(cen[p], Rr, cen[q], Rr, g), b = circleX(cen[p], Rr, cen[q], Rr, [-a[0] * 9, -a[1] * 9]);
      if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) < 1e-6) b = circleX(cen[p], Rr, cen[q], Rr, [a[0] * -50 + 1, a[1] * -50 + 1]);
      var na = a[0] * a[0] + a[1] * a[1], nb = b[0] * b[0] + b[1] * b[1];
      return inner ? (na < nb ? a : b) : (na < nb ? b : a);
    }
    var base = { U: cross('B', 'C', true), F: cross('A', 'B', true), R: cross('A', 'C', true),
                 D: cross('B', 'C', false), B: cross('A', 'B', false), L: cross('A', 'C', false) };
    var pos = [], circ = [];                    // circ[k] = {row:{ax, r}, col:{ax, r}}
    FACE_ORDER.forEach(function (f, fi) {
      var nb = EDGE_NB[f];
      for (var i = 0; i < 9; i++) {
        var r = Math.floor(i / 3), c = i % 3;
        var rowAx = AXIS[nb[0]], colAx = AXIS[nb[2]];
        var rr = Rr + (r === 0 ? D * sgn[nb[0]] : r === 2 ? D * sgn[nb[1]] : 0);
        var cr = Rr + (c === 0 ? D * sgn[nb[2]] : c === 2 ? D * sgn[nb[3]] : 0);
        pos[fi * 9 + i] = circleX(cen[rowAx], rr, cen[colAx], cr, base[f]);
        circ[fi * 9 + i] = { row: { ax: rowAx, r: rr }, col: { ax: colAx, r: cr } };
      }
    });
    return { cen: cen, sgn: sgn, base: base, pos: pos, circ: circ };
  }

  // circle of axis ax that sticker k lies on (or null)
  function onAxis(L, k, ax) {
    var c = L.circ[k];
    return c.row.ax === ax ? c.row.r : c.col.ax === ax ? c.col.r : null;
  }

  // check a layout against the real cube: every quarter turn must slide belt dots along one circle
  // preserving their cyclic order, and spin every face cluster the same way (no mirrored faces).
  function validate(L, PERM) {
    var faceSign = null;
    for (var fi = 0; fi < 6; fi++) {
      var X = FACE_ORDER[fi], P = PERM[X], ax = AXIS[X], c = L.cen[ax];
      var belt = [], spin = [];
      for (var i = 0; i < 54; i++) {
        if (P[i] === i) continue;
        var from = P[i], to = i;
        if (Math.floor(from / 9) === fi) {        // the face itself
          if (from % 9 === 4) return false;
          var bc = L.base[X], d = mod(ang(bc, L.pos[to]) - ang(bc, L.pos[from]));
          spin.push(d < Math.PI ? 1 : -1);
          continue;
        }
        var r1 = onAxis(L, from, ax), r2 = onAxis(L, to, ax);
        if (r1 == null || r2 == null || Math.abs(r1 - r2) > 1e-6) return false;
        belt.push([ang(c, L.pos[from]), ang(c, L.pos[to])]);
      }
      if (belt.length !== 12 || spin.length !== 8) return false;
      // cyclic order preserved: sort by start angle, the end angles must be a rotation of that order
      belt.sort(function (a, b) { return mod(a[0]) - mod(b[0]); });
      var ends = belt.map(function (b) { return mod(b[1]); });
      var k0 = ends.indexOf(Math.min.apply(null, ends));
      for (var j = 1; j < 12; j++) if (ends[(k0 + j) % 12] < ends[(k0 + j - 1) % 12]) return false;
      var s0 = spin[0];
      if (!spin.every(function (s) { return s === s0; })) return false;
      if (faceSign == null) faceSign = s0; else if (faceSign !== s0) return false;
    }
    return true;
  }

  var LAYOUT = null;
  function setup() {
    if (LAYOUT) return LAYOUT;
    var PERM = root.CubeModel && root.CubeModel.PERM;
    var pick = null;
    for (var m = 0; m < 2 && !pick; m++)
      for (var a = 0; a < 8 && !pick; a++) {
        var L = build(m, a & 1 ? 1 : -1, a & 2 ? 1 : -1, a & 4 ? 1 : -1);
        if (!PERM || validate(L, PERM)) pick = L;
      }
    if (!pick) { pick = build(0, 1, 1, 1); if (root.console) console.warn('CubeRing2D: 没有找到与模型一致的布局'); }
    // direction each axis' rings turn under the clockwise quarter turn of its "positive" face
    pick.dir = {};
    if (PERM) FACE_ORDER.forEach(function (X) {
      var P = PERM[X], ax = AXIS[X], c = pick.cen[ax], fi = FACE_ORDER.indexOf(X), faces = {};
      // centre angles of the 4 ring faces on this annulus
      FACE_ORDER.forEach(function (f) { if (f !== X && f !== OPP[X]) faces[f] = ang(c, pick.base[f]); });
      for (var i = 0; i < 54; i++) {
        if (P[i] === i || Math.floor(P[i] / 9) === fi) continue;
        var a1 = ang(c, pick.pos[P[i]]), a2 = ang(c, pick.pos[i]), fwd = mod(a2 - a1), ok = true;
        // forward arc is right iff it doesn't pass over another ring face
        Object.keys(faces).forEach(function (f) {
          var t = mod(faces[f] - a1);
          if (t > 0.35 && t < fwd - 0.35) ok = false;
        });
        pick.dir[X] = ok ? 1 : -1;
        break;
      }
      var bc = pick.base[X], j = fi * 9;
      pick.spin = pick.spin || {};
      pick.spin[X] = mod(ang(bc, pick.pos[j]) - ang(bc, pick.pos[P[j]])) < Math.PI ? 1 : -1;   // sticker P[j] moves to j
    });
    pick.ok = !!PERM && validate(pick, PERM);
    LAYOUT = pick;
    return pick;
  }

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var a in attrs) e.setAttribute(a, attrs[a]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function f1(v) { return v.toFixed(1); }

  function CubeRing2D(container, opts) {
    opts = opts || {};
    var L = this.L = setup(), self = this;
    this.onPick = opts.onPick || null;
    this.state = null;
    this._lit = null;
    this._anim = null;

    // bounds
    var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    ['A', 'B', 'C'].forEach(function (ax) {
      var c = L.cen[ax], r = Rr + D + 6;
      minX = Math.min(minX, c[0] - r); maxX = Math.max(maxX, c[0] + r);
      minY = Math.min(minY, c[1] - r); maxY = Math.max(maxY, c[1] + r);
    });
    var svg = this.svg = el('svg', { viewBox: [f1(minX), f1(minY), f1(maxX - minX), f1(maxY - minY)].join(' '), class: 'ring2d-svg', role: 'img',
      'aria-label': '魔方平面环形图：三组同心圆两两垂直相交，6 个交叉处各是一个面的 3×3 贴纸；转一个面就是一圈点沿那条圆滑动' });

    // rings: 3 annuli x 3 circles; belts are the outer two
    var gr = el('g', { class: 'r2-rings' }, svg);
    this.belt = {};
    ['A', 'B', 'C'].forEach(function (ax) {
      var c = L.cen[ax];
      el('circle', { cx: f1(c[0]), cy: f1(c[1]), r: Rr, class: 'r2-mid' }, gr);
    });
    FACE_ORDER.forEach(function (f) {
      var c = L.cen[AXIS[f]];
      self.belt[f] = el('circle', { cx: f1(c[0]), cy: f1(c[1]), r: Rr + D * L.sgn[f], class: 'r2-belt', 'data-face': f }, gr);
    });

    // face plates + labels
    var gp = el('g', { class: 'r2-plates' }, svg);
    this.plate = {};
    var gl = el('g', { class: 'r2-labels' }, svg);
    FACE_ORDER.forEach(function (f, fi) {
      var b = L.base[f];
      self.plate[f] = el('circle', { cx: f1(b[0]), cy: f1(b[1]), r: D * 1.85, class: 'r2-plate' }, gp);
      // label outside the cluster, away from the drawing centre
      var n = Math.sqrt(b[0] * b[0] + b[1] * b[1]) || 1, lx = b[0] + b[0] / n * D * 2.75, ly = b[1] + b[1] / n * D * 2.75;
      var t = el('text', { x: f1(lx), y: f1(ly), class: 'r2-label', 'text-anchor': 'middle', 'dominant-baseline': 'central' }, gl);
      t.textContent = f;
      self.plate[f].label = t;
    });

    var gd = el('g', { class: 'r2-dots' }, svg);
    this.dots = [];
    for (var k = 0; k < 54; k++) {
      var p = L.pos[k];
      this.dots.push(el('circle', { cx: f1(p[0]), cy: f1(p[1]), r: k % 9 === 4 ? 6.6 : 6.0,
        class: 'r2-dot' + (k % 9 === 4 ? ' is-center' : ''), 'data-i': k }, gd));
    }
    this.moveTag = el('text', { x: f1(maxX - 8), y: f1(minY + 16), class: 'r2-move', 'text-anchor': 'end' }, svg);
    container.appendChild(svg);

    this._onClick = function (e) {
      var t = e.target, k = t && t.getAttribute && t.getAttribute('data-i');
      if (k == null || !self.onPick) return;
      var slot = root.CubeNet ? root.CubeNet.SLOT_OF[+k] : null, f0 = FACE_ORDER[Math.floor(+k / 9)];
      self.onPick(slot ? f0 + slot.replace(f0, '') : f0, +k);
    };
    svg.addEventListener('click', this._onClick);
    this.update(opts.state || 'YYYYYYYYYOOOOOOOOOGGGGGGGGGWWWWWWWWWRRRRRRRRRBBBBBBBBB');
  }

  var P = CubeRing2D.prototype;

  P._place = function (k, p) { var d = this.dots[k]; d.setAttribute('cx', f1(p[0])); d.setAttribute('cy', f1(p[1])); };

  P.update = function (state) {
    if (!state || state.length !== 54) return;
    this._stopAnim();
    this.state = state;
    for (var k = 0; k < 54; k++) {
      this._place(k, this.L.pos[k]);
      this.dots[k].setAttribute('fill', COLORS[state[k]] || '#777');
      this.dots[k].setAttribute('data-c', state[k]);
    }
    var self = this;
    FACE_ORDER.forEach(function (f, fi) {
      var c = state[fi * 9 + 4];
      self.plate[f].label.textContent = f + ' ' + (COLOR_NAME[c] || '');
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
    FACE_ORDER.forEach(function (f) { self.plate[f].classList.toggle('is-visible', !!(facing && facing[f] > 0.12)); });
  };

  // Animate: belt / slice dots glide along their circle, face dots spin around the cluster centre.
  P.setTurning = function (move, ms) {
    this._stopAnim();
    var m = /^([UDFBRLxyz])(2|'|)$/.exec(move || ''), self = this, L = this.L;
    this.moveTag.textContent = m ? move : '';
    if (!m) return;
    var X = MOVE_FACE[m[1]], whole = 'xyz'.indexOf(m[1]) >= 0, ax = AXIS[X], Y = OPP[X];
    var q = m[2] === '2' ? 2 : m[2] === "'" ? -1 : 1;
    this.belt[X].classList.add('is-turning');
    if (whole) this.belt[Y].classList.add('is-turning');
    var PERM = root.CubeModel && root.CubeModel.PERM, Pm = PERM && PERM[move];
    if (!Pm || !ms || ms <= 0 || !root.requestAnimationFrame) return;
    var c = L.cen[ax], xi = FACE_ORDER.indexOf(X), yi = FACE_ORDER.indexOf(Y), tracks = [];
    for (var i = 0; i < 54; i++) {
      var from = Pm[i]; if (from === i) continue;
      var ff = Math.floor(from / 9), a, pc, sign;
      if (ff === xi || ff === yi) {                 // a face spinning around its own centre
        pc = L.base[FACE_ORDER[ff]];
        sign = (ff === xi ? L.spin[X] : -L.spin[Y]) * (q < 0 ? -1 : 1);
      } else { pc = c; sign = L.dir[X] * (q < 0 ? -1 : 1); }
      var p0 = L.pos[from], p1 = L.pos[i];
      var a0 = ang(pc, p0), r0 = Math.hypot(p0[0] - pc[0], p0[1] - pc[1]), r1 = Math.hypot(p1[0] - pc[0], p1[1] - pc[1]);
      var da = mod(ang(pc, p1) - a0); if (sign < 0) da -= TAU;
      tracks.push({ k: from, c: pc, a0: a0, da: da, r0: r0, r1: r1 });
    }
    var start = null;
    var ease = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
    var anim = this._anim = {};
    var tick = function (now) {
      if (self._anim !== anim) return;
      if (start == null) start = now;
      var p = Math.min(1, (now - start) / ms), e = ease(p);
      tracks.forEach(function (t) {
        var a = t.a0 + t.da * e, r = t.r0 + (t.r1 - t.r0) * e;
        self._place(t.k, [t.c[0] + r * Math.cos(a), t.c[1] + r * Math.sin(a)]);
      });
      if (p < 1) anim.raf = root.requestAnimationFrame(tick);
    };
    anim.raf = root.requestAnimationFrame(tick);
  };
  P._stopAnim = function () {
    if (this._anim && this._anim.raf && root.cancelAnimationFrame) root.cancelAnimationFrame(this._anim.raf);
    this._anim = null;
    var self = this;
    if (this.belt) FACE_ORDER.forEach(function (f) { self.belt[f].classList.remove('is-turning'); });
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

  CubeRing2D.layout = setup;
  CubeRing2D._build = build;
  CubeRing2D._validate = validate;
  if (typeof module !== 'undefined' && module.exports) module.exports = CubeRing2D; else root.CubeRing2D = CubeRing2D;
})(typeof window !== 'undefined' ? window : this);
