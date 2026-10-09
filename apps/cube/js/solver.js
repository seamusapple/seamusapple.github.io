/*
 * solver.js — 层先法（LBL）求解器（纯逻辑，浏览器 <script> 与 Node require 通用）
 *
 * 教与解一致：除白十字（直观法，任意面转）外，只用教程公式 ALGS，
 * 公式之间只插入 U/D 调整和 y 整体转动（不翻转魔方，白色一直在下）。
 * 依赖 CubeModel（Node: require('./cube-model.js')，浏览器: window.CubeModel）。
 */
var CubeSolver = (function (CM) {
  'use strict';

  var ALGS = {
    rightHand: "R U R' U'",
    leftHand: "L' U' L U",
    middleRight: "U R U' R' U' F' U F",
    middleLeft: "U' L' U L U F U' F'",
    yellowCross: "F R U R' U' F'",
    sune: "R U R' U R U2 R'",
    yellowCorners: "U R U' L' U R' U' L",
    yellowEdges: "R U' R U R U R U' R' U' R2"
  };

  var STAGE_TITLES = {
    cross: '白色十字',
    corners: '白色角块',
    middle: '中层棱块',
    yellowCross: '黄色十字',
    yellowFace: '黄色面',
    yellowCorners: '黄角归位',
    yellowEdges: '黄棱归位'
  };

  var CN = { W: '白', Y: '黄', G: '绿', B: '蓝', O: '橙', R: '红' };
  var OFF = { U: 0, R: 9, F: 18, D: 27, L: 36, B: 45 };
  var FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
  var FACE_OF = [];
  FACES.forEach(function (f) { for (var i = 0; i < 9; i++) FACE_OF.push(f); });

  var apply = CM.apply;
  function P(alg) { return CM.parse(alg); }
  function cname(id) { return id.split('').map(function (c) { return CN[c]; }).join('-'); }
  function centerOf(s, f) { return s[OFF[f] + 4]; }
  function ok(s, k) { return s[k] === s[OFF[FACE_OF[k]] + 4]; }

  var EDGE_NAMES = CM.EDGE_NAMES, EDGE_FL = CM.EDGE_FACELETS;
  var CORNER_NAMES = CM.CORNER_NAMES, CORNER_FL = CM.CORNER_FACELETS;

  // 某个块（按颜色集合）当前所在位置与贴纸
  function findPiece(s, colors, isCorner) {
    var names = isCorner ? CORNER_NAMES : EDGE_NAMES, fl = isCorner ? CORNER_FL : EDGE_FL;
    for (var i = 0; i < names.length; i++) {
      var cs = fl[i].map(function (k) { return s[k]; });
      if (colors.split('').every(function (c) { return cs.indexOf(c) >= 0; })) {
        return { pos: names[i], facelets: fl[i], colors: cs.join('') };
      }
    }
    return null;
  }
  function pieceSolved(s, colors, isCorner) {
    var p = findPiece(s, colors, isCorner);
    return p.facelets.every(function (k) { return ok(s, k); });
  }

  var Y_ADJ = ['', 'y', 'y2', "y'"];
  var U_ADJ = ['', 'U', 'U2', "U'"];

  function repeat(alg, n) { var out = []; for (var i = 0; i < n; i++) out = out.concat(P(alg)); return out; }
  function seq() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) out = out.concat(Array.isArray(arguments[i]) ? arguments[i] : P(arguments[i]));
    return out;
  }

  function step(moves, note, target, s) {
    return { moves: moves, note: note, target: target || null, highlight: highlightFor(s, target) };
  }
  function highlightFor(s, target) {
    if (!target) return 'layer:U';
    var p = findPiece(s, target, target.length === 3);
    return p ? [p.pos] : null;
  }

  // ======================= 第 1 步：白色十字（直观法 + 小搜索） =======================
  var FACE_MOVES = [];
  ['U', 'D', 'F', 'B', 'R', 'L'].forEach(function (f) { FACE_MOVES.push(f, f + "'", f + '2'); });
  var AXIS = { U: 0, D: 0, F: 1, B: 1, R: 2, L: 2 };
  var FORDER = { U: 0, D: 1, F: 2, B: 3, R: 4, L: 5 };
  // FWD[m][j] = 贴纸 j 在转动 m 后到达的位置
  var FWD = {};
  FACE_MOVES.forEach(function (m) {
    var perm = CM.PERM[m], f = new Array(54);
    for (var d = 0; d < 54; d++) f[perm[d]] = d;
    FWD[m] = f;
  });
  var distCache = {};
  function distTable(goal) {
    if (distCache[goal]) return distCache[goal];
    var dist = {}, q = [goal];
    dist[goal] = 0;
    // 逆向 BFS：由于每个转动的逆也在转动集合里，正向 BFS 距离等价
    while (q.length) {
      var j = q.shift();
      for (var i = 0; i < FACE_MOVES.length; i++) {
        var t = FWD[FACE_MOVES[i]][j];
        if (dist[t] === undefined) { dist[t] = dist[j] + 1; q.push(t); }
      }
    }
    distCache[goal] = dist;
    return dist;
  }

  // 让 pos[] 中所有白色贴纸到 goal[]，返回所有最短解
  function crossSearch(pos, goal, maxDepth) {
    var tables = goal.map(distTable);
    var sols = [], path = [];
    function h(p) { var m = 0; for (var i = 0; i < p.length; i++) { var d = tables[i][p[i]]; if (d > m) m = d; } return m; }
    function dfs(p, depth, last) {
      var hv = h(p);
      if (hv === 0 && depth === 0) { sols.push(path.slice()); return; }
      if (hv > depth || depth === 0) return;
      for (var i = 0; i < FACE_MOVES.length; i++) {
        var m = FACE_MOVES[i], f = m[0];
        if (last) {
          if (f === last) continue;
          if (AXIS[f] === AXIS[last] && FORDER[f] < FORDER[last]) continue;
        }
        var np = p.map(function (x) { return FWD[m][x]; });
        path.push(m);
        dfs(np, depth - 1, f);
        path.pop();
        if (sols.length >= 64) return;
      }
    }
    for (var d = 0; d <= maxDepth; d++) {
      dfs(pos, d, null);
      if (sols.length) return sols;
    }
    return null;
  }
  function crossScore(ms) {
    var sides = {}, dn = 0, half = 0;
    ms.forEach(function (m) {
      if (m[0] === 'D') dn++;
      else if (m[0] !== 'U') sides[m[0]] = 1;
      if (m[1] === '2') half++;
    });
    return Object.keys(sides).length * 10 + dn * 3 + half;
  }

  function crossCase(s, wIdx) {
    var f = FACE_OF[wIdx], r = Math.floor((wIdx % 9) / 3);
    if (f === 'D') return '在底层但位置不对（白色朝下）';
    if (f === 'U') return '在顶层，白色朝上';
    if (r === 0) return '在顶层，白色朝向侧面';
    if (r === 1) return '在中层';
    return '在底层，白色朝向侧面（翻了）';
  }

  function solveCross(s) {
    var edges = []; // {color, w, goal}
    for (var i = 0; i < 12; i++) {
      var fl = EDGE_FL[i], a = s[fl[0]], b = s[fl[1]];
      if (a === 'W' || b === 'W') {
        var c = a === 'W' ? b : a;
        var side = FACES.filter(function (f) { return f !== 'U' && f !== 'D' && centerOf(s, f) === c; })[0];
        var goal = EDGE_FL[EDGE_NAMES.indexOf('D' + side)][0];
        edges.push({ color: c, w: a === 'W' ? fl[0] : fl[1], goal: goal, side: side });
      }
    }
    // 尝试所有放置顺序，取总步数最少（同长度取得分低）
    var best = null;
    function rec(placed, cur, plan, total, score) {
      if (best && (total > best.total || (total === best.total && score >= best.score))) return;
      if (placed.length === 4) { best = { total: total, score: score, plan: plan.slice() }; return; }
      for (var k = 0; k < 4; k++) {
        if (placed.indexOf(k) >= 0) continue;
        var set = placed.concat([k]);
        var sols = crossSearch(set.map(function (e) { return cur[e]; }), set.map(function (e) { return edges[e].goal; }), 10);
        sols.sort(function (x, y) { return crossScore(x) - crossScore(y); });
        var ms = sols[0];
        var nxt = cur.map(function (x) { var y = x; ms.forEach(function (m) { y = FWD[m][y]; }); return y; });
        plan.push({ k: k, moves: ms, from: cur[k] });
        rec(set, nxt, plan, total + ms.length, score + crossScore(ms));
        plan.pop();
      }
    }
    rec([], edges.map(function (e) { return e.w; }), [], 0, 0);
    var steps = [];
    best.plan.forEach(function (p) {
      var e = edges[p.k], id = 'W' + e.color;
      if (!p.moves.length) return;
      var usesD = p.moves.some(function (m) { return m[0] === 'D'; });
      var note = '把 ' + cname(id) + ' 棱块转到底面并对齐' + CN[e.color] + '色中心：它现在' + crossCase(s, p.from) + '。' +
        (usesD ? '中间要先转 D 让开已放好的白棱，最后再转回来。' : '');
      steps.push(step(p.moves, note, id, s));
      s = apply(s, p.moves);
    });
    return { steps: steps, state: s };
  }

  // ======================= 第 2/3 步公共：块追踪 + 放置顺序搜索 =======================
  // 只追踪目标块的贴纸位置（以及随整体转动移动的目标位置），用来快速评估「y + U 调整 + 公式」方案，
  // 再对 4 个块的放置顺序做穷举（带剪枝），选总步数最少的顺序。
  var FWD_ALL = {};
  CM.MOVES.forEach(function (m) {
    var perm = CM.PERM[m], f = new Array(54);
    for (var d = 0; d < 54; d++) f[perm[d]] = d;
    FWD_ALL[m] = f;
  });
  function isWhole(m) { return m[0] === 'x' || m[0] === 'y' || m[0] === 'z'; }
  function trackPiece(p, moves) {
    var cur = p.cur.slice(), goal = p.goal.slice();
    for (var i = 0; i < moves.length; i++) {
      var f = FWD_ALL[moves[i]];
      for (var k = 0; k < cur.length; k++) cur[k] = f[cur[k]];
      if (isWhole(moves[i])) for (k = 0; k < goal.length; k++) goal[k] = f[goal[k]];
    }
    return { id: p.id, cur: cur, goal: goal };
  }
  function pieceDone(p) { for (var k = 0; k < p.cur.length; k++) if (p.cur[k] !== p.goal[k]) return false; return true; }
  function sameSet(a, b) { if (a.length !== b.length) return false; for (var i = 0; i < a.length; i++) if (b.indexOf(a[i]) < 0) return false; return true; }
  function sortId(c) { return c.split('').sort(function (a, b) { return 'WYGBOR'.indexOf(a) - 'WYGBOR'.indexOf(b); }).join(''); }

  // 由真实状态建立追踪对象：slots 是该阶段 4 个目标位置名（如 DFR / FR）
  function makePieces(s, slots, isCorner) {
    var names = isCorner ? CORNER_NAMES : EDGE_NAMES, fl = isCorner ? CORNER_FL : EDGE_FL;
    return slots.map(function (slot) {
      var goalIdx = fl[names.indexOf(slot)];
      var colors = goalIdx.map(function (k) { return centerOf(s, FACE_OF[k]); });
      var where = findPiece(s, colors.join(''), isCorner);
      var cur = colors.map(function (c) { return where.facelets[where.colors.indexOf(c)]; });
      return { id: sortId(colors.join('')), cur: cur, goal: goalIdx.slice() };
    });
  }

  // cfg: { forms:[{alg, slot}], maxRep, isCorner }
  function directPlan(p, cfg) {
    var best = null;
    for (var b = 0; b < 4; b++) {
      for (var h = 0; h < cfg.forms.length; h++) {
        for (var a = 0; a < 4; a++) {
          var pre = P(Y_ADJ[b]).concat(P(U_ADJ[a]));
          var t = trackPiece(p, pre), alg = P(cfg.forms[h].alg);
          for (var n = 1; n <= cfg.maxRep; n++) {
            t = trackPiece(t, alg);
            if (pieceDone(t)) {
              var cost = pre.length + alg.length * n;
              if (!best || cost < best.cost) best = { y: Y_ADJ[b], u: U_ADJ[a], hand: h, n: n, cost: cost, moves: pre.concat(repeat(cfg.forms[h].alg, n)) };
              break;
            }
          }
        }
      }
    }
    return best;
  }
  function popPlans(p, cfg) {
    var names = cfg.isCorner ? CORNER_NAMES : EDGE_NAMES, fl = cfg.isCorner ? CORNER_FL : EDGE_FL;
    var out = [];
    for (var b = 0; b < 4; b++) {
      var t = trackPiece(p, P(Y_ADJ[b]));
      for (var h = 0; h < cfg.forms.length; h++) {
        if (!sameSet(t.cur, fl[names.indexOf(cfg.forms[h].slot)])) continue;
        out.push({ y: Y_ADJ[b], hand: h, moves: P(Y_ADJ[b]).concat(P(cfg.forms[h].alg)) });
      }
    }
    return out;
  }
  function pieceOption(p, cfg) {
    var d = directPlan(p, cfg);
    if (d) return { cost: d.cost, parts: [{ kind: 'direct', plan: d }] };
    var best = null;
    popPlans(p, cfg).forEach(function (pp) {
      var d2 = directPlan(trackPiece(p, pp.moves), cfg);
      if (!d2) return;
      var c = pp.moves.length + d2.cost;
      if (!best || c < best.cost) best = { cost: c, parts: [{ kind: 'pop', plan: pp }, { kind: 'direct', plan: d2 }] };
    });
    return best;
  }
  function orderSearch(pieces, cfg) {
    var best = null;
    (function dfs(ps, cost, seqParts) {
      if (best && cost >= best.cost) return;
      var rest = [];
      ps.forEach(function (p, i) { if (!pieceDone(p)) rest.push(i); });
      if (!rest.length) { best = { cost: cost, parts: seqParts.slice() }; return; }
      var opts = rest.map(function (i) { return { i: i, o: pieceOption(ps[i], cfg) }; }).filter(function (x) { return x.o; });
      opts.sort(function (x, y) { return x.o.cost - y.o.cost; });
      opts.forEach(function (x) {
        var moves = [];
        x.o.parts.forEach(function (pt) { moves = moves.concat(pt.plan.moves); });
        var nps = ps.map(function (p) { return trackPiece(p, moves); });
        var parts = x.o.parts.map(function (pt) { return { kind: pt.kind, plan: pt.plan, id: ps[x.i].id }; });
        dfs(nps, cost + x.o.cost, seqParts.concat(parts));
      });
    })(pieces, 0, []);
    if (!best) throw new Error('F2L order search failed');
    return best.parts;
  }

  // ======================= 第 2 步：白色角块（右手 / 左手公式） =======================
  var CORNER_CFG = { forms: [{ alg: ALGS.rightHand, slot: 'DFR' }, { alg: ALGS.leftHand, slot: 'DLF' }], maxRep: 5, isCorner: true };
  function facingCN(f) { return { R: '朝右', L: '朝左', F: '朝前', U: '朝上', B: '朝后', D: '朝下' }[f]; }

  function solveCorners(s) {
    var parts = orderSearch(makePieces(s, ['DFR', 'DLF', 'DBL', 'DRB'], true), CORNER_CFG);
    var steps = [];
    parts.forEach(function (pt) {
      var id = pt.id, plan = pt.plan, handName = plan.hand ? '左手公式' : '右手公式', note;
      if (pt.kind === 'pop') {
        note = (plan.y ? '先整体转 ' + plan.y + '；' : '') + cname(id) + ' 角块卡在底层的错误位置：先做 1 次' + handName + '把它顶到顶层';
      } else {
        var pre = apply(s, seq(plan.y, plan.u)), p = findPiece(pre, id, true);
        var wf = FACE_OF[p.facelets[p.colors.indexOf('W')]];
        var slot = plan.hand ? '左前' : '右前', intro = [];
        if (plan.y) intro.push('先整体转 ' + plan.y + '，让目标位置到' + slot + '下');
        if (p.pos[0] === 'D') {
          note = (intro.length ? intro.join('，') + '；' : '') + cname(id) + ' 角块已经在目标位置，但白色' + facingCN(wf) + '（拧歪了）：做 ' + plan.n + ' 次' + handName + '把它拧正';
        } else {
          if (plan.u) intro.push('转 ' + plan.u + ' 把 ' + cname(id) + ' 角块移到目标位置正上方');
          else intro.push(cname(id) + ' 角块就在目标位置正上方');
          note = intro.join('，') + '；这个角块白色' + facingCN(wf) + '：做 ' + plan.n + ' 次' + handName;
        }
      }
      steps.push(step(plan.moves, note, id, s));
      s = apply(s, plan.moves);
    });
    return { steps: steps, state: s };
  }

  // ======================= 第 3 步：中层棱块 =======================
  var MIDDLE_CFG = { forms: [{ alg: ALGS.middleRight, slot: 'FR' }, { alg: ALGS.middleLeft, slot: 'FL' }], maxRep: 1, isCorner: false };
  function solveMiddle(s) {
    var slots = ['FR', 'FL', 'BL', 'BR'];
    var parts = orderSearch(makePieces(s, slots, false), MIDDLE_CFG);
    var steps = [];
    parts.forEach(function (pt) {
      var id = pt.id, plan = pt.plan, note;
      if (pt.kind === 'pop') {
        var at = findPiece(s, id, false).pos;
        var home = slots.filter(function (x) { return sortId(centerOf(s, x[0]) + centerOf(s, x[1])) === id; })[0];
        note = (plan.y ? '先整体转 ' + plan.y + '；' : '') + cname(id) + ' 棱块' + (at === home ? '在自己的位置但颜色反了' : '卡在中层的错误位置') +
          '：先做 1 次' + (plan.hand ? '往左放' : '往右放') + '公式把它顶到顶层';
      } else {
        var pre = apply(s, seq(plan.y, plan.u)), p = findPiece(pre, id, false); // 此时在 UF
        var top = p.colors[0], front = p.colors[1], intro = [];
        if (plan.y) intro.push('整体转 ' + plan.y);
        if (plan.u) intro.push('转 ' + plan.u);
        note = (intro.length ? intro.join('、') + '，' : '') + '让 ' + cname(id) + ' 棱块在顶层前面正中，前侧' + CN[front] + '色对准' + CN[front] + '色中心（倒 T 字）；' +
          '它顶上的' + CN[top] + '色中心在' + (plan.hand ? '左边 → 做往左放公式' : '右边 → 做往右放公式');
      }
      steps.push(step(plan.moves, note, id, s));
      s = apply(s, plan.moves);
    });
    return { steps: steps, state: s };
  }

  // ======================= 顶层（第 4–7 步）公共工具 =======================
  // 顶层四步之间做「向后看」：每一步在符合教学判读规则的摆法里，选让后续总步数最少的那个。
  // 各阶段的代价按「顶层相对状态」（颜色换算成面字母）缓存。
  var LL_IDX = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 18, 19, 20, 36, 37, 38, 45, 46, 47];
  var LL_CORNER_IDX = [], LL_EDGE_IDX = [];
  ['URF', 'UFL', 'ULB', 'UBR'].forEach(function (n) { LL_CORNER_IDX = LL_CORNER_IDX.concat(CORNER_FL[CORNER_NAMES.indexOf(n)]); });
  ['UR', 'UF', 'UL', 'UB'].forEach(function (n) { LL_EDGE_IDX = LL_EDGE_IDX.concat(EDGE_FL[EDGE_NAMES.indexOf(n)]); });
  function relKey(s, idxs) {
    var c2f = {};
    FACES.forEach(function (f) { c2f[centerOf(s, f)] = f; });
    var out = '';
    for (var i = 0; i < idxs.length; i++) out += c2f[s[idxs[i]]];
    return out;
  }
  function planMoves(plan) {
    var out = [];
    plan.forEach(function (p) { out = out.concat(p.moves); });
    return out;
  }
  function planCost(plan) { return planMoves(plan).length; }

  // 二叉堆 Dijkstra（代价 = 步数）；收集代价 ≤ 最优 + slack 的全部目标路径
  function macroSearch(s, macros, goal, maxCost, slack) {
    var dist = {}, prev = {}, heap = [];
    function push(x) {
      heap.push(x);
      var i = heap.length - 1;
      while (i > 0) { var p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; var t = heap[p]; heap[p] = heap[i]; heap[i] = t; i = p; }
    }
    function pop() {
      var top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        var i = 0;
        for (;;) {
          var l = 2 * i + 1, r = l + 1, m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          var t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m;
        }
      }
      return top;
    }
    dist[s] = 0;
    push([0, s]);
    var found = [], best = null;
    while (heap.length) {
      var cur = pop(), d = cur[0], st = cur[1];
      if (d > dist[st]) continue;
      if (best !== null && d > best + slack) break;
      if (goal(st)) {
        if (best === null) best = d;
        var path = [], x = st;
        while (x !== s) { path.unshift(prev[x].m); x = prev[x].s; }
        found.push({ path: path, cost: d });
        continue;
      }
      if (d >= maxCost) continue;
      for (var k = 0; k < macros.length; k++) {
        var mc = macros[k], t = apply(st, mc.moves), nd = d + mc.moves.length;
        if (dist[t] === undefined || nd < dist[t]) { dist[t] = nd; prev[t] = { s: st, m: mc }; push([nd, t]); }
      }
    }
    return found;
  }
  function adjMacros(list) { return list.map(function (m) { return { moves: P(m), adj: m }; }); }
  function mergeAdj(list) {
    // 合并连续调整：U U → U2，y y' → 抵消
    var amt = {}, order = [];
    list.forEach(function (m) {
      var f = m[0], q = m.length === 1 ? 1 : m[1] === '2' ? 2 : 3;
      if (order.indexOf(f) < 0) { order.push(f); amt[f] = 0; }
      amt[f] = (amt[f] + q) % 4;
    });
    var out = [];
    order.forEach(function (f) { if (amt[f]) out.push(f + ['', '', '2', "'"][amt[f]]); });
    return out;
  }
  // 宏路径 → [{adj:[...], formula:true|false}]
  function groupPath(path) {
    var groups = [], adj = [];
    path.forEach(function (m) {
      if (m.adj) adj.push(m.adj);
      else { groups.push({ adj: mergeAdj(adj), formula: m }); adj = []; }
    });
    adj = mergeAdj(adj);
    if (adj.length) groups.push({ adj: adj, formula: null });
    return groups;
  }

  var memo = { 4: {}, 5: {}, 6: {}, 7: {} };

  // ---------- 第 7 步：黄棱归位（只用 y + U 置换） ----------
  var cache7 = {};
  function plans7(s) {
    var key = ALGS.yellowEdges + '|' + relKey(s, LL_EDGE_IDX);
    if (!cache7[key]) {
      var macros = adjMacros(['y', "y'", 'y2']).concat([{ moves: P(ALGS.yellowEdges) }]);
      var found = macroSearch(s, macros, function (t) { return CM.isSolved(t); }, 60, 0);
      if (!found.length) throw new Error('yellow edges stuck');
      cache7[key] = found[0].path;
    }
    var st = s, plan = [];
    groupPath(cache7[key]).forEach(function (g) {
      if (!g.formula) return; // 只剩整体转动：不需要做
      var before = apply(st, g.adj);
      var nOK = ['B', 'R', 'F', 'L'].filter(function (f) { return before[OFF[f] + 1] === centerOf(before, f); }).length;
      var adjTxt = g.adj.length ? '整体转 ' + g.adj.join(' ') + '，' : '';
      var note = nOK === 0 ?
        '没有一条黄棱对位：' + adjTxt + '先做 1 次黄棱公式，就会出现一条对位的棱' :
        '有 1 条黄棱已经对位：' + adjTxt + '把它放在后面，做黄棱公式（另外 3 条棱轮换一次）';
      var mv = g.adj.concat(g.formula.moves);
      plan.push({ moves: mv, note: note, s: st });
      st = apply(st, mv);
    });
    return [plan];
  }

  // ---------- 第 6 步：黄角归位 ----------
  var cache6 = {};
  function cornerPositioned(s) {
    var n = 0;
    ['URF', 'UFL', 'ULB', 'UBR'].forEach(function (nm) {
      var fl = CORNER_FL[CORNER_NAMES.indexOf(nm)];
      var have = fl.map(function (k) { return s[k]; });
      if (nm.split('').every(function (f) { return have.indexOf(centerOf(s, f)) >= 0; })) n++;
    });
    return n;
  }
  var CORNER_CN = { URF: '右前', UFL: '左前', ULB: '左后', UBR: '右后' };
  var fixedCache = {};
  // 黄角公式在复原魔方上保持不动的顶层角，以及它会不会拧动其余角
  function formulaFixedCorner() {
    var a = ALGS.yellowCorners;
    if (fixedCache[a]) return fixedCache[a];
    var t = apply(CM.SOLVED, a), fixed = null, twists = false;
    CM.pieces(t).corners.forEach(function (c) {
      if (c.pos[0] !== 'U') return;
      if (c.solved) fixed = c.pos;
      else if (!c.oriented) twists = true;
    });
    fixedCache[a] = { fixed: fixed || 'URF', twists: twists };
    return fixedCache[a];
  }
  function plans6(s) {
    var key = ALGS.yellowCorners + '|' + relKey(s, LL_CORNER_IDX);
    if (!cache6[key]) {
      var macros = adjMacros(['U', "U'", 'U2', 'y', "y'", 'y2']).concat([{ moves: P(ALGS.yellowCorners) }]);
      var found = macroSearch(s, macros, function (t) { return CM.isStageSolved(t, 'yellowCorners'); }, 90, 2);
      if (!found.length) throw new Error('yellow corners stuck');
      cache6[key] = found.map(function (f) { return f.path; });
    }
    return cache6[key].map(function (path) {
      var st = s, plan = [];
      groupPath(path).forEach(function (g) {
        if (!g.formula) {
          plan.push({ moves: g.adj, note: '转 ' + g.adj.join(' ') + ' 对齐顶层：4 个黄角全部归位', s: st });
          st = apply(st, g.adj);
          return;
        }
        var before = apply(st, g.adj);
        var n = cornerPositioned(before), faceOK = CM.isStageSolved(before, 'yellowFace');
        var adjTxt = g.adj.length ? '先 ' + g.adj.join(' ') + '，' : '';
        var fx = formulaFixedCorner(), fixName = CORNER_CN[fx.fixed];
        var tw = fx.twists ? '（这个公式会把轮换的角拧歪，按提示接着做会一起拧回来）' : '';
        var note;
        if (n === 4) note = adjTxt + '4 个黄角位置都对了，但有角被拧歪：' + fixName + '角保持不动，继续做黄角公式把歪的角拧回来';
        else if (n === 1) note = adjTxt + '已对位的那个黄角放在' + fixName + '、保持不动；做黄角公式让另外 3 个角轮换' + tw;
        else note = adjTxt + '还没有对位的黄角：先做 1 次黄角公式（' + fixName + '角不动，其余 3 个角轮换），就会出现对位的角' + tw;
        var mv = g.adj.concat(g.formula.moves);
        plan.push({ moves: mv, note: note, s: st });
        st = apply(st, mv);
      });
      return plan;
    });
  }

  // ---------- 第 5 步：黄色面（Sune，按鱼形判读） ----------
  function cornerInfo(s) {
    var y = centerOf(s, 'U'), info = {};
    ['URF', 'UFL', 'ULB', 'UBR'].forEach(function (n) {
      var fl = CORNER_FL[CORNER_NAMES.indexOf(n)];
      for (var i = 0; i < 3; i++) if (s[fl[i]] === y) info[n] = n[i];
    });
    return info;
  }
  function yellowUpCount(s) {
    var c = cornerInfo(s), n = 0;
    for (var k in c) if (c[k] === 'U') n++;
    return n;
  }
  function suneRuleOK(s) {
    var c = cornerInfo(s), n = yellowUpCount(s);
    if (n === 1) return c.UFL === 'U';
    if (n === 0) return c.UFL === 'L';
    if (n === 2) return c.UFL === 'F';
    return false;
  }
  function plans5(s) {
    var out = [];
    (function rec(st, plan, depth) {
      var n = yellowUpCount(st);
      if (n === 4) { out.push(plan); return; }
      if (depth >= 4) return;
      for (var a = 0; a < 4; a++) {
        var s2 = apply(st, U_ADJ[a]);
        if (!suneRuleOK(s2)) continue;
        var turn = a ? '转 ' + U_ADJ[a] + ' ' : '';
        var note;
        if (n === 1) note = '顶面像一条「鱼」（只有 1 个角黄色朝上）：' + turn + '把这个黄角放在左前（鱼头朝左下），做 1 次 Sune';
        else if (n === 0) note = '4 个角都没有黄色朝上：' + turn + '让左前角的黄色朝向左面，做 1 次 Sune';
        else note = '有 2 个角黄色朝上：' + turn + '让左前角的黄色朝向前面，做 1 次 Sune';
        var mv = P(U_ADJ[a]).concat(P(ALGS.sune));
        rec(apply(st, mv), plan.concat([{ moves: mv, note: note, s: st }]), depth + 1);
      }
    })(s, [], 0);
    if (!out.length) throw new Error('yellow face stuck');
    var minLen = Math.min.apply(null, out.map(function (p) { return p.length; }));
    return out.filter(function (p) { return p.length <= minLen + 1; });
  }

  // ---------- 第 4 步：黄色十字 ----------
  var U_EDGE_IDX = { B: 1, L: 3, R: 5, F: 7 };
  function crossShape(s) {
    var y = centerOf(s, 'U'), e = {};
    Object.keys(U_EDGE_IDX).forEach(function (k) { e[k] = s[U_EDGE_IDX[k]] === y; });
    var n = (e.B ? 1 : 0) + (e.L ? 1 : 0) + (e.R ? 1 : 0) + (e.F ? 1 : 0);
    if (n === 4) return { kind: 'cross' };
    if (n === 0) return { kind: 'dot' };
    if (e.L && e.R) return { kind: 'line', placed: true };
    if (e.F && e.B) return { kind: 'line', placed: false };
    return { kind: 'L', placed: !!(e.B && e.L) };
  }
  function plans4(s) {
    var out = [];
    (function rec(st, plan, depth) {
      var sh = crossShape(st);
      if (sh.kind === 'cross') { out.push(plan); return; }
      if (depth >= 4) return;
      for (var a = 0; a < 4; a++) {
        var s2 = apply(st, U_ADJ[a]);
        if (sh.kind !== 'dot' && !crossShape(s2).placed) continue;
        var turn = a ? '转 ' + U_ADJ[a] + ' ' : '';
        var note;
        if (sh.kind === 'dot') note = '黄面只有中心一个点（没有黄棱朝上）：' + (a ? '转 ' + U_ADJ[a] + ' 后' : '直接') + "做 1 次 F R U R' U' F'，会先变成 L 形";
        else if (sh.kind === 'L') note = '黄面是 L 形：' + turn + "把 L 的两个黄棱放在左后（后面和左面），做 F R U R' U' F'";
        else note = '黄面是一字形：' + turn + "让一字横放（左右方向），做 F R U R' U' F' 得到黄十字";
        var mv = P(U_ADJ[a]).concat(P(ALGS.yellowCross));
        rec(apply(st, mv), plan.concat([{ moves: mv, note: note, s: st }]), depth + 1);
      }
    })(s, [], 0);
    if (!out.length) throw new Error('yellow cross stuck');
    var minLen = Math.min.apply(null, out.map(function (p) { return p.length; }));
    return out.filter(function (p) { return p.length <= minLen; });
  }

  var PLANS = { 4: plans4, 5: plans5, 6: plans6, 7: plans7 };
  // 从第 k 步开始到复原的最少步数，以及第 k 步的最佳方案
  function bestFrom(k, s) {
    var key = ALGS.yellowCross + ALGS.sune + ALGS.yellowCorners + ALGS.yellowEdges + '|' + relKey(s, LL_IDX);
    if (memo[k][key] !== undefined) return memo[k][key];
    var best = null;
    PLANS[k](s).forEach(function (plan, idx) {
      var end = apply(s, planMoves(plan));
      var tail = k < 7 ? bestFrom(k + 1, end).cost : 0;
      var c = planCost(plan) + tail;
      if (!best || c < best.cost) best = { cost: c, idx: idx };
    });
    memo[k][key] = best;
    return best;
  }
  function llStage(k) {
    return function (s) {
      var plans = PLANS[k](s);
      var b = bestFrom(k, s);
      var plan = plans[b.idx], steps = [];
      plan.forEach(function (p) { steps.push(step(p.moves, p.note, null, p.s)); });
      return { steps: steps, state: apply(s, planMoves(plan)) };
    };
  }
  var solveYellowCross = llStage(4), solveYellowFace = llStage(5), solveYellowCorners = llStage(6), solveYellowEdges = llStage(7);

  var STAGE_FN = {
    cross: solveCross,
    corners: solveCorners,
    middle: solveMiddle,
    yellowCross: solveYellowCross,
    yellowFace: solveYellowFace,
    yellowCorners: solveYellowCorners,
    yellowEdges: solveYellowEdges
  };

  function whiteDownMoves(s) {
    var c = CM.centers(s);
    if (c.D === 'W') return [];
    return P({ U: 'x2', B: 'x', F: "x'", R: 'z', L: "z'" }[FACES.filter(function (f) { return c[f] === 'W'; })[0]]);
  }

  function solveStage(state, stageId) {
    var idx = CM.STAGES.indexOf(stageId);
    if (idx < 0) throw new Error('未知阶段: ' + stageId);
    if (!CM.isValid(state)) throw new Error('状态不合法');
    if (idx > 0 && !CM.isStageSolved(state, CM.STAGES[idx - 1])) throw new Error('前一阶段尚未完成: ' + CM.STAGES[idx - 1]);
    var steps = [];
    var flip = whiteDownMoves(state);
    if (flip.length) {
      steps.push({ moves: flip, note: '先整体翻转魔方，让白色中心朝下（之后全程白色在下）', target: null, highlight: 'face:D' });
      state = apply(state, flip);
    }
    if (CM.isStageSolved(state, stageId)) return { steps: steps, state: state };
    var r = STAGE_FN[stageId](state);
    return { steps: steps.concat(r.steps), state: r.state };
  }

  function solve(state) {
    if (!CM.isValid(state)) return { ok: false, error: '状态不合法', stages: [], total: 0, moves: [] };
    var stages = [], all = [], s = state;
    CM.STAGES.forEach(function (id) {
      var r;
      if (CM.isStageSolved(s, id)) r = { steps: [], state: s };
      else r = solveStage(s, id);
      r.steps.forEach(function (st) { all = all.concat(st.moves); });
      stages.push({ id: id, title: STAGE_TITLES[id], steps: r.steps, state: r.state });
      s = r.state;
    });
    return { ok: CM.isSolved(s), stages: stages, total: all.length, moves: all, state: s };
  }

  // 当前状态的下一步提示：从已达标的最高阶段之后开始
  function hint(state) {
    var r = solve(state);
    if (!r.ok) return null;
    for (var i = 0; i < r.stages.length; i++) {
      if (r.stages[i].steps.length) return { stage: r.stages[i].id, title: r.stages[i].title, step: r.stages[i].steps[0] };
    }
    return null;
  }

  return {
    ALGS: ALGS,
    STAGE_TITLES: STAGE_TITLES,
    solve: solve,
    solveStage: solveStage,
    hint: hint
  };
})(typeof module !== 'undefined' && module.exports ? require('./cube-model.js') : window.CubeModel);

if (typeof module !== 'undefined' && module.exports) module.exports = CubeSolver; else window.CubeSolver = CubeSolver;
