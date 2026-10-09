/* lessons.js — 三阶魔方硬核指南的全部章节内容（纯数据 + 生成示意图 SVG 的小工具）。
 * 导出全局 LESSONS（数组，12 章）。附带：LESSONS.ALGS（全部公式，单一来源）、LESSONS.svg（net/top/iso 画图函数）。
 * 所有示意图的状态均由脚本模拟真实转动后得到（白底黄顶：U 黄 D 白 F 绿 R 橙 L 红 B 蓝）。
 * setup 约定：一串「从复原态出发要执行的转动」，执行后再播放 alg 即可演示；script 里 setup:'solved' 表示复原。 */
(function () {
  'use strict';

  // ---------- 公式（教与解必须一致，只改这里） ----------
  var A = {
    sexy: "R U R' U'",            // 右手公式（白角）
    sexyL: "L' U' L U",           // 左手公式（白角镜像）
    midR: "U R U' R' U' F' U F",  // 中层往右
    midL: "U' L' U L U F U' F'",  // 中层往左
    yCross: "F R U R' U' F'",     // 黄十字
    sune: "R U R' U R U2 R'",     // 黄面（Sune）
    yCorners: "R' F R' B2 R F' R' B2 R2", // 黄角归位（三角循环，不拧角，左前角不动）
    yEdges: "R U' R U R U R U' R' U' R2" // 黄棱归位（U 置换）
  };
  function rep(alg, n) { var a = []; for (var i = 0; i < n; i++) a.push(alg); return a.join(' '); }
  function inv(alg) {
    return alg.trim().split(/\s+/).reverse().map(function (m) {
      return m.slice(-1) === "'" ? m.slice(0, -1) : (m.slice(-1) === '2' ? m : m + "'");
    }).join(' ');
  }

  // ---------- 示意图 ----------
  var COL = { W: '#F2F2F2', Y: '#FFD500', G: '#009B48', B: '#0046AD', O: '#FF5800', R: '#B71234', '.': '#2B3242',
    c: '#4CC9F0', e: '#FFD500', m: '#F2F2F2' };
  var INK = '#0B0E14', LINE = '#3A4256', TXT = '#C9CFDB';
  var uid = 0;
  function col(c) { return COL[c] || COL['.']; }
  function f1(n) { return Math.round(n * 10) / 10; }
  var SOLVED = 'YYYYYYYYYOOOOOOOOOGGGGGGGGGWWWWWWWWWRRRRRRRRRBBBBBBBBB';
  var CENTERS = [4, 13, 22, 31, 40, 49];
  // 只保留指定格（以及 6 个中心），其余涂灰
  function keep(s, idx, noCenters) {
    var out = '';
    for (var i = 0; i < 54; i++) out += (idx.indexOf(i) >= 0 || (!noCenters && CENTERS.indexOf(i) >= 0)) ? s[i] : '.';
    return out;
  }
  function svgOpen(vb, label, cls) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '" role="img" aria-label="' + label + '" class="' + (cls || 'dia') + '">';
  }

  // 展开图（Kociemba 顺序 U R F D L B；排布：U 在 F 上，L F R B 一行，D 在 F 下）
  function net(s, o) {
    o = o || {};
    var cell = 16, pitch = 52, pad = 4;
    var place = { U: [1, 0], R: [2, 1], F: [1, 1], D: [1, 2], L: [0, 1], B: [3, 1] };
    var order = ['U', 'R', 'F', 'D', 'L', 'B'];
    var h = svgOpen('0 0 ' + (pitch * 4 + pad) + ' ' + (pitch * 3 + pad), o.label || '魔方展开图');
    order.forEach(function (f, fi) {
      var ox = pad + place[f][0] * pitch, oy = pad + place[f][1] * pitch;
      h += '<rect x="' + (ox - 2) + '" y="' + (oy - 2) + '" width="' + (cell * 3 + 2) + '" height="' + (cell * 3 + 2) + '" rx="4" fill="' + INK + '"/>';
      for (var k = 0; k < 9; k++) {
        var c = s[fi * 9 + k];
        h += '<rect x="' + (ox + (k % 3) * cell) + '" y="' + (oy + Math.floor(k / 3) * cell) + '" width="' + (cell - 2) + '" height="' + (cell - 2) + '" rx="2.5" fill="' + col(c) + '"/>';
      }
      if (o.labels) h += '<text x="' + (ox + cell * 1.5 - 1) + '" y="' + (oy + cell * 1.5 + 3.5) + '" text-anchor="middle" font-family="JetBrains Mono,ui-monospace,monospace" font-size="10" font-weight="700" fill="' + INK + '" fill-opacity=".7">' + f + '</text>';
    });
    return h + '</svg>';
  }

  // 顶视图：U 面 3×3 + 四周顶层侧贴纸。o = {u:'9 字符', b,r,f,l:'3 字符'（b/f 左→右，l/r 后→前）, arrows:[[from,to]]（U 格编号 0–8）}
  function top(o) {
    var cell = 30, pitch = 32, g = 18, st = 9, size = g * 2 + pitch * 3 - 2, id = 'ar' + (++uid);
    var h = svgOpen('0 0 ' + size + ' ' + size, o.label || '顶面示意图');
    h += '<rect x="' + (g - 3) + '" y="' + (g - 3) + '" width="' + (pitch * 3 + 4) + '" height="' + (pitch * 3 + 4) + '" rx="6" fill="' + INK + '"/>';
    for (var k = 0; k < 9; k++) {
      h += '<rect x="' + (g + (k % 3) * pitch) + '" y="' + (g + Math.floor(k / 3) * pitch) + '" width="' + cell + '" height="' + cell + '" rx="4" fill="' + col(o.u[k]) + '"/>';
    }
    for (var i = 0; i < 3; i++) {
      var p = g + i * pitch;
      h += '<rect x="' + p + '" y="' + (g - st - 5) + '" width="' + cell + '" height="' + st + '" rx="2" fill="' + col(o.b[i]) + '"/>';
      h += '<rect x="' + p + '" y="' + (g + pitch * 3 + 3) + '" width="' + cell + '" height="' + st + '" rx="2" fill="' + col(o.f[i]) + '"/>';
      h += '<rect x="' + (g - st - 5) + '" y="' + p + '" width="' + st + '" height="' + cell + '" rx="2" fill="' + col(o.l[i]) + '"/>';
      h += '<rect x="' + (g + pitch * 3 + 3) + '" y="' + p + '" width="' + st + '" height="' + cell + '" rx="2" fill="' + col(o.r[i]) + '"/>';
    }
    if (o.arrows && o.arrows.length) {
      h += '<defs><marker id="' + id + '" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4.2" markerHeight="4.2" orient="auto"><path d="M0 0L10 5L0 10z" fill="' + INK + '"/></marker></defs>';
      o.arrows.forEach(function (a) {
        var x1 = g + (a[0] % 3) * pitch + cell / 2, y1 = g + Math.floor(a[0] / 3) * pitch + cell / 2;
        var x2 = g + (a[1] % 3) * pitch + cell / 2, y2 = g + Math.floor(a[1] / 3) * pitch + cell / 2;
        var dx = x2 - x1, dy = y2 - y1, L = Math.sqrt(dx * dx + dy * dy), sh = 9;
        h += '<line x1="' + f1(x1 + dx / L * sh) + '" y1="' + f1(y1 + dy / L * sh) + '" x2="' + f1(x2 - dx / L * sh) + '" y2="' + f1(y2 - dy / L * sh) + '" stroke="' + INK + '" stroke-width="3.2" stroke-linecap="round" marker-end="url(#' + id + ')"/>';
      });
    }
    if (o.mark) o.mark.forEach(function (k) {
      h += '<circle cx="' + (g + (k % 3) * pitch + cell / 2) + '" cy="' + (g + Math.floor(k / 3) * pitch + cell / 2) + '" r="5" fill="none" stroke="' + INK + '" stroke-width="2.4"/>';
    });
    return h + '</svg>';
  }
  // 只显示黄色（其余灰），用于朝向判读；edgesOnly 时角也涂灰
  function onlyY(o, edgesOnly) {
    function m(str, isU) {
      return str.split('').map(function (c, i) {
        if (c !== 'Y') return '.';
        if (edgesOnly && isU && (i === 0 || i === 2 || i === 6 || i === 8)) return '.';
        if (edgesOnly && !isU && i !== 1) return '.';
        return c;
      }).join('');
    }
    return { u: m(o.u, true), b: m(o.b), r: m(o.r), f: m(o.f), l: m(o.l), arrows: o.arrows, mark: o.mark, label: o.label };
  }

  // 等距立体图。view 'fr' 看到 U F R；'fl' 看到 U F L。labels: 在面中心写面字母
  function iso(s, o) {
    o = o || {};
    var view = o.view || 'fr', sc = 24, c = 0.866, sn = 0.5;
    function P(x, y, z) {
      var X = view === 'fr' ? (x - z) * c : (x + z) * c;
      var Y = view === 'fr' ? -y + (x + z) * sn : -y + (z - x) * sn;
      return [f1(X * sc), f1(Y * sc)];
    }
    // 每个面：法向平面 + 由 (row,col) 得到格中心与两轴方向
    var F = {
      U: { b: 0, at: function (r, k) { return [k - 1, 1.5, r - 1]; }, rd: [0, 0, 1], cd: [1, 0, 0] },
      R: { b: 9, at: function (r, k) { return [1.5, 1 - r, 1 - k]; }, rd: [0, -1, 0], cd: [0, 0, -1] },
      F: { b: 18, at: function (r, k) { return [k - 1, 1 - r, 1.5]; }, rd: [0, -1, 0], cd: [1, 0, 0] },
      L: { b: 36, at: function (r, k) { return [-1.5, 1 - r, k - 1]; }, rd: [0, -1, 0], cd: [0, 0, 1] }
    };
    var faces = view === 'fr' ? ['U', 'F', 'R'] : ['U', 'F', 'L'];
    var hx = P(1.5, 1.5, -1.5), corners = view === 'fr'
      ? [P(-1.5, 1.5, -1.5), P(1.5, 1.5, -1.5), P(1.5, -1.5, -1.5), P(1.5, -1.5, 1.5), P(-1.5, -1.5, 1.5), P(-1.5, 1.5, 1.5)]
      : [P(-1.5, 1.5, -1.5), P(1.5, 1.5, -1.5), P(1.5, 1.5, 1.5), P(1.5, -1.5, 1.5), P(-1.5, -1.5, 1.5), P(-1.5, -1.5, -1.5)];
    void hx;
    var w = o.legend ? 230 : 160, hgt = o.legend ? 196 : 172;
    var h = svgOpen((-w / 2) + ' -86 ' + w + ' ' + hgt, o.label || '魔方立体示意图');
    h += '<polygon points="' + corners.map(function (p) { return p.join(','); }).join(' ') + '" fill="' + INK + '" stroke="' + INK + '" stroke-width="5" stroke-linejoin="round"/>';
    faces.forEach(function (f) {
      var d = F[f], e = 0.43;
      for (var r = 0; r < 3; r++) for (var k = 0; k < 3; k++) {
        var ctr = d.at(r, k), pts = [];
        [[-1, -1], [-1, 1], [1, 1], [1, -1]].forEach(function (q) {
          pts.push(P(ctr[0] + (d.rd[0] * q[0] + d.cd[0] * q[1]) * e, ctr[1] + (d.rd[1] * q[0] + d.cd[1] * q[1]) * e, ctr[2] + (d.rd[2] * q[0] + d.cd[2] * q[1]) * e).join(','));
        });
        h += '<polygon points="' + pts.join(' ') + '" fill="' + col(s[d.b + r * 3 + k]) + '" stroke="' + col(s[d.b + r * 3 + k]) + '" stroke-width="1.6" stroke-linejoin="round"/>';
      }
      if (o.labels) {
        var m = d.at(1, 1), q = P(m[0], m[1], m[2]);
        h += '<text x="' + q[0] + '" y="' + (q[1] + 5) + '" text-anchor="middle" font-family="JetBrains Mono,ui-monospace,monospace" font-size="15" font-weight="700" fill="' + INK + '">' + f + '</text>';
      }
    });
    if (o.legend) {
      var y = 96;
      o.legend.forEach(function (it, i) {
        var x = -105 + i * 74;
        h += '<rect x="' + x + '" y="' + (y - 9) + '" width="11" height="11" rx="2" fill="' + col(it[0]) + '"/><text x="' + (x + 16) + '" y="' + y + '" font-family="Noto Sans SC,PingFang SC,system-ui,sans-serif" font-size="11" fill="' + TXT + '">' + it[1] + '</text>';
      });
    }
    if (o.note) h += '<text x="0" y="' + (o.legend ? 108 : 82) + '" text-anchor="middle" font-family="Noto Sans SC,PingFang SC,system-ui,sans-serif" font-size="10" fill="' + TXT + '">' + o.note + '</text>';
    return h + '</svg>';
  }

  // 多个 SVG 横排（中间画箭头）
  function row(svgs, labels, label) {
    var w = 126, gap = 34, n = svgs.length, W = n * w + (n - 1) * gap, H = 150;
    var h = svgOpen('0 0 ' + W + ' ' + H, label || '示意图');
    svgs.forEach(function (sv, i) {
      var x = i * (w + gap);
      h += sv.replace(/^<svg /, '<svg x="' + x + '" y="0" width="' + w + '" height="' + w + '" ');
      if (labels) h += '<text x="' + (x + w / 2) + '" y="' + (w + 18) + '" text-anchor="middle" font-family="Noto Sans SC,PingFang SC,system-ui,sans-serif" font-size="13" fill="' + TXT + '">' + labels[i] + '</text>';
      if (i < n - 1) h += '<path d="M' + (x + w + 8) + ' ' + (w / 2) + 'h16m-6 -6l6 6l-6 6" fill="none" stroke="' + LINE + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
    });
    return h + '</svg>';
  }

  // ---------- 由模拟得到的状态 ----------
  var GRAY_FACE = '.........';
  function target(faces) { // faces: {U:'9',...}，缺省灰
    return ['U', 'R', 'F', 'D', 'L', 'B'].map(function (f) { return faces[f] || ('....' + { U: 'Y', R: 'O', F: 'G', D: 'W', L: 'R', B: 'B' }[f] + '....'); }).join('');
  }
  void GRAY_FACE;
  var T_CROSS = target({ R: '....O..O.', F: '....G..G.', D: '.W.WWW.W.', L: '....R..R.', B: '....B..B.' });
  var T_CORNERS = target({ R: '....O.OOO', F: '....G.GGG', D: 'WWWWWWWWW', L: '....R.RRR', B: '....B.BBB' });
  var T_MIDDLE = target({ R: '...OOOOOO', F: '...GGGGGG', D: 'WWWWWWWWW', L: '...RRRRRR', B: '...BBBBBB' });
  var S = {
    crossUp: 'YYYYYYWWWROOROOROOGGGGGGGGGYYYWWWWWWRRORRORROBBBBBBBBB',      // setup F2
    crossFront: 'OYYOYYGGYOBBOOOOOOWWGGGGGGGRRWWWWWWWYYRRRYRRYRRBBBBBBB',   // setup R' F' R U
    crossMid: 'YYYYYYOOOWOOWOOWOOGGGGGGGGGRRRWWWWWWRRYRRYRRYBBBBBBBBB',     // setup F'
    cRight: 'OGYYYYYYOWBBOOOOOOGGGGGYGGYWWGWWWWWWYRRRRRRRRROBBBBBBB',       // setup U R U' R'
    cTop: 'BYBYYYYYWGOROOOGOOGGOGGGGGOWWYWWWWWWORRRRRRRRYBYBBBBBB',         // setup (U R U' R')×3
    cFront: 'YYRYYGYYGOOYBOOYOOGGWGGYGGGWWOWWWWWWBRRRRRRRRBOOBBBBBB',       // setup R U R' U'
    cLeft: 'YGRYYYRYYOOYOOOOOOGGGYGGYGGGWWWWWWWWBBWRRRRRRBROBBBBBB',        // setup U' L' U L
    mRight: 'YYGYYRBOYOYYBOOOOOYGGGGYGGGWWWWWWWWWBGRRRRRRRROOBBBBBB',       // setup F' U' F U R U R' U'
    mLeft: 'GYYOYYYRBOGBOOOOOOGGYYGGGGGWWWWWWWWWYYRRRBRRRRROBBBBBB',        // setup F U F' U' L' U' L U
    mFlip: 'BYRYYYGBYBRGGOOOOOYYOGGOGGGWWWWWWWWWYOORRRRRRYGRBBBBBB'         // setup SET.midFlip
  };
  var TOP = {
    dot: { u: 'YOOGYBYRO', b: 'RYG', r: 'YYY', f: 'RYB', l: 'GYB' },
    L: { u: 'BYOYYGGBO', b: 'ROY', r: 'BYG', f: 'RYY', l: 'YRY' },
    line: { u: 'OGYYYYOOY', b: 'BYR', r: 'BBG', f: 'GYR', l: 'YRY' },
    cross: { u: 'YYYYYYYYY', b: 'BBB', r: 'OOO', f: 'GGG', l: 'RRR' },
    fish: { u: 'OYGYYYYYR', b: 'YRR', r: 'YBB', f: 'BGY', l: 'GOO' },
    zero: { u: 'BYBYYYGYG', b: 'ROO', r: 'YRY', f: 'RGO', l: 'YBY' },
    two: { u: 'YYRYYYBYY', b: 'GBY', r: 'GOR', f: 'OGB', l: 'ORY' },
    // 黄角：左前角已对位，其余三角需要轮换（箭头 = 公式把块送往的位置）
    corners: { u: 'YYYYYYYYY', b: 'OBO', r: 'GOR', f: 'GGB', l: 'BRR', arrows: [[2, 8], [8, 0], [0, 2]], mark: [6] },
    // 黄棱：后面整齐，其余三棱轮换
    edges: { u: 'YYYYYYYYY', b: 'BBB', r: 'ORO', f: 'GOG', l: 'RGR', arrows: [[3, 7], [7, 5], [5, 3]] },
    // 黄角：相邻双交换，转遍 4 个 U 角度对位数只有 0 / 2 / 0 / 2
    corners0: { u: 'YYYYYYYYY', b: 'OBR', r: 'BOG', f: 'OGR', l: 'BRG' }
  };
  var SET = {
    dot: "F U R U' R' U R U' R' F' U2 F U R U' R' F'",
    L: "F U R U' R' U R U' R' F'",
    line: "F U R U' R' F'",
    fish: inv(A.sune),
    zero: inv(rep(A.sune, 2)),
    two: inv(rep(A.sune, 3)),
    corners: inv(A.yCorners),
    corners0: inv(A.yCorners) + " y' " + inv(A.yCorners) + " y", // 相邻双交换：4 个 U 角度对位数 0/2/0/2
    edges: inv(A.yEdges),
    edges2: inv(rep(A.yEdges, 2)),
    edges0: "R2 U R U R' U' R' U' R' U R' y' R2 U R U R' U' R' U' R' U R' y",
    midFlip: "F' U' F U R U R' U F' U' F U R U R' U'" // 绿橙棱在右前槽但颜色反了
  };
  function code(alg) { return '<code>' + alg + '</code>'; }

  var FIG = {
    types: iso('cecemecec'.repeat(6), { label: '三类块：角、棱、中心', legend: [['c', '角块 ×8'], ['e', '棱块 ×12'], ['m', '中心 ×6']] }),
    scheme: net(SOLVED, { labels: true, label: '白底黄顶配色展开图' }),
    faces: iso(SOLVED, { labels: true, label: '面的名字：U 上 F 前 R 右', note: '看不见的三面：D 底、L 左、B 后' }),
    sexy7: iso(keep(SOLVED, [8, 20, 9, 2, 11, 0, 5, 10, 1, 23, 12, 26, 15], true), { label: "R U R' U' 只动的 7 块" }),
    cross: net(T_CROSS, { labels: true, label: '白十字目标' }),
    corners: net(T_CORNERS, { labels: true, label: '第一层目标' }),
    middle: net(T_MIDDLE, { labels: true, label: '前两层目标' }),
    yCross: row([top(onlyY(TOP.dot, true)), top(onlyY(TOP.L, true)), top(onlyY(TOP.line, true)), top(onlyY(TOP.cross, true))], ['点', 'L 形（左后）', '一字（横）', '十字'], '黄十字四种状态'),
    fish: top(onlyY({ u: TOP.fish.u, b: TOP.fish.b, r: TOP.fish.r, f: TOP.fish.f, l: TOP.fish.l, mark: [6] }), false),
    yFace: row([top(onlyY(TOP.fish)), top(onlyY(TOP.zero)), top(onlyY(TOP.two))], ['1 个朝上：鱼', '0 个朝上', '2 个朝上'], '黄面三类情况'),
    yCorners: top(TOP.corners),
    yEdges: top(TOP.edges)
  };

  // ---------- 章节 ----------
  var LESSONS = [
    // ======================= 00 =======================
    {
      id: 'intro', num: '00', title: '你为什么学不会', tagline: '不是你笨，是大多数教程让你记错了东西', stage: null,
      sections: [
        { type: 'fact', num: '43,252,003,274,489,856,000', unit: '种状态', note: '每秒试一种，要试 1.37 万亿年——约为宇宙年龄的 100 倍。' },
        { type: 'prose', html: '这个数字只说明一件事：<strong>魔方不可能靠"转着转着就好了"还原。</strong>但能还原它的人里，绝大多数并不比你聪明。他们手里有一套把一个 4.3 × 10<sup>19</sup> 的问题拆成 <strong>7 个小问题</strong>的方法——每一步只盯 1 到 4 个块，其余的块要么已经放好，要么暂时不管。' },
        { type: 'fact', num: '20', unit: '步', note: '"上帝之数"：2010 年借助谷歌约 35 CPU 年的算力证明，任何打乱最多 20 步（半圈记 1 步）即可还原。我们要学的方法一般需要 100–150 步：它为人脑好记而设计，不为步数最少。' },
        { type: 'callout', kind: 'warn', title: '看了好几遍还不会，通常是这三个原因', html: '<ol><li><strong>背公式，不看块。</strong>公式只在魔方处于特定情况时有用。你记住了"做什么"，却没学会"什么时候做"、"做完应该看到什么"。</li><li><strong>不认识块。</strong>魔方不是 54 张贴纸，而是 26 个塑料块。"把白色贴纸弄到底面"是错误目标；"把白绿棱块放进白中心和绿中心之间"才是正确目标。</li><li><strong>不知道公式在干什么。</strong>一条公式看上去把魔方搅得稀烂，最后只改了 3 个块。如果你不知道它保护了哪些块，你就不会信任它，一出错就慌，然后从头再来。</li></ol>' },
        { type: 'prose', html: '这套教程按相反的顺序来：先认识块（01），再学记号（02），再弄清楚<em>公式为什么只动少数几块</em>（03）——然后才是 7 个步骤。每一步都是同一个结构：目标 → 判读 → 公式 → 为什么有效 → 练习 → 常见错误。' },
        { type: 'steps', items: ['白色十字：底面 4 条白棱归位', '白色角块：完成第一层', '中层棱块：完成前两层', '黄色十字：顶面 4 条棱黄色朝上', '黄色面：顶面全黄', '黄角归位：4 个顶角到正确位置', '黄棱归位：全部复原'] },
        { type: 'callout', kind: 'tip', title: '一个承诺', html: '整套方法只用 <strong>8 条公式</strong>，最长 11 步，其中两对互为镜像。每条公式你都会在左边的 3D 魔方上逐步看到它"拿起了什么、放回了什么"。学完第 10 章，你能独立还原任意打乱的魔方——不是靠记忆，是靠判读。' },
        { type: 'callout', kind: 'why', title: '为什么全程"白底黄顶"', html: '很多教程先在顶面拼白十字，拼完再把魔方翻过来。我们从第一步起就让<strong>白色朝下、黄色朝上</strong>：之后每一步你都看着顶面和前面操作，不需要翻转魔方，也就不会在翻转时弄丢"哪面是前"。' }
      ],
      script: [
        { say: '这是一个复原的魔方。', setup: 'solved', look: 'front', wait: 1600 },
        { say: '随手转 20 下，它就面目全非。', do: "R U F' L D2 B R' U2 F D' L2 U R2 F' B D R U' L F2" },
        { say: '它一共有 4325 京种可能的状态。', wait: 2600 },
        { say: '每秒试一种，要 1.37 万亿年。', wait: 2400 },
        { say: '所以还原不能靠运气，只能靠方法。', wait: 2200 },
        { say: '方法的核心：把大问题拆成 7 个小问题。', setup: 'solved', wait: 2200 },
        { say: '第一步只管底面 4 条白棱。', hl: ['DF', 'DR', 'DB', 'DL'], look: 'bottom', wait: 2400 },
        { say: '最后一步只管顶层 3 条棱。', hl: ['UF', 'UR', 'UL'], look: 'front', wait: 2400 },
        { say: '每一步只动少数块，其余的被公式保护。', hl: [], wait: 2400 },
        { say: '先从认识这些块开始。', wait: 1800 }
      ]
    },

    // ======================= 01 =======================
    {
      id: 'anatomy', num: '01', title: '魔方的解剖', tagline: '26 个块，不是 54 张贴纸', stage: null,
      sections: [
        { type: 'fact', num: '6 + 12 + 8', unit: '= 26 块', note: '6 个中心块、12 个棱块、8 个角块。正中间没有第 27 块，只有一个六向十字轴。' },
        { type: 'figure', svg: FIG.types, caption: '三类块：角块 3 种颜色，棱块 2 种颜色，中心块 1 种颜色。' },
        { type: 'prose', html: '<strong>中心块固定在轴上，彼此之间永远不会移动。</strong>不管怎么转，白中心的对面永远是黄，绿对蓝，红对橙。所以"这一面最终应该是什么颜色"不用猜：看中心就知道。' },
        { type: 'callout', kind: 'why', title: '为什么一个块只会去同类的位置', html: '任何一次转动，都只是把一层 9 个块绕轴转 90°。在角上的块转完还在角上，在棱上的还在棱上。所以 8 个角块只在 8 个角位之间轮换，12 个棱块只在 12 个棱位之间轮换。这一条直接砍掉一半困惑：找"白绿棱"时，你只需要扫 12 个棱位，不用看角。' },
        { type: 'prose', html: '块的身份由它的<strong>颜色组合</strong>决定，不由它现在在哪儿。一个白-绿-橙角块只有一个归宿：白、绿、橙三个中心交汇的那个角。从现在起，请用"白绿棱"、"白绿橙角"来称呼块，而不是"那个白色贴纸"——前者告诉你目的地，后者什么也没说。' },
        { type: 'figure', svg: FIG.scheme, caption: '本教程的配色（白底黄顶）：U 黄、D 白、F 绿、R 橙、L 红、B 蓝。' },
        { type: 'callout', kind: 'tip', title: '你的魔方只要白下黄上就行', html: '标准魔方的配色关系都一样：白对黄、绿对蓝、红对橙。只要你把<strong>白色朝下、黄色朝上</strong>，前面是绿、红、蓝、橙都无所谓——所有判读规则和公式完全通用。图里固定绿色朝前，只是为了说话方便。' },
        { type: 'quiz', q: '一个角块上有几种颜色？', options: ['1 种', '2 种', '3 种', '4 种'], answer: 2, explain: '角块处在三个面的交汇处，所以有 3 种颜色；棱块在两个面之间，2 种；中心块 1 种。' },
        { type: 'quiz', q: '红色中心的对面是什么颜色？', options: ['黄', '橙', '蓝', '白'], answer: 1, explain: '对面关系固定：白-黄、绿-蓝、红-橙。中心块永远不会相对移动。' },
        { type: 'quiz', q: '有一个块带着白色和绿色，它属于哪里？', options: ['任意一个白色角', '白中心和绿中心之间的棱位', '绿色面的任意位置', '底面中心'], answer: 1, explain: '两种颜色 = 棱块。它只有一个正确位置：白中心和绿中心之间。' }
      ],
      script: [
        { say: '先别急着转。我们数一数魔方有多少块。', setup: 'solved', look: 'front', wait: 2200 },
        { say: '中心块：每面正中一个，共 6 个。', hl: ['U', 'F', 'R', 'D', 'L', 'B'], wait: 2400 },
        { say: '中心块之间永远不会相对移动。', do: "R L' U D'", wait: 1200 },
        { say: '看，转了好几下，中心还在原来的面上。', hl: ['U', 'F', 'R'], wait: 2200 },
        { say: '棱块：两种颜色，一共 12 个。', setup: 'solved', hl: ['UF', 'UR', 'UB', 'UL', 'FR', 'FL', 'BR', 'BL', 'DF', 'DR', 'DB', 'DL'], wait: 2600 },
        { say: '角块：三种颜色，一共 8 个。', hl: ['UFR', 'UFL', 'UBR', 'UBL', 'DFR', 'DFL', 'DBR', 'DBL'], wait: 2600 },
        { say: '盯住右前上这个角，转一下 R。', hl: ['UFR'], wait: 1600 },
        { say: '它去了别的角位——但还是角。', do: 'R', wait: 2000 },
        { say: '角永远去角位，棱永远去棱位。', do: "R'", hl: [], wait: 2200 },
        { say: '所以记住：白色朝下，黄色朝上。', look: 'bottom', wait: 2200 },
        { say: '颜色由中心决定，块由颜色组合命名。', look: 'front', wait: 2400 }
      ]
    },

    // ======================= 02 =======================
    {
      id: 'notation', num: '02', title: '转动记号', tagline: '6 个字母、1 个撇、1 个 2——全部语法', stage: null,
      sections: [
        { type: 'prose', html: '公式是写给手的乐谱。每个大写字母代表一面：<strong>U</strong>（Up 上）、<strong>D</strong>（Down 下）、<strong>F</strong>（Front 前）、<strong>B</strong>（Back 后）、<strong>R</strong>（Right 右）、<strong>L</strong>（Left 左）。单写一个字母 = 这一面<strong>顺时针</strong>转 90°。' },
        { type: 'figure', svg: FIG.faces, caption: '面的名字永远相对于你：朝向你的是 F，右手边是 R，头顶是 U。' },
        { type: 'prose', html: '后面加一撇 ' + code("R'") + '（读作"R 撇"）= 逆时针 90°。后面加 2 ' + code('R2') + ' = 转 180°，顺逆都一样。公式里的字母用空格隔开，从左往右依次做：' + code(A.sexy) + ' 就是 R、U、R 撇、U 撇四下。' },
        { type: 'callout', kind: 'warn', title: '"顺时针"是站在那一面的正对面看的', html: 'R 顺时针——从魔方右边看过去是顺时针，从你的视角看，右列<strong>往上</strong>走。L 顺时针——从左边看，于是你看到左列<strong>往下</strong>走。U 让前面一行<strong>往左</strong>，D 让前面一行<strong>往右</strong>。新手把 L、D、B 转反，是最常见的错误来源。' },
        { type: 'cases', title: '点「播放」，看每个记号怎么转', items: [
          { name: 'U', alg: 'U', desc: '顶层顺时针：前面一行往左走。' },
          { name: "U'", alg: "U'", desc: '顶层逆时针：前面一行往右走。' },
          { name: 'R', alg: 'R', desc: '右列往上（远离你）翻。' },
          { name: "R'", alg: "R'", desc: '右列往下（朝你）翻。' },
          { name: 'F', alg: 'F', desc: '前面像方向盘一样顺时针。' },
          { name: 'L', alg: 'L', desc: '左列往下（朝你）翻——与 R 镜像。' },
          { name: 'D', alg: 'D', desc: '底层：前面一行往右走。' },
          { name: 'B', alg: 'B', desc: '后面：从后面看顺时针，从前看是逆时针。' },
          { name: 'R2', alg: 'R2', desc: '半圈，方向不重要。' }
        ] },
        { type: 'prose', html: '小写的 <strong>x y z</strong> 是<em>整体转动</em>：整个魔方一起转，任何块的相对位置都不变，只是换了一面对着你。x 与 R 同向，y 与 U 同向，z 与 F 同向。本教程只会用到 ' + code('y') + '（水平转一下魔方），白色永远朝下。' },
        { type: 'callout', kind: 'tip', title: '键盘也能转', html: '在电脑上可以直接按键：<code>u d f b r l</code> 顺时针，加 Shift 为逆时针，<code>x y z</code> 整体转动，空格暂停讲解。' },
        { type: 'quiz', q: "做 R' 时，从你的视角看，右列往哪边走？", options: ['往上', '往下', '往左', '往右'], answer: 1, explain: "R 让右列往上，R' 正好相反：往下（朝你翻过来）。" },
        { type: 'quiz', q: '做 U 时，前面一行往哪边走？', options: ['往左', '往右', '往上', '不动'], answer: 0, explain: '从上往下看，顶层顺时针转——靠近你的那一行往左走。' },
        { type: 'quiz', q: '下面哪个转动不会改变任何块的相对位置？', options: ['R2', 'y', "D'", 'F'], answer: 1, explain: 'y 是整体转动：整个魔方一起转，相当于你换了个角度看它。' },
        { type: 'quiz', q: "要撤销 R U R' U'，应该做什么？", options: ["U R U' R'", "R' U' R U", "R U R' U'", "U' R' U R"], answer: 0, explain: "撤销 = 倒着读，每一步取反：U' 的反是 U，R' 的反是 R……得到 U R U' R'。出错时用这招最稳。" }
      ],
      script: [
        { say: '面对你的是 F，右边 R，上面 U。', setup: 'solved', look: 'front', wait: 2400 },
        { say: 'R：右列顺时针，从你看是往上翻。', do: 'R', hl: ['layer:R'] },
        { say: "R'：反过来，往下翻。", do: "R'" },
        { say: 'U：顶层顺时针，前面一行往左走。', do: 'U', hl: ['layer:U'] },
        { say: "U'：往右走，回来了。", do: "U'" },
        { say: 'F：前面像方向盘一样顺时针。', do: 'F', hl: ['layer:F'] },
        { say: "F'。", do: "F'" },
        { say: '注意 L：从左边看顺时针，你看到它往下翻。', do: 'L', hl: ['layer:L'] },
        { say: "L'。", do: "L'" },
        { say: 'D：从底下看顺时针，前面一行往右走。', do: 'D', hl: ['layer:D'] },
        { say: "D'。", do: "D'" },
        { say: '加 2 就是转半圈：R2。', do: 'R2', hl: ['layer:R'] },
        { say: 'R2 再做一次就回来了。', do: 'R2' },
        { say: 'y：整个魔方水平转，块之间什么都没变。', do: 'y', hl: [] },
        { say: "y'，转回来。记号就这么多。", do: "y'" }
      ]
    },

    // ======================= 03 =======================
    {
      id: 'algorithm', num: '03', title: '公式到底是什么', tagline: "R U R' U' 连做 6 次，魔方回到原样", stage: null,
      sections: [
        { type: 'fact', num: '6', unit: '次', note: "R U R' U' 连做 6 次（24 步），无论魔方原来是什么状态，都会精确回到做之前的样子。" },
        { type: 'alg', name: "右手公式 R U R' U'", moves: A.sexy, repeat: 6, hl: ['UFR', 'DFR', 'UBR', 'UBL', 'UR', 'UB', 'FR'], desc: '点「播放 ×6」，盯住右前上那一块：它被拿走、拧着回来、换个方向再走——第 6 遍结束，一切归位。' },
        { type: 'prose', html: '一个"乱转"的动作，为什么做 6 遍就会回家？因为它根本没有乱转：<strong>每做一遍，只有 7 个块被动过</strong>（4 个角、3 条棱），另外 13 个块每一遍结束都在原位。' },
        { type: 'figure', svg: FIG.sexy7, caption: "R U R' U' 只动亮色的 7 块（底下还有右前下的一个角）；灰色的 13 块转了一圈又回到原处。" },
        { type: 'callout', kind: 'why', title: '周期 6 从哪里来', html: '这 7 块分成两组。3 条棱组成一个<strong>三循环</strong>：每做一遍轮换一格，3 遍回家。4 个角两两交换、同时被拧转，要 6 遍才能同时回到原位置和原方向。3 和 6 的最小公倍数是 6。你可以验证：做 3 遍后，3 条棱全部归位，只剩 4 个角还乱着。' },
        { type: 'prose', html: '换个角度看 ' + code(A.sexy) + '：<strong>R</strong> 把右边一列"拿出来"，<strong>U</strong> 把顶层换一块过去，<strong>R\'</strong> 把那一列"放回去"，<strong>U\'</strong> 把顶层转回来。R 和 R\' 抵消，U 和 U\' 抵消——如果两者之间没有交错，什么都不会发生。真正被改变的，只有 R 层和 U 层<strong>重叠</strong>的那一小片附近。' },
        { type: 'callout', kind: 'why', title: '"拿出来—换一下—放回去"', html: '这种 A B A\' B\' 结构在数学上叫<em>交换子</em>。两个动作重叠得越少，它改变的块就越少：R 层和 U 层只共享 3 个块，所以 R U R\' U\' 只扰动这附近的 7 块。后面每一条公式都是这个思路的变体或组合。<strong>公式不是魔法，是用大面积转动做小范围调整。</strong>' },
        { type: 'quiz', q: "R U R' U' 连做 3 遍后，哪些块仍不在原位？", options: ['3 条棱', '4 个角', '全部都回家了', '7 块全都乱着'], answer: 1, explain: '棱是三循环，3 遍回家；角的周期是 6，3 遍时恰好走了一半。' },
        { type: 'callout', kind: 'tip', title: '记手势，不记字母', html: '右手握住右侧：手腕向上翻 = R，食指把顶层往左拨 = U，手腕向下 = R\'，左手食指或右手拇指把顶层拨回 = U\'。"上—拨—下—回"连贯做 20 遍，它就成了肌肉记忆，以后第二步、第三步、第四步都靠它。' },
        { type: 'callout', kind: 'warn', title: '做错一步为什么致命', html: '公式的"保护"全靠精确抵消。漏掉一步，R 和 R\' 就对不上，原本毫发无损的块被带走，后面越做越乱。发现做错时，最稳的办法是<strong>倒着撤销</strong>刚才的步骤（倒序、每步取反），而不是继续往下做。' }
      ],
      script: [
        { say: "这是右手公式：R U R' U'。", setup: 'solved', look: 'front', hl: ['UFR'], wait: 2000 },
        { say: '第 1 遍。盯住右前上那一块。', do: A.sexy },
        { say: '只有 7 块动了，其他 13 块原封不动。', hl: ['UFR', 'DFR', 'UBR', 'UBL', 'UR', 'UB', 'FR'], wait: 2600 },
        { say: '第 2 遍。', do: A.sexy },
        { say: '第 3 遍——注意，3 条棱这时全部回家了。', do: A.sexy, hl: ['UR', 'UB', 'FR'] },
        { say: '只剩 4 个角还没回去。', hl: ['UFR', 'DFR', 'UBR', 'UBL'], wait: 2200 },
        { say: '第 4 遍。', do: A.sexy },
        { say: '第 5 遍。', do: A.sexy },
        { say: '第 6 遍……', do: A.sexy },
        { say: '完全复原。24 步，净效果为零。', hl: [], wait: 2400 },
        { say: 'R 拿出来，U 换一块，R\' 放回去，U\' 转回来。', do: A.sexy, wait: 1200 },
        { say: '只有两层重叠处附近的 7 块会被改变。', hl: ['UFR', 'DFR', 'UBR', 'UBL', 'UR', 'UB', 'FR'], wait: 2400 },
        { say: '这就是公式：大面积转动，小范围调整。', do: rep(A.sexy, 5), hl: [] }
      ]
    },

    // ======================= 04 =======================
    {
      id: 'cross', num: '04', title: '第一步 · 白色十字', tagline: '4 条棱，每条只看两种颜色', stage: 'cross',
      sections: [
        { type: 'prose', html: '<strong>目标：</strong>底面（白中心那面）出现白色十字，<strong>并且</strong> 4 条白棱的侧面颜色分别和侧面中心对齐。只有底面白十字、侧面没对齐，不算完成。' },
        { type: 'figure', svg: FIG.cross, caption: '目标：D 面白十字，侧面最下一行的中间格与中心同色。灰色 = 这一步不关心。' },
        { type: 'callout', kind: 'why', title: '为什么第一步就让白色朝下', html: '白十字做在底面，之后第 2 到第 7 步你都看着顶面和前面操作，全程不用翻魔方。代价是：检查十字时要看底面——点工具栏的「底面」视角，或者把魔方往前倾一下。用手拿着时，抬起来瞄一眼底面就行。' },
        { type: 'prose', html: '<strong>判读：</strong>白棱一共 4 条：白绿、白橙、白蓝、白红。找到其中一条，先看它<strong>另一种颜色</strong>——那决定了它要去哪个侧面中心的正下方。再看白色贴纸朝哪里，按下面三种情况处理。总纲：<strong>用 y 把目标中心转到前面，再按图做</strong>（下面以白绿棱为例，绿中心在前）。如果它已经在底层但位置或方向不对，先用 ' + code('F2') + ' 之类把它拿到顶层，再按情况一处理。' },
        { type: 'cases', title: '白棱在哪儿 → 怎么放', items: [
          { name: '在顶层，白色朝上', svg: iso(keep(S.crossUp, [7, 19]), { label: '白绿棱在顶层白色朝上' }), alg: 'F2', setup: 'F2', hl: ['UF'], desc: '先转 U，让绿色贴纸对准绿中心（白绿棱正好停在绿中心上方），再 F2 把它压到底面。' },
          { name: '在顶层，白色朝前', svg: iso(keep(S.crossFront, [7, 19]), { label: '白绿棱在顶层白色朝前' }), alg: "U' R' F R", setup: "R' F' R U", hl: ['UF'], desc: "先转 U 让它停在绿中心正上方（这时白色正好朝前）。然后 U' 把它挪到右边，R' 给它让出位置，F 把它压进底面，R 把右边复原。" },
          { name: '在中层', svg: iso(keep(S.crossMid, [23, 12]), { label: '白绿棱在中层' }), alg: 'F', setup: "F'", hl: ['FR'], desc: "绿色在前、白色朝右：一下 F 直接落位。若它在左边（白色朝左），用 F'。若它侧面颜色和所在面中心不一样：先 R U R'（在右槽）或 L' U' L（在左槽）把它顶到顶层——这两招不碰底层——再按顶层情况处理。" }
        ] },
        { type: 'callout', kind: 'why', title: '为什么侧面一定要对齐', html: '中心块不会动，所以白绿棱在整个魔方上只有一个正确位置：白中心和绿中心之间。底面看起来是白十字、侧面却没对齐，意味着 4 条棱里至少两条互相放错了位置——第二步你会发现角块怎么都放不进去。对齐不是"好看"，是"正确"。' },
        { type: 'callout', kind: 'tip', title: '先用 U 对齐，再往下压', html: '顶层的 U 转动碰不到底面，所以先转 U 对准中心、再压下去最安全。转 D 会把已经放好的棱一起带走——不是不能用，但要成对：自动解法里常见 <code>D … D\'</code> 这样先把位置让开、事后转回来的写法。' },
        { type: 'practice', stage: 'cross', html: '出题会给你一个随机打乱的魔方。用左侧按钮或键盘做出白十字（侧面要对齐）；达标时自动判定。卡住了点「提示」看下一步，或「看答案」看完整演示。' },
        { type: 'callout', kind: 'warn', title: '常见错误', html: '<ul><li><strong>只看底面，不看侧面。</strong>白十字成形但侧面颜色没对上中心——这不算完成。</li><li><strong>用 D 去对齐，然后忘了转回来。</strong>已经放好的棱被带走，越做越乱。</li><li><strong>把白中心放到顶上做"白花"再翻面。</strong>可以，但本教程坚持白底，后面所有判读都基于这个朝向。</li><li><strong>白色朝前的情况硬用 F2。</strong>压下去以后白色在侧面、绿色在底面——方向反了。</li></ul>' }
      ],
      script: [
        { say: '第一步：白色十字。白色中心朝下。', setup: 'solved', look: 'bottom', hl: ['face:D'], wait: 2400 },
        { say: '目标是这 4 条白棱，而且侧面要对齐中心。', hl: ['DF', 'DR', 'DB', 'DL'], wait: 2600 },
        { say: '情况一：白绿棱在顶层，白色朝上。', setup: 'F2', look: 'front', hl: ['UF'], wait: 2200 },
        { say: '绿色已经对准绿中心。F2 压下去。', do: 'F2' },
        { say: '落位：白朝下，绿对绿。', look: 'bottom', hl: ['DF'], wait: 2000 },
        { say: '情况二：在顶层，但白色朝前。', setup: "R' F' R U", look: 'front', hl: ['UF'], wait: 2200 },
        { say: "直接 F2 会让白色朝外——方向反了。", wait: 2200 },
        { say: "U' 先挪到右边。", do: "U'" },
        { say: "R' 让出位置。", do: "R'" },
        { say: 'F 压进底面。', do: 'F' },
        { say: 'R 把右边复原。', do: 'R' },
        { say: '同样落位，其他棱没被碰。', look: 'bottom', hl: ['DF'], wait: 2000 },
        { say: '情况三：在中层，白色朝右。', setup: "F'", look: 'front', hl: ['FR'], wait: 2200 },
        { say: '一下 F 就进去了。', do: 'F' },
        { say: '规则只有一条：先看另一种颜色，再看白色朝向。', look: 'bottom', hl: ['DF', 'DR', 'DB', 'DL'], wait: 2600 }
      ]
    },

    // ======================= 05 =======================
    {
      id: 'corners', num: '05', title: '第二步 · 白色角块', tagline: '一条公式，重复到对为止', stage: 'corners',
      sections: [
        { type: 'prose', html: '<strong>目标：</strong>底面全白，并且第一层（最下一圈）的侧面颜色全部与中心一致。也就是把 4 个白色角块放进十字之间的 4 个角槽。' },
        { type: 'figure', svg: FIG.corners, caption: '目标：D 面全白 + 四个侧面最下一行与中心同色。' },
        { type: 'prose', html: '<strong>判读：</strong>在顶层找一个带白色的角，看它的另外两种颜色，比如绿和橙——它属于白、绿、橙三个中心交汇的那个角槽。<strong>转 U，把它挪到这个槽的正上方</strong>，再把魔方（用 y）转到这个槽在右前下。现在只看一件事：<strong>白色贴纸朝哪边</strong>。' },
        { type: 'cases', title: '白色朝哪边 → 做几遍', items: [
          { name: '白色朝右', svg: iso(keep(S.cRight, [8, 20, 9]), { label: '白色朝右' }), alg: A.sexy, repeat: 1, setup: inv(A.sexy), hl: ['UFR'], desc: "R U R' U' 做 1 遍。" },
          { name: '白色朝上', svg: iso(keep(S.cTop, [8, 20, 9]), { label: '白色朝上' }), alg: A.sexy, repeat: 3, setup: inv(rep(A.sexy, 3)), hl: ['UFR'], desc: '做 3 遍。' },
          { name: '白色朝前', svg: iso(keep(S.cFront, [8, 20, 9]), { label: '白色朝前' }), alg: A.sexy, repeat: 5, setup: A.sexy, hl: ['UFR'], desc: '做 5 遍。（周期是 6，所以做 5 遍 = 倒着做 1 遍。）' },
          { name: '可选：左手镜像（白色朝左，角在左前上）', svg: iso(keep(S.cLeft, [6, 18, 38]), { view: 'fl', label: '白色朝左' }), alg: A.sexyL, repeat: 1, setup: inv(A.sexyL), hl: ['UFL'], desc: "可选：槽在左前下、不想用 y 转魔方时，用左手镜像 L' U' L U，白色朝左做 1 遍。" }
        ] },
        { type: 'callout', kind: 'tip', title: '记不住 1 / 3 / 5？不用记', html: '只有一条规则：<strong>把角放在目标槽正上方，一直重复 ' + code(A.sexy) + '，直到它归位</strong>。最多 5 遍。这就是第 03 章"周期 6"的直接用法——每做两遍它回到顶层、白色换一个朝向（前→上→右），总会转到朝右的那一遍。' },
        { type: 'callout', kind: 'why', title: '为什么十字不会被打乱', html: '在底层，R U R\' U\' 只碰右前下这一个角槽。R 把底层右边那条白棱抬起来，中间的 U 只转顶层、碰不到它，R\' 又原样放回。所以每做完一遍，十字和其他已放好的白角都回到原位——只有目标槽在被"刷新"。' },
        { type: 'prose', html: '<strong>白角在底层但放错了</strong>（位置不对，或白色没朝下）：用 y 把那个槽转到右前下，做 1 遍 ' + code(A.sexy) + ' 把它顶到顶层，再按上面的情况处理。' },
        { type: 'practice', stage: 'corners', html: '出题时白十字已经做好。把 4 个白角放进去，直到第一层完成。' },
        { type: 'callout', kind: 'warn', title: '常见错误', html: '<ul><li><strong>角没在正上方就开始做。</strong>先确认它的两种侧面颜色和目标槽两侧的中心一致。</li><li><strong>做到一半转 U 去找别的角。</strong>公式没做完，十字就被拆开了。</li><li><strong>数错遍数。</strong>别数，看角：归位了就停。</li><li><strong>白色朝下就以为对了。</strong>还要看侧面两种颜色和中心是否一致。</li></ul>' }
      ],
      script: [
        { say: '第二步：把 4 个白角放进十字之间。', setup: 'solved', look: 'bottom', hl: ['DFR', 'DFL', 'DBR', 'DBL'], wait: 2400 },
        { say: '这个白绿橙角在右前上，白色朝右。', setup: inv(A.sexy), look: 'front', hl: ['UFR'], wait: 2400 },
        { say: "做一遍 R U R' U'。", do: A.sexy },
        { say: '归位。十字没被碰。', hl: ['DFR'], wait: 2000 },
        { say: '这次白色朝上。', setup: inv(rep(A.sexy, 3)), hl: ['UFR'], wait: 2000 },
        { say: '第 1 遍。', do: A.sexy },
        { say: '第 2 遍——它又回到顶层，白色改朝右了。', do: A.sexy },
        { say: '第 3 遍。', do: A.sexy },
        { say: '归位。白色朝上 = 3 遍。', hl: ['DFR'], wait: 2000 },
        { say: '白色朝前呢？做 5 遍。', setup: A.sexy, hl: ['UFR'], wait: 2000 },
        { say: '其实就是"一直做到对为止"。', do: rep(A.sexy, 5) },
        { say: '左边的槽，用镜像：L\' U\' L U。', setup: inv(A.sexyL), hl: ['UFL'], wait: 2200 },
        { say: '一遍归位。', do: A.sexyL },
        { say: '第一层完成：底面全白，侧面一圈对齐。', look: 'bottom', hl: ['layer:D'], wait: 2400 }
      ]
    },

    // ======================= 06 =======================
    {
      id: 'middle', num: '06', title: '第三步 · 中层棱块', tagline: '拿出一个角，顺手带进一条棱', stage: 'middle',
      sections: [
        { type: 'prose', html: '<strong>目标：</strong>中间那一圈的 4 条棱归位，前两层完成。做完后，魔方只剩顶层是乱的。' },
        { type: 'figure', svg: FIG.middle, caption: '目标：前两层完成——四个侧面的下两行与中心同色。' },
        { type: 'prose', html: '<strong>判读：</strong>中层棱就是<strong>不含黄色</strong>的 4 条棱：绿橙、橙蓝、蓝红、红绿。在顶层找一条不含黄色的棱，转 U，直到这条棱<strong>侧面那格</strong>颜色和它正下方的中心一样（侧面出现一个倒 T）。然后用 <code>y</code> 把这一面转到前面。再看它<strong>顶上那格</strong>：和右边中心同色 → 往右；和左边中心同色 → 往左。' },
        { type: 'cases', title: '往右 / 往左', items: [
          { name: '往右放', svg: iso(keep(S.mRight, [7, 19]), { label: '绿橙棱往右放' }), alg: A.midR, setup: inv(A.midR), hl: ['UF', 'FR'], desc: '前面绿对绿，顶上是橙（右边中心色）。' },
          { name: '往左放', svg: iso(keep(S.mLeft, [7, 19]), { view: 'fl', label: '红绿棱往左放' }), alg: A.midL, setup: inv(A.midL), hl: ['UF', 'FL'], desc: '前面绿对绿，顶上是红（左边中心色）。镜像公式。' },
          { name: '在槽里但颜色反了', svg: iso(keep(S.mFlip, [23, 12]), { label: '绿橙棱在右前槽但颜色反了' }), alg: A.midR + ' U2 ' + A.midR, setup: SET.midFlip, hl: ['FR'], desc: '绿橙棱在右前槽，但橙色朝前、绿色朝右。先做一次往右的公式把它顶到顶层；U2 让绿色对上绿中心、顶上的橙色指向右边；再做一次往右的公式。' }
        ] },
        { type: 'callout', kind: 'why', title: '拆成两半看，一点也不神秘', html: '前半 <code>U R U\' R\'</code> 是右手公式的变形：把棱挪开，同时把右前下的白角连同它旁边的中层槽"拿出来"到顶层。后半 <code>U\' F\' U F</code> 是同一招从前面做的左手版：把白角放回原槽——而要放的那条棱已经被摆在白角旁边，于是被一起带进中层。两半各自都是"拿出来—放回去"，所以第一层毫发无损，只多了一条归位的棱。' },
        { type: 'prose', html: '<strong>特殊情况：</strong>顶层一条不含黄色的棱都没有，但中层还有棱放错（位置不对，或颜色反了）。把错的那个槽转到右前，任意拿一条顶层棱做一遍往右的公式——错的棱被顶到顶层，再正常处理它。<strong>中层棱在正确的槽里但颜色反了，也算错位</strong>，同样先顶出来。' },
        { type: 'practice', stage: 'middle', html: '出题时第一层已经完成。把中层 4 条棱放好。' },
        { type: 'callout', kind: 'warn', title: '常见错误', html: '<ul><li><strong>用前面的颜色判断方向。</strong>前面的颜色用来对齐，方向要看<strong>顶上</strong>那一格。</li><li><strong>拿带黄色的棱来放。</strong>带黄色的棱属于顶层，放进中层只会占坑。</li><li><strong>左右公式做串。</strong>往右的公式第一步是 U，往左的是 U\'：先把棱"让开"的方向，正好和要放进去的方向相反。</li><li><strong>做完第一层坏了一个角。</strong>公式中途停顿或漏步，十有八九是漏了最后的 F 或 F\'。</li></ul>' }
      ],
      script: [
        { say: '第三步：中间一圈的 4 条棱。', setup: 'solved', look: 'front', hl: ['FR', 'FL', 'BR', 'BL'], wait: 2400 },
        { say: '这条绿橙棱在顶层，前面绿对准绿中心。', setup: inv(A.midR), hl: ['UF'], wait: 2400 },
        { say: '顶上是橙色——和右边中心一样，往右放。', hl: ['UF', 'R'], wait: 2400 },
        { say: "前半：U R U' R'，把角和槽拿出来。", do: "U R U' R'", hl: ['UF', 'FR', 'DFR'] },
        { say: "后半：U' F' U F，把角放回去，棱顺带进槽。", do: "U' F' U F" },
        { say: '中层右前归位，第一层完好。', hl: ['FR'], wait: 2200 },
        { say: '这条红绿棱：顶上是红，往左放。', setup: inv(A.midL), hl: ['UF'], wait: 2400 },
        { say: "镜像公式：U' L' U L U F U' F'。", do: A.midL },
        { say: '归位。判方向只看顶上那一格。', hl: ['FL'], wait: 2400 },
        { say: '做完 4 条，前两层就完成了。', setup: 'solved', hl: ['layer:D', 'FR', 'FL', 'BR', 'BL'], wait: 2400 }
      ]
    },

    // ======================= 07 =======================
    {
      id: 'yellowCross', num: '07', title: '第四步 · 黄色十字', tagline: '只管朝向，不管位置', stage: 'yellowCross',
      sections: [
        { type: 'prose', html: '<strong>目标：</strong>顶面出现黄色十字——4 条顶层棱的黄色都朝上。侧面颜色先不管，4 个角也先不管。' },
        { type: 'fact', num: '4', unit: '种情况', note: '顶面黄棱只可能是：点、L 形、一字、十字。不存在"只差 1 条翻过来"——翻错的棱数永远是偶数。' },
        { type: 'figure', svg: FIG.yCross, caption: '判读：只看顶面中间那个十字上的 4 条棱（角先忽略）。每个箭头 = 做一次公式。' },
        { type: 'alg', name: '黄十字公式', moves: A.yCross, setup: SET.line, hl: ['UF', 'UR', 'UB', 'UL'], desc: '一字横放时做一次，直接得到十字。' },
        { type: 'cases', title: '摆好再做', items: [
          { name: '点', svg: top(onlyY(TOP.dot, true)), alg: A.yCross, setup: SET.dot, desc: '做一次必定变成 L 形，而且出现在右前；U2 把它转到左后，再做。' },
          { name: 'L 形', svg: top(onlyY(TOP.L, true)), alg: A.yCross, setup: SET.L, desc: '转 U，把 L 摆在<strong>左后</strong>（黄棱在后和左），做一次得到一字。' },
          { name: '一字', svg: top(onlyY(TOP.line, true)), alg: A.yCross, setup: SET.line, desc: '转 U，让一字<strong>横放</strong>（黄棱在左和右），做一次得到十字。' }
        ] },
        { type: 'callout', kind: 'why', title: "R U R' U' 被 F 包起来", html: '看结构：<code>F · (R U R\' U\') · F\'</code>。先 F，把前面一层顺时针转 90°——顶层的前棱被"立"进右前槽——这一立本身就是一次翻转（R、U 转动从不改变棱的朝向，翻转全来自 F）；中间的 R U R\' U\' 把它换到顶层另一格；最后 F\' 把前面一层转回去，又把一条顶棱"立"回顶层——两条棱各翻一次。前两层的块在 F 与 F\' 之间被"借出"又原样归还。外层的 F 决定<strong>在哪里做</strong>，内层的 R U R\' U\' 决定<strong>做什么</strong>——这种结构叫"共轭"。' },
        { type: 'callout', kind: 'why', title: '为什么翻错的棱永远是偶数', html: '把一条棱的"朝向"定义好之后可以证明：U、D、R、L 转动不改变任何棱的朝向，F、B 转动每次恰好翻转 4 条。所以无论怎么转，翻错的棱总数都是偶数。这也是为什么拆开乱装的魔方有时"永远差一条棱"——那个状态用转动根本到不了。' },
        { type: 'practice', stage: 'yellowCross', html: '出题时前两层已经完成。做出黄十字（只要求 4 条棱黄色朝上）。' },
        { type: 'callout', kind: 'warn', title: '常见错误', html: '<ul><li><strong>L 放错位置。</strong>在右前做会变成竖一字，在左前或右后做等于白做。L 一定在<strong>左后</strong>。</li><li><strong>一字竖放。</strong>一字竖放做一次会退回点。一字要<strong>横放</strong>。</li><li><strong>被角块干扰判读。</strong>这一步只看 4 条棱，角上有没有黄色都不影响。</li><li><strong>忘了最后的 F\'。</strong>前两层会被打乱。</li></ul>' }
      ],
      script: [
        { say: '第四步：顶面做出黄十字。', setup: 'solved', look: 'front', hl: ['UF', 'UR', 'UB', 'UL'], wait: 2200 },
        { say: '只看 4 条棱的黄色朝不朝上。', wait: 2000 },
        { say: '现在是"点"：4 条都没朝上。', setup: SET.dot, hl: ['UF', 'UR', 'UB', 'UL'], wait: 2400 },
        { say: "F R U R' U' F'——先做一次。", do: A.yCross },
        { say: '变成了 L 形，但它在右前。', wait: 2000 },
        { say: 'U2，把 L 摆到左后。', do: 'U2' },
        { say: '再做一次。', do: A.yCross },
        { say: '一字，正好横放。', wait: 1800 },
        { say: '最后一次。', do: A.yCross },
        { say: '黄十字完成。', wait: 1800 },
        { say: "拆开看：F 先把前面一层借过来。", setup: SET.line, do: 'F', hl: ['layer:F'] },
        { say: "R U R' U' 在那里改朝向。", do: A.sexy },
        { say: "F' 再把前面一层还回去。", do: "F'" },
        { say: '前两层完好，只有顶面变了。', hl: ['UF', 'UR', 'UB', 'UL'], wait: 2400 }
      ]
    },

    // ======================= 08 =======================
    {
      id: 'yellowFace', num: '08', title: '第五步 · 黄色面', tagline: '找到那条"鱼"', stage: 'yellowFace',
      sections: [
        { type: 'prose', html: '<strong>目标：</strong>顶面 9 格全黄。侧面颜色乱是正常的，下一步再管。' },
        { type: 'prose', html: '<strong>判读：</strong>黄十字有了，只看 4 个角：有几个角的黄色朝上？1 个朝上时，顶面的黄色正好构成一条"鱼"——黄十字是鱼身，朝上的那个角是鱼头。' },
        { type: 'figure', svg: FIG.fish, caption: '鱼形：只有 1 个角黄色朝上（圈出），把它摆在左前。另外 3 个角的黄色都朝侧面，而且朝同一个转向。' },
        { type: 'alg', name: '小鱼公式（Sune）', moves: A.sune, setup: SET.fish, hl: ['UFL', 'UFR', 'UBR', 'UBL'], desc: '鱼头在左前时做一次，顶面全黄。' },
        { type: 'cases', title: '数朝上的角 → 怎么摆', items: [
          { name: '1 个朝上（鱼）', svg: top(onlyY(TOP.fish)), alg: A.sune, setup: SET.fish, desc: '转 U 把鱼头放在<strong>左前</strong>，做一次 Sune。' },
          { name: '0 个朝上', svg: top(onlyY(TOP.zero)), alg: A.sune, setup: SET.zero, desc: '转 U，让<strong>左前角的黄色朝左</strong>，做一次 Sune——会得到一条鱼。' },
          { name: '2 个朝上', svg: top(onlyY(TOP.two)), alg: A.sune, setup: SET.two, desc: '同样：转 U 让<strong>左前角的黄色朝左</strong>，做一次 Sune，再重新判读。' }
        ] },
        { type: 'figure', svg: FIG.yFace, caption: '三类情况一览。无论哪类，做 Sune 后重新判读，最多 3 次。' },
        { type: 'callout', kind: 'why', title: '为什么"只差一个角拧一下"的状态不存在', html: '把每个角"拧了几分之一圈"加起来，总和必须是整圈——这是魔方转动保持的一个不变量。所以如果 4 个角里只有 1 个朝上，另外 3 个一定都往<strong>同一个方向</strong>偏了 1/3 圈（3 × 1/3 = 1 圈）。Sune 恰好把 3 个角各拧 1/3 圈：第一个 R 把右前下的白角连同右前中层棱一起提到顶层，之后它们被 U 搬了三次（右前上 → 左前上 → 左后上 → 右前上），直到最后一个 R\' 才回到原槽；右层其余前两层块每次只在右层里挪一下、U 碰不到，R\' 立刻还原。净效果：顶层 3 个角各拧 1/3 圈（位置也会换，但这一步只看朝向）。' },
        { type: 'callout', kind: 'tip', title: '每做一次，重新看', html: '不要试图预判"要做几次"。做完一次 Sune，<strong>重新数朝上的角</strong>：1 个就摆鱼头，0 或 2 个就让左前角黄色朝左。按这个规则，任何情况最多 3 次 Sune。' },
        { type: 'practice', stage: 'yellowFace', html: '出题时黄十字已经完成。把顶面做成全黄。' },
        { type: 'callout', kind: 'warn', title: '常见错误', html: '<ul><li><strong>鱼头放错角。</strong>鱼头在左前，不是右前。</li><li><strong>0 / 2 个时看错方向。</strong>要的是左前角的黄色<strong>朝左</strong>（在左面上），不是朝前。</li><li><strong>中途用 y 转了魔方。</strong>公式做到一半换方向，前两层会坏。</li><li><strong>看到侧面乱了就以为做错。</strong>这一步只保证顶面全黄，侧面乱是预期之内。</li></ul>' }
      ],
      script: [
        { say: '第五步：让顶面全黄。', setup: SET.fish, look: 'front', hl: ['face:U'], wait: 2200 },
        { say: '数一数：只有 1 个角黄色朝上。', hl: ['UFL'], wait: 2200 },
        { say: '这就是"鱼"：鱼头在左前。', hl: ['UFL', 'UF', 'UL', 'UR', 'UB'], wait: 2400 },
        { say: "做 Sune：R U R' U R U2 R'。", do: A.sune, hl: [] },
        { say: '一次完成。', hl: ['face:U'], wait: 1800 },
        { say: '0 个角朝上：让左前角的黄色朝左。', setup: SET.zero, hl: ['UFL'], wait: 2600 },
        { say: '做一次 Sune。', do: A.sune, hl: [] },
        { say: '出现鱼，鱼头已经在左前。', hl: ['UFL'], wait: 2200 },
        { say: '再做一次。', do: A.sune, hl: [] },
        { say: '顶面全黄。侧面乱着没关系。', hl: ['face:U'], wait: 2400 }
      ]
    },

    // ======================= 09 =======================
    {
      id: 'yellowCorners', num: '09', title: '第六步 · 黄角归位', tagline: '三个角，一次轮换一格', stage: 'yellowCorners',
      sections: [
        { type: 'prose', html: '<strong>目标：</strong>4 个顶角都到正确位置：每个角的两种侧面颜色，和它挨着的两个侧面中心相同。棱先不管。' },
        { type: 'prose', html: '<strong>判读：</strong>先转 U，数有几个角<strong>对位</strong>——角块的三种颜色和它周围三个中心一致（顶面都是黄的，只需看两个侧面贴纸；同一面上的棱还没对，不用管）。<br>· 恰好 1 个 → 用 <code>y</code> 把它放到<strong>左前</strong>，做公式；不对就再做一次。<br>· 4 个 → 跳过这一步。<br>· 转遍 4 个角度都只有 0 或 2 个（2 个 = U 角度不对的信号，不是"有对位角"）→ 随便做一次公式，再转 U 重数，这时一定能找到恰好 1 个。' },
        { type: 'figure', svg: FIG.yCorners, caption: '左前角已对位（圈出）。公式让其余三个角沿箭头轮换一格：右后 → 右前 → 左后 → 右后；黄色始终朝上。' },
        { type: 'alg', name: '黄角三循环（A 置换）', moves: A.yCorners, setup: SET.corners, hl: ['UFR', 'UBR', 'UBL'], desc: '左前角保持不动，其余三个角轮换一格，黄色面始终朝上。转的方向不对，就再做一次。' },
        { type: 'cases', title: '有没有对位的角', items: [
          { name: '恰好 1 个对位', svg: top(TOP.corners), alg: A.yCorners, setup: SET.corners, desc: '用 y 把对位角放在左前，做一次；若三个角转的方向不对，再做一次。' },
          { name: '转遍 4 个角度都没有恰好 1 个', svg: top(TOP.corners0), alg: A.yCorners, setup: SET.corners0, desc: '转遍 4 个角度，对位数只有 0 / 2 / 0 / 2。随便做一次公式，再转 U 重数——这时一定能找到恰好 1 个，再判读。' }
        ] },
        { type: 'callout', kind: 'why', title: '为什么只有 3 个角在动，而且黄面不会坏', html: '这条公式只让<strong>右前、右后、左后</strong>三个角换位，左前角和前两层全部原样保留；顶层的棱也不受影响。更关键的是：三个角在换位时<strong>黄色面始终朝上</strong>——它只"搬家"、不"拧角"，所以上一步做好的黄面不会被破坏。结构上，它是 <code>R\' · (F · R\' B2 R · F\' · R\' B2 R) · R</code>：中间是第 03 章那种"拿出来—换一下—放回去"的交换子，两组动作只在一个角上重叠，于是只剩一个<strong>三循环</strong>；外面的 R\' … R 负责把它挪到顶层。三循环做 3 次回原样，所以最多做 2 次。' },
        { type: 'practice', stage: 'yellowCorners', html: '出题时黄面已经完成。把 4 个顶角放到正确位置。' },
        { type: 'callout', kind: 'warn', title: '常见错误', html: '<ul><li><strong>看到 2 个对位就把其中一个放左前做公式。</strong>2 个对位说明 U 角度不对，先转 U；找到恰好 1 个之后，挪它用 <code>y</code>，不用 U。</li><li><strong>拿顶面颜色判断对位。</strong>顶面都是黄的，没有信息——要看两个侧面贴纸。</li><li><strong>B2 做成 B。</strong>这条公式里两次 B2 都是半圈；B 从前面看方向是反的，好在半圈不分方向。</li></ul>' }
      ],
      script: [
        { say: '第六步：把 4 个顶角放到正确位置。', setup: SET.corners, look: 'front', hl: ['UFR', 'UFL', 'UBR', 'UBL'], wait: 2400 },
        { say: '左前这个角：三种颜色正好对上中心。', hl: ['UFL'], wait: 2400 },
        { say: '另外三个都不对。', hl: ['UFR', 'UBR', 'UBL'], wait: 2000 },
        { say: '对位角放左前，做 R\' F R\' B2 R F\' R\' B2 R2。', do: A.yCorners },
        { say: '三个角轮换了一格，全部对位。', hl: ['UFR', 'UFL', 'UBR', 'UBL'], wait: 2400 },
        { say: '注意顶面：从头到尾一直是全黄。', hl: ['face:U'], wait: 2400 },
        { say: '它只让三个角搬家，不拧角。', setup: SET.corners, hl: ['UFR', 'UBR', 'UBL'], wait: 2200 },
        { say: '再看一遍，盯住左前角：它一动不动。', do: A.yCorners, hl: ['UFL'] },
        { say: '方向转反了？再做一次就是反向轮换。', wait: 2400 },
        { say: '转遍 4 个角度都没有恰好 1 个对位？', setup: SET.corners0, hl: ['UFR', 'UFL', 'UBR', 'UBL'], wait: 2400 },
        { say: '转 U 数一数：0 个、2 个、0 个、2 个。', do: 'U U U U', wait: 1600 },
        { say: '随便做一次公式。', do: A.yCorners, hl: [] },
        { say: '再转 U 重数，一定能找到恰好 1 个。', wait: 2400 },
        { say: '找到后用 y 转到左前，再做公式。', wait: 2400 }
      ]
    },

    // ======================= 10 =======================
    {
      id: 'yellowEdges', num: '10', title: '第七步 · 黄棱归位', tagline: '最后三条棱，转一圈就完', stage: 'yellowEdges',
      sections: [
        { type: 'prose', html: '<strong>目标：</strong>全部复原。现在只剩顶层的棱可能不在位置上。' },
        { type: 'prose', html: '<strong>判读：</strong>看四个侧面的顶层：哪一面整行同色（"一整条"），那一面的棱就已经对位。用 <code>y</code> 把这一面转到<strong>后面</strong>，然后做公式。四面都不整齐，就先做一次公式，一定会出现一整条。' },
        { type: 'figure', svg: FIG.yEdges, caption: '后面整齐。公式让其余三条棱沿箭头轮换：左 → 前 → 右 → 左。' },
        { type: 'alg', name: '黄棱三循环（U 置换）', moves: A.yEdges, setup: SET.edges, hl: ['UF', 'UR', 'UL'], desc: '整齐的一面放后面，做一次。转的方向反了，就再做一次。' },
        { type: 'cases', title: '有几面整齐', items: [
          { name: '1 面整齐（顺向）', svg: top(TOP.edges), alg: A.yEdges, setup: SET.edges, desc: '整齐面放后面，一次完成。' },
          { name: '1 面整齐（需两次）', alg: A.yEdges, repeat: 2, setup: SET.edges2, desc: '做一次后三棱转了一格但还没对——方向反了，再做一次。' },
          { name: '没有整齐的面', alg: A.yEdges, setup: SET.edges0, desc: '先做一次，出现整齐面后用 y 放到后面，再做。' }
        ] },
        { type: 'callout', kind: 'why', title: '只动 3 条棱，所以最多做两次', html: '这条公式是一个只作用在 3 条顶层棱上的轮换：左 → 前 → 右 → 左；角和前两层全部保持不动。三循环有方向：做一次转一格，做两次转两格——等于反方向转一格。所以不管三条棱怎么错，<strong>最多两次</strong>。同样的道理：一个三循环做 3 次一定回到原样，周期又一次出现。' },
        { type: 'fact', num: '≈ 120', unit: '步', note: '用这套方法，一次完整还原通常需要 100–150 步。熟练后整个过程可以压到 1 分钟以内。' },
        { type: 'practice', stage: 'yellowEdges', html: '出题时只剩顶层棱。做完这一步，魔方就完全复原了。' },
        { type: 'callout', kind: 'warn', title: '常见错误', html: '<ul><li><strong>整齐面放在前面。</strong>它必须在后面。</li><li><strong>漏步。</strong>11 步里 R 出现 7 次，最容易少做一个；分三段记：<code>R U\' R U</code> | <code>R U R U\'</code> | <code>R\' U\' R2</code>。</li><li><strong>最后一步做成 R 而不是 R2。</strong>结尾差一层没对齐，多半是它。</li><li><strong>做完顶层差一个 U。</strong>所有侧面都"错一格"时，转 U 对齐即可——这不是错。</li></ul>' }
      ],
      script: [
        { say: '最后一步：顶层三条棱。', setup: SET.edges, look: 'front', hl: ['UF', 'UR', 'UB', 'UL'], wait: 2200 },
        { say: '后面这一整条是齐的。', hl: ['UB', 'UBL', 'UBR'], wait: 2000 },
        { say: '另外三条要轮换：左到前，前到右，右到左。', hl: ['UL', 'UF', 'UR'], wait: 2600 },
        { say: '整齐面在后面，做公式。', do: A.yEdges },
        { say: '复原。', hl: [], wait: 1800 },
        { say: '如果方向反了呢？', setup: SET.edges2, hl: ['UL', 'UF', 'UR'], wait: 2000 },
        { say: '做一次，三条棱转了一格。', do: A.yEdges },
        { say: '还差一格——再做一次。', do: A.yEdges },
        { say: '完成。', hl: [], wait: 1600 },
        { say: '7 步，8 条公式，任何打乱都能还原。', wait: 2600 }
      ]
    },

    // ======================= 11 =======================
    {
      id: 'cheatsheet', num: '11', title: '速查卡 + 练习场', tagline: '8 条公式，一页纸', stage: null,
      sections: [
        { type: 'prose', html: '整套方法的全部公式。每一条都只在特定情况下用——左边写着"什么时候"，比公式本身更重要。<button type="button" class="btn btn-ghost" data-action="print-cheatsheet">打印速查卡</button>' },
        { type: 'alg', name: '② 白角 · 右手（白色在右前上，重复到归位）', moves: A.sexy, setup: inv(A.sexy), hl: ['UFR'] },
        { type: 'alg', name: '② 白角 · 左手（白色在左前上，重复到归位）', moves: A.sexyL, setup: inv(A.sexyL), hl: ['UFL'] },
        { type: 'alg', name: '③ 中层 · 往右（顶上颜色 = 右中心）', moves: A.midR, setup: inv(A.midR) },
        { type: 'alg', name: '③ 中层 · 往左（顶上颜色 = 左中心）', moves: A.midL, setup: inv(A.midL) },
        { type: 'alg', name: '④ 黄十字（L 放左后 / 一字横放）', moves: A.yCross, setup: SET.line },
        { type: 'alg', name: '⑤ 黄面 · Sune（鱼头左前；否则左前角黄色朝左）', moves: A.sune, setup: SET.fish },
        { type: 'alg', name: '⑥ 黄角三循环（对位角放左前）', moves: A.yCorners, setup: SET.corners },
        { type: 'alg', name: '⑦ 黄棱三循环（整齐面放后面）', moves: A.yEdges, setup: SET.edges },
        { type: 'callout', kind: 'tip', title: '① 白十字没有公式', html: '白棱另一种颜色对准中心 → 白色朝上用 <code>F2</code>，白色朝前用 <code>U\' R\' F R</code>，在中层用 <code>F</code> / <code>F\'</code>。' },
        { type: 'practice', stage: 'full', html: '<strong>练习场：</strong>点「出题」随机打乱 25 步。自己还原，或点「提示」看下一步、「看答案」看完整的分阶段自动解——每一步都只用上面这 8 条公式。' },
        { type: 'callout', kind: 'tip', title: '打印', html: '点上面的「打印速查卡」或按 Ctrl / ⌘ + P。打印版会隐藏 3D 面板和按钮，只保留文字、公式和示意图。' },
        { type: 'steps', items: ['不看速查卡连续还原 3 次：方法已经进入长期记忆。', '用计时器记录成绩，先把每一步的"找块"时间压下来，而不是加快手速。', '想更快：下一站是 CFOP（十字 → F2L → OLL → PLL），本教程的 Sune、U 置换就是 OLL / PLL 的成员。'] }
      ],
      script: [
        { say: '速查卡：8 条公式，一页纸。', setup: 'solved', look: 'front', wait: 2200 },
        { say: '公式只是一半，判读才是另一半。', wait: 2200 },
        { say: '打乱一下，自己试试。', do: "R U2 F' L D B2 R' U F2 D' L2 B U' R2 F D2 L' U2 B' R" },
        { say: '先找白棱，白色朝下。', look: 'bottom', hl: ['face:D'], wait: 2400 },
        { say: '卡住了，就点「提示」。', look: 'front', hl: [], wait: 2200 },
        { say: '或者点「看答案」，看求解器一步步演示。', wait: 2400 },
        { say: '每一步用的，都是你学过的公式。', wait: 2200 },
        { say: '祝你第一次独立还原。', setup: 'solved', wait: 2000 }
      ]
    }
  ];

  LESSONS.ALGS = A;
  LESSONS.svg = { net: net, top: top, iso: iso, row: row, keep: keep, onlyY: onlyY };
  LESSONS.invert = inv;

  if (typeof module !== 'undefined' && module.exports) module.exports = LESSONS; else window.LESSONS = LESSONS;
})();
