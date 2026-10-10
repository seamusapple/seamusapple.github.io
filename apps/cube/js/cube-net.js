/* CubeNet: a flat (unfolded) view of the cube, kept in sync with CubeView.
 *
 *          U
 *       L  F  R  B
 *          D
 *
 * Facelet order follows the Kociemba layout used by CubeModel (U R F D L B, 9 each,
 * row-major as seen looking at the face), which is exactly how the cross net reads.
 *
 *   var net = new CubeNet(el, { onPick: function (pos) {} });
 *   net.update(state)                 // 54-char facelet string
 *   net.highlight(selectors, state)   // same selectors as CubeView; follows the pieces
 *   net.clearHighlight()
 *   net.setFacing({U: z, ...})        // faces with z > 0 are the ones visible in 3D
 *   net.setTurning("R'" | null)       // marks the layer that is turning right now
 *   net.getState()                    // colours as drawn (for tests)
 */
(function (root) {
  'use strict';

  var FACE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B'];
  var FACE_POS = { U: [1, 0], L: [0, 1], F: [1, 1], R: [2, 1], B: [3, 1], D: [1, 2] };
  var COLORS = { W: '#F2F2F2', Y: '#FFD500', G: '#009B48', B: '#0046AD', O: '#FF5800', R: '#B71234' };
  var COLOR_NAME = { W: '白', Y: '黄', G: '绿', B: '蓝', O: '橙', R: '红' };
  var CELL = 10, GAP = 1, FACE_GAP = 3, PAD = 2;
  var FACE_W = CELL * 3;
  var NS = 'http://www.w3.org/2000/svg';

  // ---- slots: which facelets belong to which piece position -------------------------
  // Facelet (face f, row r, col c) -> the piece position letters it belongs to.
  // Neighbour faces along each edge of a face, in Kociemba orientation.
  var EDGE_NB = {
    //      top   bottom  left   right
    U: ['B', 'F', 'L', 'R'],
    R: ['U', 'D', 'F', 'B'],
    F: ['U', 'D', 'L', 'R'],
    D: ['F', 'B', 'L', 'R'],
    L: ['U', 'D', 'B', 'F'],
    B: ['U', 'D', 'R', 'L']
  };
  function letters(f, r, c) {
    var nb = EDGE_NB[f], s = f;
    if (r === 0) s += nb[0]; else if (r === 2) s += nb[1];
    if (c === 0) s += nb[2]; else if (c === 2) s += nb[3];
    return s;
  }
  function norm(pos) { return pos.split('').sort().join(''); }

  var SLOT_OF = [];        // facelet index -> normalised slot key ('FRU', 'FU', 'F')
  var SLOT_FACELETS = {};  // slot key -> [facelet indices]
  var FACE_OF = [];
  FACE_ORDER.forEach(function (f, fi) {
    for (var i = 0; i < 9; i++) {
      var k = fi * 9 + i, key = norm(letters(f, Math.floor(i / 3), i % 3));
      SLOT_OF[k] = key; FACE_OF[k] = f;
      (SLOT_FACELETS[key] = SLOT_FACELETS[key] || []).push(k);
    }
  });

  // which faces a move turns (x/y/z = everything)
  function layerOf(move) {
    var m = /^([UDFBRLxyz])/.exec(move || ''); if (!m) return null;
    return 'UDFBRL'.indexOf(m[1]) >= 0 ? m[1] : '*';
  }

  // identity of the sticker at facelet k in a state: piece colours + this sticker's colour
  function stickerKey(state, k) {
    var cols = SLOT_FACELETS[SLOT_OF[k]].map(function (j) { return state[j]; }).sort().join('');
    return cols + '|' + state[k];
  }

  // resolve CubeView-style selectors to the set of sticker identities (follows pieces later)
  function resolve(selectors, state) {
    if (typeof selectors === 'string') selectors = [selectors];
    var lit = new Set(), add = function (k) { lit.add(stickerKey(state, k)); };
    (selectors || []).forEach(function (sel) {
      sel = String(sel); var m;
      if (sel === 'centers') { for (var fi = 0; fi < 6; fi++) add(fi * 9 + 4); }
      else if ((m = /^(face|layer):([UDFBRL])$/.exec(sel))) {
        for (var k = 0; k < 54; k++) {
          if (SLOT_OF[k].indexOf(m[2]) < 0) continue;
          if (m[1] === 'layer' || FACE_OF[k] === m[2]) add(k);
        }
      } else if (/^[UDFBRL]{1,3}$/.test(sel)) {
        (SLOT_FACELETS[norm(sel)] || []).forEach(add);
      }
    });
    return lit.size ? lit : null;
  }

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var a in attrs) e.setAttribute(a, attrs[a]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function CubeNet(container, opts) {
    opts = opts || {};
    var self = this;
    this.container = container;
    this.onPick = opts.onPick || null;
    this.state = null;
    this._lit = null;      // Set of stickerKey, or null
    this._turning = null;

    var W = FACE_W * 4 + FACE_GAP * 3 + PAD * 2, H = FACE_W * 3 + FACE_GAP * 2 + PAD * 2;
    var svg = this.svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'net-svg', role: 'img',
      'aria-label': '魔方平面展开图：中间一行依次是左、前、右、后，上面是顶面，下面是底面' });
    this.faceBox = {};
    this.faceLabel = {};
    this.cells = [];
    FACE_ORDER.forEach(function (f, fi) {
      var fx = PAD + FACE_POS[f][0] * (FACE_W + FACE_GAP), fy = PAD + FACE_POS[f][1] * (FACE_W + FACE_GAP);
      var g = el('g', { class: 'net-face', 'data-face': f }, svg);
      self.faceBox[f] = el('rect', { x: fx - 1.2, y: fy - 1.2, width: FACE_W + 2.4, height: FACE_W + 2.4, rx: 2.5, class: 'net-frame' }, g);
      for (var i = 0; i < 9; i++) {
        var r = Math.floor(i / 3), c = i % 3, k = fi * 9 + i;
        var cell = el('rect', {
          x: fx + c * CELL + GAP / 2, y: fy + r * CELL + GAP / 2,
          width: CELL - GAP, height: CELL - GAP, rx: 1.4, class: 'net-cell', 'data-i': k
        }, g);
        self.cells[k] = cell;
      }
      var t = el('text', { x: fx + FACE_W / 2, y: fy + FACE_W / 2 + 0.2, class: 'net-letter',
        'text-anchor': 'middle', 'dominant-baseline': 'central' }, g);
      t.textContent = f;
      self.faceLabel[f] = t;
    });
    container.appendChild(svg);

    this._onClick = function (e) {
      var t = e.target;
      if (!t || !t.getAttribute) return;
      var k = t.getAttribute('data-i');
      if (k == null && t.classList && t.classList.contains('net-letter')) {
        // the letter sits on the centre sticker
        var f = t.textContent; k = String(FACE_ORDER.indexOf(f) * 9 + 4);
      }
      if (k == null || !self.onPick) return;
      var letters = SLOT_OF[+k];
      // hand back a position name in the CubeView selector style, face of the click first
      var f0 = FACE_OF[+k], pos = f0 + letters.replace(f0, '');
      self.onPick(pos, +k);
    };
    svg.addEventListener('click', this._onClick);
    this.update(opts.state || 'YYYYYYYYYOOOOOOOOOGGGGGGGGGWWWWWWWWWRRRRRRRRRBBBBBBBBB');
  }

  var P = CubeNet.prototype;

  P.update = function (state) {
    if (!state || state.length !== 54) return;
    var prev = this.state;
    this.state = state;
    this._turning = null;
    for (var k = 0; k < 54; k++) {
      var cell = this.cells[k], c = state[k];
      cell.setAttribute('fill', COLORS[c] || '#777');
      cell.setAttribute('data-c', c);
      if (prev && prev[k] !== c) {
        // restart the flash animation on stickers that just changed
        cell.classList.remove('is-changed'); void cell.getBoundingClientRect(); cell.classList.add('is-changed');
      }
    }
    var self = this;
    FACE_ORDER.forEach(function (f, fi) {
      var c = state[fi * 9 + 4];
      self.faceLabel[f].setAttribute('class', 'net-letter' + (c === 'W' || c === 'Y' ? ' on-light' : ''));
      self.faceBox[f].setAttribute('data-name', f + ' · ' + (COLOR_NAME[c] || ''));
    });
    this._paint();
  };

  P.getState = function () {
    return this.cells.map(function (c) { return c.getAttribute('data-c'); }).join('');
  };

  // resolve CubeView-style selectors to the set of sticker identities at the time of the call
  P.highlight = function (selectors, state) {
    this._lit = resolve(selectors, state || this.state);
    this._paint();
  };
  P.clearHighlight = function () { this._lit = null; this._paint(); };

  P.setTurning = function (move) { this._turning = layerOf(move); this._paint(); };

  P.setFacing = function (facing) {
    var self = this;
    FACE_ORDER.forEach(function (f) {
      var on = facing && facing[f] > 0.12;
      self.faceBox[f].classList.toggle('is-visible', !!on);
    });
  };

  P._paint = function () {
    var lit = this._lit, turn = this._turning, st = this.state;
    for (var k = 0; k < 54; k++) {
      var cell = this.cells[k];
      cell.classList.toggle('is-dim', !!lit && !lit.has(stickerKey(st, k)));
      cell.classList.toggle('is-lit', !!lit && lit.has(stickerKey(st, k)));
      cell.classList.toggle('is-turning', !!turn && (turn === '*' || SLOT_OF[k].indexOf(turn) >= 0));
    }
  };

  P.destroy = function () {
    this.svg.removeEventListener('click', this._onClick);
    if (this.svg.parentNode) this.svg.parentNode.removeChild(this.svg);
  };

  CubeNet.SLOT_OF = SLOT_OF;
  CubeNet.SLOT_FACELETS = SLOT_FACELETS;
  CubeNet.resolve = resolve;
  CubeNet.stickerKey = stickerKey;

  if (typeof module !== 'undefined' && module.exports) module.exports = CubeNet; else root.CubeNet = CubeNet;
})(typeof window !== 'undefined' ? window : this);
