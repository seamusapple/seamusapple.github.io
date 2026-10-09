/*
 * 引擎自测：node apps/cube/test/engine.test.js
 * 无测试框架；任何失败 → 非零退出码。
 */
'use strict';
var path = require('path');
var CM = require(path.join(__dirname, '../js/cube-model.js'));
var CS = require(path.join(__dirname, '../js/solver.js'));

var passed = 0, failed = 0, currentGroup = '';
function group(name) { currentGroup = name; console.log('\n# ' + name); }
function check(cond, msg) {
  if (cond) { passed++; return true; }
  failed++;
  console.log('  FAIL [' + currentGroup + '] ' + msg);
  return false;
}
function eq(a, b, msg) { return check(a === b, msg + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')'); }
function throws(fn, msg) { try { fn(); } catch (e) { return check(true, msg); } return check(false, msg + ' (did not throw)'); }

// 固定种子的 PRNG（mulberry32），保证可复现
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function rep(alg, n) { var a = []; for (var i = 0; i < n; i++) a = a.concat(CM.parse(alg)); return a; }
var S = CM.SOLVED;
// 54 个互不相同的标签，用来追踪单个贴纸
var LABELS = ''; for (var i = 0; i < 54; i++) LABELS += String.fromCharCode(0x4E00 + i);

// ---------------------------------------------------------------------------
group('基础：常量、parse、invert');
eq(S, 'YYYYYYYYYOOOOOOOOOGGGGGGGGGWWWWWWWWWRRRRRRRRRBBBBBBBBB', 'SOLVED 串');
eq(CM.MOVES.length, 27, 'MOVES 共 27 个');
['U', "U'", 'U2', 'D', 'F', 'B', 'R', 'L', 'x', "y'", 'z2'].forEach(function (m) { check(CM.MOVES.indexOf(m) >= 0, 'MOVES 含 ' + m); });
eq(JSON.stringify(CM.parse("R U R' U'")), JSON.stringify(['R', 'U', "R'", "U'"]), 'parse 基本');
eq(JSON.stringify(CM.parse('  R   U2 ')), JSON.stringify(['R', 'U2']), 'parse 多空格');
eq(CM.parse('').length, 0, 'parse 空串');
throws(function () { CM.parse('R M'); }, 'parse 非法记号 M 抛错');
throws(function () { CM.parse("R2'"); }, "parse 非法记号 R2' 抛错");
throws(function () { CM.parse('r'); }, 'parse 非法记号 r 抛错');
eq(CM.invert("R U R' U'").join(' '), "U R U' R'", 'invert');
eq(CM.invert(['F2', "x'", 'y']).join(' '), "y' x F2", 'invert 数组');
var s0 = S; CM.apply(s0, 'R'); eq(s0, S, 'apply 不改入参');

// ---------------------------------------------------------------------------
group('转动置换：几何性质');
CM.MOVES.forEach(function (m) {
  var perm = CM.PERM[m], seen = {};
  perm.forEach(function (x) { seen[x] = 1; });
  check(Object.keys(seen).length === 54, m + ' 是 54 元置换');
  eq(CM.apply(LABELS, [m, m, m, m]), LABELS, m + ' 做 4 次回原样');
  var b = m[0];
  eq(CM.apply(LABELS, [b + '2']), CM.apply(LABELS, [b, b]), b + '2 = ' + b + ' ' + b);
  eq(CM.apply(LABELS, [b + "'"]), CM.apply(LABELS, [b, b, b]), b + "' = " + b + ' ×3');
});
['U', 'D', 'F', 'B', 'R', 'L'].forEach(function (f) {
  var t = CM.apply(LABELS, f), moved = 0;
  for (var i = 0; i < 54; i++) if (t[i] !== LABELS[i]) moved++;
  eq(moved, 20, f + ' 移动 20 个贴纸（8 面上 + 12 侧边）');
  eq(t[{ U: 4, R: 13, F: 22, D: 31, L: 40, B: 49 }[f]], LABELS[{ U: 4, R: 13, F: 22, D: 31, L: 40, B: 49 }[f]], f + ' 不动中心');
});
eq(CM.apply(S, rep("R U R' U'", 6)), S, "(R U R' U') ×6 回原样");
check(CM.apply(S, rep("R U R' U'", 3)) !== S, "(R U R' U') ×3 不是原样");
eq(CM.apply(S, rep('R U', 105)), S, '(R U) ×105 回原样');
[15, 21, 35].forEach(function (k) { check(CM.apply(S, rep('R U', k)) !== S, '(R U) ×' + k + ' 不是原样（阶恰好 105）'); });
eq(CM.apply(S, "R U R' U' U R U' R'"), S, '公式与逆公式抵消');

// x/y/z 与「两侧面 + 中层」一致：除中层外，x 与 R L' 对每个贴纸作用相同
function sliceAgree(whole, faces, axis) {
  var a = CM.apply(LABELS, whole), b = CM.apply(LABELS, faces), ok = true;
  for (var i = 0; i < 54; i++) {
    var g = CM.GEOMETRY[i];
    if (g.p[axis] === 0) continue; // 中层
    if (a[i] !== b[i]) ok = false;
  }
  return ok;
}
check(sliceAgree('x', "R L'", 0), "x 在 R/L 层上与 R L' 一致");
check(sliceAgree('y', "U D'", 1), "y 在 U/D 层上与 U D' 一致");
check(sliceAgree('z', "F B'", 2), "z 在 F/B 层上与 F B' 一致");
eq(JSON.stringify(CM.centers(CM.apply(S, 'x'))), JSON.stringify({ U: 'G', R: 'O', F: 'W', D: 'B', L: 'R', B: 'Y' }), 'x 之后中心 U:G F:W D:B B:Y');
eq(JSON.stringify(CM.centers(CM.apply(S, 'y'))), JSON.stringify({ U: 'Y', R: 'B', F: 'O', D: 'W', L: 'G', B: 'R' }), 'y 之后中心 F:O R:B L:G B:R');
eq(JSON.stringify(CM.centers(CM.apply(S, 'z'))), JSON.stringify({ U: 'R', R: 'Y', F: 'G', D: 'O', L: 'W', B: 'B' }), 'z 之后中心 R:Y D:O L:W U:R');
// 方向：U 顺时针（从上看）把前面的贴纸送到左面；R 把前面送到上面；F 把上面送到右面
var tU = CM.apply(LABELS, 'U');
eq(tU.slice(36, 39), LABELS.slice(18, 21), 'U：F 顶行 → L 顶行');
var tR = CM.apply(LABELS, 'R');
eq(tR[2] + tR[5] + tR[8], LABELS[20] + LABELS[23] + LABELS[26], 'R：F 右列 → U 右列');
var tF = CM.apply(LABELS, 'F');
eq(tF[9] + tF[12] + tF[15], LABELS[6] + LABELS[7] + LABELS[8], 'F：U 底行(6,7,8) → R 左列(9,12,15)');
eq(tF[29] + tF[28] + tF[27], LABELS[9] + LABELS[12] + LABELS[15], 'F：R 左列 → D 顶行（反向）');
var sF = CM.apply(S, 'F');
eq(sF.slice(6, 9), 'RRR', 'F 后 U 面底行变成红（来自 L）');
eq(sF[9] + sF[12] + sF[15], 'YYY', 'F 后 R 面左列变成黄（来自 U 底行）');
eq(CM.apply(S, 'D').slice(24, 27), 'RRR', 'D：L 底行 → F 底行');
eq(CM.apply(S, 'L').slice(0, 9)[0] + CM.apply(S, 'L')[3] + CM.apply(S, 'L')[6], 'BBB', 'L：B 面 → U 左列');
eq(CM.apply(S, 'B').slice(0, 3), 'OOO', 'B：R 面 → U 顶行');

// ---------------------------------------------------------------------------
group('isSolved / isValid / scramble');
check(CM.isSolved(S), 'SOLVED 已复原');
['x', 'y2', "z'", "x y z'"].forEach(function (a) { check(CM.isSolved(CM.apply(S, a)), a + ' 整体转动后仍算复原'); });
check(!CM.isSolved(CM.apply(S, 'R')), 'R 后未复原');
check(CM.isValid(S), 'SOLVED 合法');
['x', "y z2", "x' y"].forEach(function (a) { check(CM.isValid(CM.apply(S, a)), a + ' 后合法'); });
function setAt(s, idxs, chars) { var a = s.split(''); idxs.forEach(function (k, i) { a[k] = chars[i]; }); return a.join(''); }
check(!CM.isValid(setAt(S, [8, 9, 20], [S[9], S[20], S[8]])), '单角拧转非法');
check(!CM.isValid(setAt(S, [7, 19], [S[19], S[7]])), '单棱翻转非法');
check(!CM.isValid(setAt(S, [7, 19, 5, 10], [S[5], S[10], S[7], S[19]])), '两棱对换（奇偶不符）非法');
check(!CM.isValid(setAt(S, [0], ['W'])), '颜色数量不对非法');
check(!CM.isValid(setAt(S, [13, 40], ['R', 'O'])), '中心镜像（左右中心对调）非法');
check(!CM.isValid(S.slice(1)), '长度不对非法');
var rngS = mulberry32(7), okScr = true, okRule = true;
for (var k = 0; k < 200; k++) {
  var sc = CM.scramble(25, rngS);
  if (sc.moves.length !== 25 || !CM.isValid(sc.state) || sc.state !== CM.apply(S, sc.moves)) okScr = false;
  for (var j = 1; j < sc.moves.length; j++) {
    var a1 = sc.moves[j][0], a0 = sc.moves[j - 1][0];
    if (a1 === a0) okRule = false;
    var AX = { U: 0, D: 0, F: 1, B: 1, R: 2, L: 2 };
    if (j > 1 && a1 === sc.moves[j - 2][0] && AX[a0] === AX[a1]) okRule = false; // R L R
    if ('xyz'.indexOf(a1) >= 0) okRule = false;
  }
}
check(okScr, 'scramble 返回 25 步、合法、state 与 moves 一致');
check(okRule, 'scramble 相邻不同面、不与对面来回、无整体转动');
eq(CM.scramble(10, mulberry32(1)).moves.join(' '), CM.scramble(10, mulberry32(1)).moves.join(' '), 'scramble 同种子可复现');
eq(CM.scramble(undefined, mulberry32(3)).moves.length, 25, 'scramble 默认 25 步');

// ---------------------------------------------------------------------------
group('pieces');
var pc = CM.pieces(S);
eq(pc.edges.length, 12, '12 棱');
eq(pc.corners.length, 8, '8 角');
check(pc.edges.concat(pc.corners).every(function (p) { return p.oriented && p.solved && p.home === p.pos; }), 'SOLVED 全部朝向正确、就位');
var uf = pc.edges.filter(function (e) { return e.pos === 'UF'; })[0];
eq(uf.colors, 'YG', 'UF 颜色 YG');
eq(uf.id, 'YG', 'UF id 按 WYGBOR 排序');
var dfr = pc.corners.filter(function (e) { return e.pos === 'DFR'; })[0];
eq(dfr.colors, 'WGO', 'DFR 颜色 WGO'); eq(dfr.id, 'WGO', 'DFR id');
var pR = CM.pieces(CM.apply(S, 'R'));
var ur = pR.edges.filter(function (e) { return e.pos === 'UR'; })[0];
eq(ur.colors, 'GO', 'R 后 UR 位置是绿-橙棱（U 面显示绿）');
eq(ur.home, 'FR', 'R 后 UR 上的块应在 FR'); eq(ur.oriented, true, 'R 不翻棱');
var pF = CM.pieces(CM.apply(S, 'F'));
check(pF.edges.filter(function (e) { return 'UF FR DF FL'.indexOf(e.pos) >= 0; }).every(function (e) { return !e.oriented; }), 'F 翻转前层 4 棱');
check(pF.corners.filter(function (c) { return c.pos === 'URF'; })[0].oriented === false, 'F 拧转 URF 角');
var pids = {}; CM.pieces(CM.scramble(25, mulberry32(9)).state).edges.forEach(function (e) { pids[e.id] = 1; });
eq(Object.keys(pids).length, 12, '打乱后 12 个棱 id 互不相同');

// ---------------------------------------------------------------------------
group('阶段判定 isStageSolved / stageProgress');
eq(CM.STAGES.join(','), 'cross,corners,middle,yellowCross,yellowFace,yellowCorners,yellowEdges', 'STAGES');
CM.STAGES.forEach(function (st) { check(CM.isStageSolved(S, st), 'SOLVED 满足 ' + st); });
eq(CM.stageProgress(S), 6, 'SOLVED 进度 6');
var ROT = ['', 'y', 'x', 'x2', "z'", "x y", "z2 y'", "x' z"];
function progAll(alg, want) {
  ROT.forEach(function (r) { eq(CM.stageProgress(CM.apply(CM.apply(S, alg), r)), want, '"' + alg + '" 再整体转 "' + r + '" 后进度'); });
}
progAll('U', 4);                       // 顶层错开：黄面完整，但角块不对位
progAll("R U R' U'", 0);               // 十字仍在，底角被破坏
progAll("U R U' R' U' F' U F", 1);     // 中层被破坏
progAll("F R U R' U' F'", 2);          // 前两层完好、黄十字被打乱
progAll("R U R' U R U2 R'", 3);        // Sune：黄十字还在，黄面被打乱
progAll("R U' R U R U R U' R' U' R2", 5); // U 置换：只差棱
progAll('F', -1);
check(!CM.isStageSolved(CM.apply(S, 'F'), 'cross'), 'F 破坏十字');
throws(function () { CM.isStageSolved(S, 'nope'); }, '未知阶段抛错');
check(CM.isStageSolved(CM.apply(S, "y' x2"), 'yellowEdges'), '白色朝上（x2）也能判定全部复原');

// ---------------------------------------------------------------------------
group('求解器：固定种子 300 个随机打乱');
// 教程公式（写死在测试里，防止求解器悄悄换公式）
var ALLOWED = {
  corners: ["R U R' U'", "L' U' L U"],
  middle: ["U R U' R' U' F' U F", "U' L' U L U F U' F'"],
  yellowCross: ["F R U R' U' F'"],
  yellowFace: ["R U R' U R U2 R'"],
  yellowCorners: ["R' F R' B2 R F' R' B2 R2"],
  yellowEdges: ["R U' R U R U R U' R' U' R2"]
};
eq(CS.ALGS.yellowCorners, "R' F R' B2 R F' R' B2 R2", '黄角公式为 A 置换');
(function () {
  var t = CM.apply(S, CS.ALGS.yellowCorners);
  check(CM.isStageSolved(t, 'yellowFace'), '黄角公式不拧角：做完黄面仍完整');
  var moved = CM.pieces(t).corners.filter(function (c) { return !c.solved; }).map(function (c) { return c.pos; });
  eq(moved.sort().join(','), 'UBR,ULB,URF', '黄角公式：左前角(UFL)不动，其余 3 角轮换');
})();
var ADJ = { U: 1, "U'": 1, U2: 1, D: 1, "D'": 1, D2: 1, y: 1, "y'": 1, y2: 1 };
// 一步 = 若干 U/D/y 调整 + 某个教程公式重复 n 次（也允许纯调整）
function stepLegal(stage, moves) {
  if (stage === 'cross') return moves.every(function (m) { return 'UDFBRL'.indexOf(m[0]) >= 0; });
  // 调整前缀长度不定（公式本身可能以 U 开头），逐个切分点尝试
  for (var i = 0; i <= moves.length; i++) {
    if (i > 0 && !ADJ[moves[i - 1]]) break;
    var rest = moves.slice(i);
    if (!rest.length) return true;
    var hit = ALLOWED[stage].some(function (alg) {
      var a = CM.parse(alg);
      if (rest.length % a.length) return false;
      for (var k = 0; k < rest.length; k++) if (rest[k] !== a[k % a.length]) return false;
      return true;
    });
    if (hit) return true;
  }
  return false;
}
var rng = mulberry32(20261010);
var N = 300, totals = [], faceTurns = [], allOk = true, stageOk = true, validOk = true, legalOk = true, crossLenOk = true;
var perStage = {}, failures = 0, t0 = Date.now();
CM.STAGES.forEach(function (s) { perStage[s] = []; });
for (var n = 0; n < N; n++) {
  var scr = CM.scramble(25, rng);
  var res = CS.solve(scr.state);
  if (!res.ok) { allOk = false; failures++; console.log('  unsolved: ' + scr.moves.join(' ')); continue; }
  var st = scr.state, cnt = 0, ft = 0;
  res.stages.forEach(function (stage) {
    var c = 0;
    stage.steps.forEach(function (stp) {
      if (!stepLegal(stage.id, stp.moves)) { legalOk = false; console.log('  illegal step in ' + stage.id + ': ' + stp.moves.join(' ')); }
      if (stage.id === 'cross' && stp.moves.length > 8) crossLenOk = false;
      if (typeof stp.note !== 'string' || !stp.note) legalOk = false;
      stp.moves.forEach(function (m) {
        st = CM.apply(st, [m]);
        if (!CM.isValid(st)) validOk = false;
        if ('xz'.indexOf(m[0]) >= 0) legalOk = false;
        if ('xyz'.indexOf(m[0]) < 0) ft++;
      });
      c += stp.moves.length;
    });
    cnt += c;
    perStage[stage.id].push(c);
    if (!CM.isStageSolved(st, stage.id)) { stageOk = false; console.log('  stage not solved: ' + stage.id + ' / ' + scr.moves.join(' ')); }
    if (stage.state !== st) stageOk = false;
  });
  if (!CM.isSolved(st)) allOk = false;
  if (cnt !== res.total || res.moves.length !== res.total) allOk = false;
  totals.push(res.total);
  faceTurns.push(ft);
}
var elapsed = Date.now() - t0;
check(allOk, N + ' 个打乱全部复原（' + failures + ' 个失败）');
check(stageOk, '每阶段结束时 isStageSolved(stage) 为真');
check(validOk, '所有中间状态 isValid');
check(legalOk, '只使用允许的记号（公式 + U/D/y 调整；无 x/z）');
check(crossLenOk, '白十字每条棱 ≤ 8 步');
function stats(a) {
  var b = a.slice().sort(function (x, y) { return x - y; });
  return { median: b[Math.floor(b.length / 2)], max: b[b.length - 1], min: b[0], avg: +(b.reduce(function (x, y) { return x + y; }, 0) / b.length).toFixed(1) };
}
var ts = stats(totals), fs = stats(faceTurns);
console.log('  总步数（含 y 整体转动）: 中位数 ' + ts.median + ' / 最大 ' + ts.max + ' / 平均 ' + ts.avg + ' / 最小 ' + ts.min);
console.log('  其中面转动（不含 y）:     中位数 ' + fs.median + ' / 最大 ' + fs.max + ' / 平均 ' + fs.avg);
CM.STAGES.forEach(function (s) { var x = stats(perStage[s]); console.log('    ' + (s + '            ').slice(0, 14) + ' 中位数 ' + x.median + '  最大 ' + x.max + '  平均 ' + x.avg); });
console.log('  耗时 ' + elapsed + ' ms（' + (elapsed / N).toFixed(1) + ' ms/个）');
check(ts.median < 150, '总步数中位数 < 150');
check(ts.max < 250, '总步数最大 < 250');

// ---------------------------------------------------------------------------
group('solveStage / hint / 特殊输入');
var rng2 = mulberry32(42), ssOk = true;
for (var q = 0; q < 30; q++) {
  var state = CM.scramble(25, rng2).state;
  CM.STAGES.forEach(function (id, idx) {
    var r = CS.solveStage(state, id);
    var t = CM.apply(state, [].concat.apply([], r.steps.map(function (x) { return x.moves; })));
    if (t !== r.state || !CM.isStageSolved(t, id)) ssOk = false;
    if (idx + 1 < CM.STAGES.length) {
      // 前一阶段没完成时应拒绝（只要下一阶段还没达标）
      if (!CM.isStageSolved(state, CM.STAGES[idx]) && idx > 0) {
        try { CS.solveStage(state, CM.STAGES[idx + 1]); ssOk = false; } catch (e) { /* ok */ }
      }
    }
    state = t;
  });
  if (!CM.isSolved(state)) ssOk = false;
}
check(ssOk, 'solveStage 逐阶段链式求解全部达标');
throws(function () { CS.solveStage(CM.scramble(25, mulberry32(5)).state, 'middle'); }, '前一阶段未完成时 solveStage 抛错');
// 已完成的阶段：空步骤
eq(CS.solveStage(S, 'cross').steps.length, 0, '已达标阶段返回空步骤');
var sol0 = CS.solve(S);
check(sol0.ok && sol0.total === 0 && sol0.stages.length === 7, 'solve(SOLVED) 0 步、7 个阶段');
eq(sol0.stages.map(function (x) { return x.title; }).join(''), '白色十字白色角块中层棱块黄色十字黄色面黄角归位黄棱归位', '阶段标题');
// 用户整体转过魔方（y / 白色朝上）也能解
var rng3 = mulberry32(99), rotOk = true;
["y", "y2 ", "x2", "z", "x' y"].forEach(function (r) {
  var st0 = CM.apply(CM.scramble(25, rng3).state, r);
  var res2 = CS.solve(st0);
  var st2 = CM.apply(st0, res2.moves);
  if (!res2.ok || !CM.isSolved(st2)) rotOk = false;
  if (r.indexOf('x') < 0 && r.indexOf('z') < 0 && res2.moves.some(function (m) { return 'xz'.indexOf(m[0]) >= 0; })) rotOk = false;
});
check(rotOk, '整体转动过的状态也能解（白色不在下时首步翻转）');
var noXZ = true, rng4 = mulberry32(555);
for (var w = 0; w < 40; w++) {
  var stw = CM.apply(CM.scramble(25, rng4).state, ['', 'y', 'y2', "y'"][w % 4]);
  var rw = CS.solve(stw);
  if (!rw.ok || rw.moves.some(function (m) { return 'xz'.indexOf(m[0]) >= 0; })) noXZ = false;
  CM.STAGES.forEach(function (id) {
    var r = CS.solveStage(stw, id);
    if (r.steps.some(function (x) { return x.moves.some(function (m) { return 'xz'.indexOf(m[0]) >= 0; }); })) noXZ = false;
    stw = r.state;
  });
}
check(noXZ, '白色已在 D 面（含 y 转过）时 solve / solveStage 输出绝无 x/z');
var bad = CS.solve(setAt(S, [7, 19], [S[19], S[7]]));
check(bad.ok === false, '非法状态 solve 返回 ok:false');
var h = CS.hint(CM.apply(S, "R U R' U'"));
check(h && h.stage === 'corners' && h.step.moves.length > 0, 'hint 返回下一步（白角阶段）');
eq(CS.hint(S), null, '已复原时 hint 为 null');
var oneSol = CS.solve(CM.scramble(25, mulberry32(2024)).state);
check(oneSol.stages[0].steps.every(function (s) { return /^把 白-/.test(s.note) && /^W[YGBOR]$/.test(s.target); }), '白十字步骤带中文说明与 target');
check(oneSol.stages[1].steps.every(function (s) { return s.target && s.target[0] === 'W' && s.target.length === 3; }), '白角步骤 target 为角块 id');

// ---------------------------------------------------------------------------
console.log('\n通过 ' + passed + '，失败 ' + failed);
process.exit(failed ? 1 : 0);
