/*
 * cube-model.js — 三阶魔方状态模型（纯逻辑，浏览器 <script> 与 Node require 通用）
 *
 * 状态：54 字符 facelet 字符串，面顺序 U R F D L B，每面 9 格按 Kociemba 约定编号。
 * 配色（白底黄顶）：U=Y R=O F=G D=W L=R B=B。
 *
 * 转动置换表不是手抄的：先为 54 个贴纸算出 3D 位置 + 法向，
 * 对该层施加 90° 旋转矩阵，再按（位置, 法向）匹配回贴纸索引得到置换。
 */
var CubeModel = (function () {
  'use strict';

  var FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
  var FACE_OFFSET = { U: 0, R: 9, F: 18, D: 27, L: 36, B: 45 };
  var OPPOSITE = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };
  var COLOR_ORDER = 'WYGBOR';
  var SOLVED = 'YYYYYYYYY' + 'OOOOOOOOO' + 'GGGGGGGGG' + 'WWWWWWWWW' + 'RRRRRRRRR' + 'BBBBBBBBB';

  // ---------- 几何：每个贴纸的 3D 位置（所在小块坐标）与法向 ----------
  // 坐标系：x 指向 R，y 指向 U，z 指向 F；小块坐标取 -1/0/1。
  function faceletGeometry(face, i) {
    var r = Math.floor(i / 3), c = i % 3;
    switch (face) {
      case 'U': return { p: [c - 1, 1, r - 1], n: [0, 1, 0] };
      case 'R': return { p: [1, 1 - r, 1 - c], n: [1, 0, 0] };
      case 'F': return { p: [c - 1, 1 - r, 1], n: [0, 0, 1] };
      case 'D': return { p: [c - 1, -1, 1 - r], n: [0, -1, 0] };
      case 'L': return { p: [-1, 1 - r, c - 1], n: [-1, 0, 0] };
      case 'B': return { p: [1 - c, 1 - r, -1], n: [0, 0, -1] };
    }
    throw new Error('bad face ' + face);
  }

  var GEO = [];
  var GEO_INDEX = {};
  FACES.forEach(function (f) {
    for (var i = 0; i < 9; i++) {
      var g = faceletGeometry(f, i);
      GEO.push(g);
      GEO_INDEX[g.p.join(',') + '|' + g.n.join(',')] = GEO.length - 1;
    }
  });

  // 绕 +axis 旋转 -90°（即从该轴正方向看过去顺时针）一次
  function rotCW(v, axis) {
    var x = v[0], y = v[1], z = v[2];
    if (axis === 0) return [x, z, -y];
    if (axis === 1) return [-z, y, x];
    return [y, -x, z];
  }

  // 记号定义：轴、从正轴看顺时针的 1/4 圈数（D L B 从负轴看顺时针 = 正轴看逆时针 3 次）、层筛选
  var BASE = {
    U: { axis: 1, turns: 1, layer: 1 },
    D: { axis: 1, turns: 3, layer: -1 },
    R: { axis: 0, turns: 1, layer: 1 },
    L: { axis: 0, turns: 3, layer: -1 },
    F: { axis: 2, turns: 1, layer: 1 },
    B: { axis: 2, turns: 3, layer: -1 },
    x: { axis: 0, turns: 1, layer: null },
    y: { axis: 1, turns: 1, layer: null },
    z: { axis: 2, turns: 1, layer: null }
  };

  // 置换数组 P：newState[i] = oldState[P[i]]
  function buildPerm(def, quarter) {
    var P = new Array(54);
    for (var j = 0; j < 54; j++) P[j] = j;
    for (var src = 0; src < 54; src++) {
      var g = GEO[src];
      if (def.layer !== null && g.p[def.axis] !== def.layer) continue;
      var p = g.p, n = g.n;
      var t = (def.turns * quarter) % 4;
      for (var k = 0; k < t; k++) { p = rotCW(p, def.axis); n = rotCW(n, def.axis); }
      var dest = GEO_INDEX[p.join(',') + '|' + n.join(',')];
      if (dest === undefined) throw new Error('geometry mismatch');
      P[dest] = src;
    }
    return P;
  }

  var MOVES = [];
  var PERM = {};
  'U D F B R L x y z'.split(' ').forEach(function (b) {
    [['', 1], ["'", 3], ['2', 2]].forEach(function (s) {
      var m = b + s[0];
      MOVES.push(m);
      PERM[m] = buildPerm(BASE[b], s[1]);
    });
  });

  function parse(alg) {
    if (Array.isArray(alg)) {
      alg.forEach(function (m) { if (!PERM[m]) throw new Error('非法记号: ' + m); });
      return alg.slice();
    }
    if (alg === undefined || alg === null) return [];
    var s = String(alg).replace(/[’′‘`]/g, "'").trim();
    if (!s) return [];
    return s.split(/\s+/).map(function (m) {
      if (!PERM[m]) throw new Error('非法记号: ' + m);
      return m;
    });
  }

  function invertMove(m) {
    if (m.length === 1) return m + "'";
    if (m[1] === "'") return m[0];
    return m;
  }

  function invert(moves) {
    return parse(moves).slice().reverse().map(invertMove);
  }

  function applyMove(state, m) {
    var P = PERM[m];
    if (!P) throw new Error('非法记号: ' + m);
    var out = new Array(54);
    for (var i = 0; i < 54; i++) out[i] = state[P[i]];
    return out.join('');
  }

  function apply(state, movesOrAlg) {
    var ms = parse(movesOrAlg);
    var s = state;
    for (var i = 0; i < ms.length; i++) s = applyMove(s, ms[i]);
    return s;
  }

  function isSolved(state) {
    if (typeof state !== 'string' || state.length !== 54) return false;
    for (var f = 0; f < 6; f++) {
      var c = state[f * 9 + 4];
      for (var i = 0; i < 9; i++) if (state[f * 9 + i] !== c) return false;
    }
    return true;
  }

  function centers(state) {
    var o = {};
    FACES.forEach(function (f) { o[f] = state[FACE_OFFSET[f] + 4]; });
    return o;
  }

  // ---------- 块（cubie）定义：Kociemba 顺序，贴纸按名字字母顺序 ----------
  var CORNER_NAMES = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'];
  var EDGE_NAMES = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'];

  // 从几何推导出每个块位的贴纸索引（按名字里面的字母顺序）
  var FACE_NORMAL = { U: [0, 1, 0], D: [0, -1, 0], R: [1, 0, 0], L: [-1, 0, 0], F: [0, 0, 1], B: [0, 0, -1] };
  function slotFacelets(name) {
    var p = [0, 0, 0];
    name.split('').forEach(function (f) {
      var n = FACE_NORMAL[f];
      p = [p[0] + n[0], p[1] + n[1], p[2] + n[2]];
    });
    return name.split('').map(function (f) {
      return GEO_INDEX[p.join(',') + '|' + FACE_NORMAL[f].join(',')];
    });
  }
  var CORNER_FACELETS = CORNER_NAMES.map(slotFacelets);
  var EDGE_FACELETS = EDGE_NAMES.map(slotFacelets);

  function sortColors(s) {
    return s.split('').sort(function (a, b) { return COLOR_ORDER.indexOf(a) - COLOR_ORDER.indexOf(b); }).join('');
  }

  // 颜色 -> 当前该颜色中心所在面
  function colorToFace(state) {
    var m = {};
    FACES.forEach(function (f) { m[state[FACE_OFFSET[f] + 4]] = f; });
    return m;
  }

  // 24 种整体朝向下的中心排列（用于合法性检查）
  var CENTER_SETS = (function () {
    var seen = {}, queue = [SOLVED];
    function key(s) { return FACES.map(function (f) { return s[FACE_OFFSET[f] + 4]; }).join(''); }
    seen[key(SOLVED)] = true;
    while (queue.length) {
      var s = queue.shift();
      ['x', 'y', 'z'].forEach(function (m) {
        var t = applyMove(s, m), k = key(t);
        if (!seen[k]) { seen[k] = true; queue.push(t); }
      });
    }
    return seen;
  })();

  function permParity(arr) {
    var n = arr.length, seen = new Array(n), parity = 0;
    for (var i = 0; i < n; i++) {
      if (seen[i]) continue;
      var len = 0, j = i;
      while (!seen[j]) { seen[j] = true; j = arr[j]; len++; }
      parity += len - 1;
    }
    return parity % 2;
  }

  // 解析出每个位置上是哪个块、朝向（以当前中心为准）。失败返回 null。
  function cubies(state) {
    var c2f = colorToFace(state);
    var cp = [], co = [], ep = [], eo = [];
    for (var i = 0; i < 8; i++) {
      var l = CORNER_FACELETS[i].map(function (k) { return c2f[state[k]]; });
      var k = -1;
      for (var t = 0; t < 3; t++) if (l[t] === 'U' || l[t] === 'D') k = t;
      if (k < 0) return null;
      var name = l[k] + l[(k + 1) % 3] + l[(k + 2) % 3];
      var id = CORNER_NAMES.indexOf(name);
      if (id < 0) return null;
      cp.push(id); co.push(k);
    }
    for (i = 0; i < 12; i++) {
      var e = EDGE_FACELETS[i].map(function (k) { return c2f[state[k]]; });
      var a = EDGE_NAMES.indexOf(e[0] + e[1]), b = EDGE_NAMES.indexOf(e[1] + e[0]);
      if (a >= 0) { ep.push(a); eo.push(0); }
      else if (b >= 0) { ep.push(b); eo.push(1); }
      else return null;
    }
    return { cp: cp, co: co, ep: ep, eo: eo };
  }

  function isValid(state) {
    if (typeof state !== 'string' || state.length !== 54) return false;
    var count = {};
    for (var i = 0; i < 54; i++) {
      var ch = state[i];
      if (COLOR_ORDER.indexOf(ch) < 0) return false;
      count[ch] = (count[ch] || 0) + 1;
    }
    for (i = 0; i < 6; i++) if (count[COLOR_ORDER[i]] !== 9) return false;
    var ck = FACES.map(function (f) { return state[FACE_OFFSET[f] + 4]; }).join('');
    if (!CENTER_SETS[ck]) return false;
    var c = cubies(state);
    if (!c) return false;
    var used = {};
    for (i = 0; i < 8; i++) { if (used['c' + c.cp[i]]) return false; used['c' + c.cp[i]] = 1; }
    for (i = 0; i < 12; i++) { if (used['e' + c.ep[i]]) return false; used['e' + c.ep[i]] = 1; }
    var so = 0, se = 0;
    for (i = 0; i < 8; i++) so += c.co[i];
    for (i = 0; i < 12; i++) se += c.eo[i];
    if (so % 3 !== 0 || se % 2 !== 0) return false;
    return permParity(c.cp) === permParity(c.ep);
  }

  function scramble(n, rng) {
    if (n === undefined || n === null) n = 25;
    rng = rng || Math.random;
    var faces = ['U', 'D', 'F', 'B', 'R', 'L'];
    var axisOf = { U: 0, D: 0, F: 1, B: 1, R: 2, L: 2 };
    var sufs = ['', "'", '2'];
    var moves = [];
    while (moves.length < n) {
      var f = faces[Math.floor(rng() * 6)];
      var last = moves.length ? moves[moves.length - 1][0] : null;
      var last2 = moves.length > 1 ? moves[moves.length - 2][0] : null;
      if (f === last) continue;
      if (last && axisOf[f] === axisOf[last] && last2 === f) continue; // 不与对面来回：R L R
      moves.push(f + sufs[Math.floor(rng() * 3)]);
    }
    return { moves: moves, state: apply(SOLVED, moves) };
  }

  function pieces(state) {
    var c2f = colorToFace(state);
    function info(names, facelets) {
      return names.map(function (pos, i) {
        var cols = facelets[i].map(function (k) { return state[k]; }).join('');
        var faces = cols.split('').map(function (ch) { return c2f[ch]; });
        var oriented;
        if (names.length === 8) {
          oriented = faces[0] === 'U' || faces[0] === 'D';
        } else {
          var hasUD = faces.indexOf('U') >= 0 || faces.indexOf('D') >= 0;
          oriented = hasUD ? (faces[0] === 'U' || faces[0] === 'D') : (faces[0] === 'F' || faces[0] === 'B');
        }
        // home：该块应在的位置（按当前中心）
        var home = null;
        for (var h = 0; h < names.length; h++) {
          var hn = names[h];
          if (hn.length === faces.length && faces.every(function (f) { return hn.indexOf(f) >= 0; })) { home = hn; break; }
        }
        var solved = facelets[i].every(function (k) { return state[k] === state[FACE_OFFSET[GEO_FACE[k]] + 4]; });
        return { pos: pos, colors: cols, id: sortColors(cols), oriented: oriented, home: home, solved: solved };
      });
    }
    return { edges: info(EDGE_NAMES, EDGE_FACELETS), corners: info(CORNER_NAMES, CORNER_FACELETS) };
  }
  var GEO_FACE = [];
  FACES.forEach(function (f) { for (var i = 0; i < 9; i++) GEO_FACE.push(f); });

  // ---------- 阶段判定 ----------
  var STAGES = ['cross', 'corners', 'middle', 'yellowCross', 'yellowFace', 'yellowCorners', 'yellowEdges'];

  // 把白色中心转到 D 面的整体转动
  function whiteDown(state) {
    var c = centers(state);
    if (c.D === 'W') return state;
    if (c.U === 'W') return apply(state, 'x2');
    if (c.B === 'W') return apply(state, 'x');
    if (c.F === 'W') return apply(state, "x'");
    if (c.R === 'W') return apply(state, 'z');
    return apply(state, "z'");
  }

  function faceletOK(s, k) { return s[k] === s[FACE_OFFSET[GEO_FACE[k]] + 4]; }
  function allOK(s, list) { for (var i = 0; i < list.length; i++) if (!faceletOK(s, list[i])) return false; return true; }

  var SIDE = ['F', 'R', 'B', 'L'];
  function rows(rowIdx) {
    var out = [];
    SIDE.forEach(function (f) { rowIdx.forEach(function (i) { out.push(FACE_OFFSET[f] + i); }); });
    return out;
  }
  var CHECK = {
    cross: [28, 30, 32, 34].concat(rows([7])),
    corners: [27, 28, 29, 30, 31, 32, 33, 34, 35].concat(rows([6, 7, 8])),
    middle: rows([3, 5]),
    yellowCross: [1, 3, 5, 7],
    yellowFace: [0, 1, 2, 3, 5, 6, 7, 8],
    yellowCorners: rows([0, 2]),
    yellowEdges: rows([1])
  };

  function isStageSolved(state, stage) {
    var idx = STAGES.indexOf(stage);
    if (idx < 0) throw new Error('未知阶段: ' + stage);
    var s = whiteDown(state);
    for (var i = 0; i <= idx; i++) if (!allOK(s, CHECK[STAGES[i]])) return false;
    return true;
  }

  function stageProgress(state) {
    var s = whiteDown(state), best = -1;
    for (var i = 0; i < STAGES.length; i++) {
      if (!allOK(s, CHECK[STAGES[i]])) break;
      best = i;
    }
    return best;
  }

  return {
    SOLVED: SOLVED,
    MOVES: MOVES,
    FACES: FACES,
    STAGES: STAGES,
    CORNER_NAMES: CORNER_NAMES,
    EDGE_NAMES: EDGE_NAMES,
    CORNER_FACELETS: CORNER_FACELETS,
    EDGE_FACELETS: EDGE_FACELETS,
    GEOMETRY: GEO,
    PERM: PERM,
    parse: parse,
    invert: invert,
    invertMove: invertMove,
    apply: apply,
    isSolved: isSolved,
    isValid: isValid,
    scramble: scramble,
    centers: centers,
    pieces: pieces,
    whiteDown: whiteDown,
    isStageSolved: isStageSolved,
    stageProgress: stageProgress
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = CubeModel; else window.CubeModel = CubeModel;
