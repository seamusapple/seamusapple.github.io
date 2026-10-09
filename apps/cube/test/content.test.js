/*
 * 内容自测：node apps/cube/test/content.test.js
 * 用真实 CubeModel 校验 lessons.js：公式卡/案例能复原、脚本记号合法、公式与求解器一致、高亮选择器可被 cube-3d 识别。
 * 无测试框架；任何失败 → 非零退出码。
 */
'use strict';
var path = require('path');
var CM = require(path.join(__dirname, '../js/cube-model.js'));
var CS = require(path.join(__dirname, '../js/solver.js'));
var LESSONS = require(path.join(__dirname, '../js/lessons.js'));

var passed = 0, failed = 0, notes = [];
function check(cond, msg) {
  if (cond) { passed++; return true; }
  failed++; console.log('  FAIL ' + msg); return false;
}
function norm(s) { return String(s || '').trim().split(/\s+/).join(' '); }
function rep(alg, n) { var a = []; for (var i = 0; i < n; i++) a.push(alg); return a.join(' '); }
function setupState(setup) {
  if (!setup || setup === 'solved') return CM.SOLVED;
  if (/^[WYGBOR]{54}$/.test(setup)) return setup;
  return CM.apply(CM.SOLVED, setup);
}
function legal(alg) { try { CM.parse(alg); return true; } catch (e) { return false; } }

// cube-3d.js 的 highlight 支持：'centers'、'face:X'、'layer:X'、1–3 个面字母（单字母 = 该面中心块，2 = 棱，3 = 角）
var FACE = 'UDFBRL', OPP = { U: 'D', D: 'U', F: 'B', B: 'F', R: 'L', L: 'R' };
function validSel(sel) {
  if (sel === 'centers') return true;
  if (/^(face|layer):[UDFBRL]$/.test(sel)) return true;
  if (!/^[UDFBRL]{1,3}$/.test(sel)) return false;
  var fs = sel.split('');
  for (var i = 0; i < fs.length; i++) for (var j = i + 1; j < fs.length; j++) {
    if (fs[i] === fs[j] || OPP[fs[i]] === fs[j]) return false; // 'UD'、'UU' 不是一个块
  }
  return true;
}
function checkHl(hl, where) {
  if (hl == null) return;
  [].concat(hl).forEach(function (s) { check(validSel(String(s)), where + ' 高亮选择器不支持: ' + s); });
}

// 有意不复原的中间态：说明里写了「先做一次 / 再判读 / 再做」之类，或 setup 来自 *0 / 「点」「L 形」这类需多次判读的情形
var UNSOLVED_OK = /再判读|重新判读|再按下面|随便|先做一次|得到一字|会得到|变成|再看|再做/;

console.log('# 公式卡与案例');
var cards = 0;
LESSONS.forEach(function (ch) {
  (ch.sections || []).forEach(function (sec, si) {
    var items = [];
    if (sec.type === 'alg') items.push({ alg: sec.moves, setup: sec.setup, repeat: sec.repeat, hl: sec.hl, name: sec.name, desc: sec.desc });
    if (sec.type === 'cases') sec.items.forEach(function (it) { if (it.alg) items.push(it); else checkHl(it.hl, ch.num + ' 静态案例'); });
    items.forEach(function (it) {
      cards++;
      var where = ch.num + ' 「' + (it.name || '') + '」';
      if (!check(legal(it.alg), where + ' 公式含非法记号: ' + it.alg)) return;
      if (it.setup && !check(legal(it.setup) || /^[WYGBOR]{54}$/.test(it.setup), where + ' setup 非法: ' + it.setup)) return;
      checkHl(it.hl, where);
      var n = it.repeat && it.repeat > 1 ? it.repeat : 1;
      var end = CM.apply(setupState(it.setup), rep(it.alg, n));
      check(CM.isValid(end), where + ' 结束态 isValid');
      if (CM.isSolved(end)) { passed++; return; }
      var text = (it.name || '') + ' ' + (it.desc || '');
      if (!it.setup && CM.parse(it.alg).length === 1) { passed++; return; } // 记号章：从复原态演示单个记号
      if (UNSOLVED_OK.test(text)) { notes.push(where + ' 有意不复原（' + text.replace(/<[^>]+>/g, '').slice(0, 30) + '…）'); passed++; return; }
      check(false, where + ' setup + 公式×' + n + ' 后未复原');
    });
  });
});
console.log('  共 ' + cards + ' 张可播放卡');
notes.forEach(function (n) { console.log('  · ' + n); });

console.log('# 自动讲解脚本');
var lines = 0;
LESSONS.forEach(function (ch) {
  var s = CM.SOLVED;
  (ch.script || []).forEach(function (st, i) {
    lines++;
    var where = ch.num + ' script[' + i + ']';
    check(typeof st.say === 'string' && st.say.length > 0, where + ' 缺 say');
    if (st.setup != null) {
      if (check(st.setup === 'solved' || legal(st.setup) || /^[WYGBOR]{54}$/.test(st.setup), where + ' setup 非法: ' + st.setup)) s = setupState(st.setup);
    }
    if (st.look != null) check(['front', 'bottom', 'top', 'back'].indexOf(st.look) >= 0, where + ' look 非法: ' + st.look);
    checkHl(st.hl, where);
    if (st.do != null) {
      if (check(legal(st.do), where + ' do 非法: ' + st.do)) s = CM.apply(s, st.do);
    }
    check(CM.isValid(s), where + ' 状态 isValid');
    if (st.wait != null) check(typeof st.wait === 'number' && st.wait >= 0, where + ' wait 非数字');
  });
});
console.log('  共 ' + lines + ' 句');

console.log('# LESSONS.ALGS 与 CubeSolver.ALGS 一致');
var MAP = { sexy: 'rightHand', sexyL: 'leftHand', midR: 'middleRight', midL: 'middleLeft', yCross: 'yellowCross', sune: 'sune', yCorners: 'yellowCorners', yEdges: 'yellowEdges' };
check(Object.keys(LESSONS.ALGS).length === 8, 'LESSONS.ALGS 应有 8 条，实际 ' + Object.keys(LESSONS.ALGS).length);
Object.keys(MAP).forEach(function (k) {
  check(norm(LESSONS.ALGS[k]) === norm(CS.ALGS[MAP[k]]), 'ALGS.' + k + ' 不一致: "' + LESSONS.ALGS[k] + '" vs "' + CS.ALGS[MAP[k]] + '"');
});

console.log('# 章节结构');
check(LESSONS.length === 12, '应有 12 章');
LESSONS.forEach(function (ch, i) {
  check(ch.num === (i < 10 ? '0' : '') + i, '章号顺序 ' + ch.num);
  if (ch.stage) check(CM.STAGES.indexOf(ch.stage) >= 0, ch.num + ' stage 非法');
  (ch.sections || []).forEach(function (sec) {
    if (sec.type === 'practice') check(sec.stage === 'full' || CM.STAGES.indexOf(sec.stage) >= 0, ch.num + ' practice stage 非法: ' + sec.stage);
  });
});

console.log('\n通过 ' + passed + '，失败 ' + failed);
process.exit(failed ? 1 : 0);
