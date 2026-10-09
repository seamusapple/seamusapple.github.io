/* render.js — 把 LESSONS 渲染成 DOM。纯函数：不含 3D / 状态逻辑，不绑定事件。
 * 交互元素全部带 data-action / data-role 等钩子，由 app.js 统一委托绑定。
 * 导出全局 CubeRender：renderAll(lessons, container) / renderChapter(ch, opts) / chapterHTML(ch, opts)
 *                     / renderToc(lessons, navEl) / movesHTML(alg) / sectionHTML(sec, ctx) */
(function () {
  'use strict';

  var KIND = { why: '为什么', warn: '坑', tip: '技巧' };
  var STAGE_NAME = { cross: '白色十字', corners: '白色角块', middle: '中层棱块', yellowCross: '黄色十字',
    yellowFace: '黄色面', yellowCorners: '黄角归位', yellowEdges: '黄棱归位', full: '完整还原' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function attr(name, v) { return v == null || v === '' ? '' : ' ' + name + '="' + esc(v) + '"'; }
  function hlAttr(hl) { return hl && hl.length ? attr('data-hl', [].concat(hl).join(',')) : ''; }
  function anchor(ch) { return 'ch-' + ch.num; }

  // 每个记号一个 span，供逐步高亮：<span class="mv" data-i="0">R</span>
  function movesHTML(alg) {
    var ms = String(alg || '').trim().split(/\s+/).filter(Boolean);
    return ms.map(function (m, i) { return '<span class="mv" data-i="' + i + '">' + esc(m) + '</span>'; }).join('');
  }

  function algButtons(repeat, compact) {
    var r = repeat && repeat > 1 ? repeat : 0;
    var h = '<div class="alg-btns">';
    h += '<button type="button" class="btn btn-play" data-action="play-alg"' + (r ? ' data-repeat="' + r + '"' : '') + '>▶ 播放' + (r ? ' ×' + r : '') + '</button>';
    h += '<button type="button" class="btn" data-action="step-alg">单步</button>';
    if (!compact) h += '<button type="button" class="btn" data-action="slow-alg">慢速</button>';
    h += '<button type="button" class="btn btn-ghost" data-action="setup-alg" title="把魔方摆到这条公式的初始状态">摆位</button>';
    return h + '</div>';
  }

  // 一张公式卡（alg 与 cases 的单项共用）
  function algBlock(o, cls, compact) {
    var rep = o.repeat && o.repeat > 1 ? o.repeat : 0;
    return '<div class="' + cls + '" data-alg="' + esc(o.moves || o.alg) + '"' + attr('data-setup', o.setup) + hlAttr(o.hl) +
      (rep ? ' data-repeat="' + rep + '"' : '') + '>';
  }

  var R = {};

  R.prose = function (s) { return '<div class="prose">' + s.html + '</div>'; };

  R.fact = function (s) {
    return '<div class="fact"><div class="fact-num"><span class="n">' + esc(s.num) + '</span>' +
      (s.unit ? '<span class="u">' + esc(s.unit) + '</span>' : '') + '</div>' +
      (s.note ? '<p class="fact-note">' + s.note + '</p>' : '') + '</div>';
  };

  R.callout = function (s) {
    var k = KIND[s.kind] ? s.kind : 'tip';
    return '<aside class="callout callout-' + k + '"><div class="callout-tag">' + KIND[k] + '</div>' +
      (s.title ? '<h4 class="callout-title">' + esc(s.title) + '</h4>' : '') +
      '<div class="callout-body">' + s.html + '</div></aside>';
  };

  R.figure = function (s, ctx) {
    ctx.fig++;
    var no = ctx.figPrefix + ctx.fig;
    return '<figure class="fig" id="fig-' + esc(ctx.num) + '-' + ctx.fig + '">' + s.svg +
      '<figcaption><span class="fig-no">图 ' + no + '</span>' + esc(s.caption || '') + '</figcaption></figure>';
  };

  R.alg = function (s) {
    var rep = s.repeat && s.repeat > 1 ? s.repeat : 0;
    return algBlock(s, 'alg-card') +
      '<div class="alg-head"><span class="alg-name">' + esc(s.name || '公式') + '</span>' +
      '<span class="alg-meta">' + s.moves.trim().split(/\s+/).length + ' 步' + (rep ? ' · 重复 ' + rep + ' 次' : '') + '</span></div>' +
      '<div class="alg-moves" data-role="moves">' + movesHTML(s.moves) + '</div>' +
      (s.desc ? '<p class="alg-desc">' + s.desc + '</p>' : '') +
      algButtons(rep) + '<div class="alg-status" data-role="alg-status" aria-live="polite"></div></div>';
  };

  R.cases = function (s) {
    var h = '<div class="cases">' + (s.title ? '<h4 class="cases-title">' + esc(s.title) + '</h4>' : '') + '<div class="cases-grid">';
    s.items.forEach(function (it) {
      var rep = it.repeat && it.repeat > 1 ? it.repeat : 0;
      if (it.alg) h += algBlock(it, 'case', true);
      else h += '<div class="case case-static">';
      if (it.svg) h += '<div class="case-fig">' + it.svg + '</div>';
      h += '<div class="case-body"><div class="case-name">' + esc(it.name) + '</div>';
      if (it.alg) h += '<div class="alg-moves alg-moves-sm" data-role="moves">' + movesHTML(it.alg) + (rep ? '<span class="mv-rep">×' + rep + '</span>' : '') + '</div>';
      if (it.desc) h += '<p class="case-desc">' + it.desc + '</p>';
      if (it.alg) h += algButtons(rep, true);
      h += '</div></div>';
    });
    return h + '</div></div>';
  };

  R.practice = function (s) {
    var full = s.stage === 'full';
    return '<div class="practice" data-stage="' + esc(s.stage) + '">' +
      '<div class="practice-head"><span class="practice-tag">练习</span><span class="practice-stage">' + esc(STAGE_NAME[s.stage] || s.stage) + '</span>' +
      '<span class="practice-count">已完成 <b data-role="count">0</b> 次</span></div>' +
      (s.html ? '<div class="practice-desc">' + s.html + '</div>' : '') +
      '<div class="practice-btns">' +
      '<button type="button" class="btn btn-play" data-action="practice-new">' + (full ? '打乱' : '出题') + '</button>' +
      '<button type="button" class="btn" data-action="practice-hint">提示</button>' +
      '<button type="button" class="btn" data-action="practice-solve">' + (full ? '自动解' : '看答案') + '</button>' +
      '<button type="button" class="btn btn-ghost" data-action="practice-reset">重置</button></div>' +
      '<div class="practice-status" data-role="status" aria-live="polite">点「' + (full ? '打乱' : '出题') + '」开始。</div>' +
      '<div class="practice-hint" data-role="hint" hidden></div></div>';
  };

  R.quiz = function (s, ctx) {
    ctx.quiz++;
    var h = '<div class="quiz" data-answer="' + s.answer + '" id="quiz-' + esc(ctx.num) + '-' + ctx.quiz + '">' +
      '<p class="quiz-q"><span class="quiz-tag">小测</span>' + esc(s.q) + '</p><div class="quiz-opts">';
    s.options.forEach(function (o, i) {
      h += '<button type="button" class="opt" data-action="quiz" data-i="' + i + '">' + esc(o) + '</button>';
    });
    return h + '</div><div class="quiz-explain" data-role="explain" hidden>' + (s.explain || '') + '</div></div>';
  };

  R.steps = function (s) {
    return '<ol class="steps">' + s.items.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ol>';
  };

  function sectionHTML(sec, ctx) {
    ctx = ctx || { fig: 0, quiz: 0, num: '00', figPrefix: '' };
    var fn = R[sec.type];
    return fn ? '<div class="sec sec-' + sec.type + '">' + fn(sec, ctx) + '</div>' : '';
  }

  function chapterHTML(ch, opts) {
    opts = opts || {};
    var total = opts.total || '11';
    var ctx = { fig: 0, quiz: 0, num: ch.num, figPrefix: opts.figPrefix != null ? opts.figPrefix : (ch.num + '-') };
    var h = '<header class="ch-head">' +
      '<div class="ch-num"><span class="ch-num-cur">' + esc(ch.num) + '</span><span class="ch-num-tot"> / ' + esc(total) + '</span></div>' +
      '<h2 class="ch-title">' + esc(ch.title) + '</h2>' +
      (ch.tagline ? '<p class="ch-tagline">' + esc(ch.tagline) + '</p>' : '') +
      '<div class="ch-tools">' +
      (ch.script && ch.script.length ? '<button type="button" class="btn btn-play" data-action="play-script" data-chapter="' + esc(ch.id) + '">▶ 自动讲解</button>' : '') +
      '<label class="done-toggle"><input type="checkbox" data-action="done" data-chapter="' + esc(ch.id) + '"><span>完成</span></label>' +
      '</div></header><div class="ch-body">';
    (ch.sections || []).forEach(function (sec) { h += sectionHTML(sec, ctx); });
    return h + '</div>';
  }

  function renderChapter(ch, opts) {
    var el = document.createElement('article');
    el.className = 'chapter';
    el.id = anchor(ch);
    el.setAttribute('data-chapter', ch.id);
    if (ch.stage) el.setAttribute('data-stage', ch.stage);
    el.innerHTML = chapterHTML(ch, opts);
    return el;
  }

  function renderAll(lessons, container) {
    if (!container) return null;
    var total = lessons.length ? lessons[lessons.length - 1].num : '11';
    var frag = document.createDocumentFragment();
    lessons.forEach(function (ch) { frag.appendChild(renderChapter(ch, { total: total })); });
    container.innerHTML = '';
    container.appendChild(frag);
    var toc = document.getElementById('toc');
    if (toc) renderToc(lessons, toc);
    return container;
  }

  // 章节目录：<a href="#ch-04" data-chapter="cross"><span class="toc-num">04</span>…<span class="toc-done" data-role="toc-done"></span></a>
  function renderToc(lessons, navEl) {
    if (!navEl) return null;
    navEl.innerHTML = '<ol class="toc-list">' + lessons.map(function (ch) {
      return '<li><a href="#' + anchor(ch) + '" data-chapter="' + esc(ch.id) + '"><span class="toc-num">' + esc(ch.num) +
        '</span><span class="toc-title">' + esc(ch.title) + '</span><span class="toc-done" data-role="toc-done" aria-hidden="true"></span></a></li>';
    }).join('') + '</ol>';
    return navEl;
  }

  var CubeRender = { renderAll: renderAll, renderChapter: renderChapter, chapterHTML: chapterHTML,
    renderToc: renderToc, movesHTML: movesHTML, sectionHTML: sectionHTML, esc: esc, STAGE_NAME: STAGE_NAME };
  if (typeof module !== 'undefined' && module.exports) module.exports = CubeRender; else window.CubeRender = CubeRender;
})();
