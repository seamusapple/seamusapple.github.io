/* app.js — 胶水层：把 CubeModel / CubeSolver / CubeView / LESSONS / CubeRender 接起来。
 * 全局 CubeApp。所有交互都靠 render.js / index.html 里的 data-* 钩子，在 document 上统一委托。
 * 「一次只做一件事」：公式播放、自动讲解、看答案都是一个 run（begin/stopAll/alive），
 * 新的动作开始前先停掉旧的，旧的异步链通过 alive(id) 自行退出，不会叠加动画。
 * ?selftest=1：速度设 0，自动跑练习 / 公式 / 讲解等断言，结果写入 <pre id="selftest">。 */
(function () {
  'use strict';

  var CM = window.CubeModel, CS = window.CubeSolver, LESSONS = window.LESSONS || [];
  var SOLVED = CM.SOLVED;
  var STAGES = CM.STAGES;
  var DEFAULT_WAIT = 1800;
  var SELFTEST = /[?&]selftest=1\b/.test(location.search);

  // ---------- 小工具 ----------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function store(key, val) {
    try {
      if (val === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, val);
    } catch (e) { /* 隐私模式 / 禁用存储：静默忽略 */ }
    return null;
  }
  function storeJSON(key, fallback) {
    try { var v = JSON.parse(store(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, Math.max(0, ms)); }); }
  function mql(q) { try { return window.matchMedia(q).matches; } catch (e) { return false; } }
  function reducedMotion() { return mql('(prefers-reduced-motion: reduce)'); }
  function isMobile() { return mql('(max-width: 959px)'); }
  function setupState(setup) {
    if (!setup || setup === 'solved') return SOLVED;
    if (/^[WYGBOR]{54}$/.test(setup)) return setup;
    return CM.apply(SOLVED, setup);
  }
  function rep(arr, n) { var o = []; for (var i = 0; i < n; i++) o = o.concat(arr); return o; }
  function shortTitle(ch) { return String(ch.title).replace(/^第.步\s*·\s*/, ''); }
  function chapterById(id) { for (var i = 0; i < LESSONS.length; i++) if (LESSONS[i].id === id) return LESSONS[i]; return null; }
  function scrollToEl(el) {
    if (!el) return;
    try { el.scrollIntoView({ behavior: reducedMotion() || SELFTEST ? 'auto' : 'smooth', block: 'start' }); } catch (e) { el.scrollIntoView(); }
  }

  // 没有 three.js（CDN 失败）时的纯逻辑替身：练习判定等仍能工作，只是没有画面
  function LogicView() { this._s = SOLVED; this._l = { move: [], drag: [] }; }
  LogicView.prototype = {
    getState: function () { return this._s; },
    setState: function (s) { this._s = s; },
    move: function (alg) {
      var self = this;
      CM.parse(alg).forEach(function (m) {
        self._s = CM.apply(self._s, [m]);
        self._l.move.forEach(function (fn) { fn(m, self._s); });
      });
      return Promise.resolve(this._s);
    },
    on: function (ev, fn) { (this._l[ev] = this._l[ev] || []).push(fn); return this; },
    off: function () { return this; },
    setSpeed: function () {}, cancel: function () {}, highlight: function () {}, clearHighlight: function () {},
    lookAt: function () {}, setAxes: function () {}, resize: function () {}, destroy: function () {},
    isBusy: function () { return false; }
  };

  // ---------- 全局状态 ----------
  var view = null;
  var net = null;                    // 平面展开图（CubeNet），和 3D 同步
  var netPicked = null;
  var speed = 350;                   // 每步毫秒（滑块）
  var run = { id: 0, kind: null, el: null };
  var suppress = 0;                  // >0 时忽略 move 事件（setState / 快进时）
  var caption = null;
  var pr = null;                     // 当前练习 {el, stage, start, done, solving, badTimer}
  var stepper = null;                // 单步播放 {card, moves, i, expect}
  var sc = { ch: null, idx: 0, phase: 'none', limit: null }; // 自动讲解
  var currentChapter = null;         // 视口中的当前章节 id
  var waitScale = 1;                 // selftest 时为 0

  function setCaption(t) { if (caption) caption.textContent = t || ''; }
  function highlight(hl) {
    if (!view) return;
    if (hl == null) return;
    var list = [].concat(hl).filter(Boolean);
    if (list.length) view.highlight(list); else view.clearHighlight();
  }
  function setStateQuiet(s) {
    suppress++;
    try { view.setState(s); } finally { suppress--; }
  }
  function moveDur(d) { return d == null ? undefined : { duration: d }; }

  // ---------- run：同一时刻只有一个演示在跑 ----------
  function begin(kind, el) {
    stopAll();
    run.id++; run.kind = kind; run.el = el || null;
    return run.id;
  }
  function alive(id) { return id === run.id; }
  function end(id) { if (alive(id)) { run.kind = null; run.el = null; } }
  function stopAll() {
    var kind = run.kind, el = run.el;
    if (!kind) return;
    run.id++; run.kind = null; run.el = null;
    suppress++;
    try { view.cancel(); } finally { suppress--; }
    if (kind === 'alg' && el) {
      el.classList.remove('is-playing');
      $$('.mv.active', el).forEach(function (s) { s.classList.remove('active'); });
      setAlgStatus(el, '已停止');
    } else if (kind === 'script') {
      if (sc.phase === 'pre') sc.phase = 'dirty';
      updateScriptUI();
    } else if (kind === 'solve' && el) {
      if (pr && pr.el === el) pr.solving = false;
      setStatus(el, '演示已中断。可以接着自己转，或再点「看答案」。');
    }
  }

  // =====================================================================
  // 转动按钮 / 键盘
  // =====================================================================
  function userMove(m) {
    stopAll();
    if (stepper) stepper = null;
    view.move(m).catch(function (e) { console.warn(e); });
  }

  function onKey(e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || (t && t.isContentEditable)) return;
    if (e.key === ' ' || e.code === 'Space') {
      // 焦点在普通按钮上时，空格交给按钮自己；转动按钮除外
      if ((tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY') && !(t.hasAttribute && t.hasAttribute('data-move'))) return;
      e.preventDefault();
      if (!e.repeat) scriptToggle();
      return;
    }
    if (e.repeat) return;
    var k = (e.key || '').toLowerCase();
    if (k.length !== 1 || 'udfblrxyz'.indexOf(k) < 0) return;
    var m = ('xyz'.indexOf(k) >= 0 ? k : k.toUpperCase()) + (e.shiftKey ? "'" : '');
    e.preventDefault();
    userMove(m);
  }

  // =====================================================================
  // 公式卡：播放 / 单步 / 慢速 / 摆位
  // =====================================================================
  function cardInfo(card) {
    var moves = CM.parse(card.getAttribute('data-alg') || '');
    var repeat = Math.max(1, parseInt(card.getAttribute('data-repeat'), 10) || 1);
    var hl = (card.getAttribute('data-hl') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var nameEl = $('.alg-name', card) || $('.case-name', card);
    return { moves: moves, repeat: repeat, hl: hl, setup: card.getAttribute('data-setup') || '', name: nameEl ? nameEl.textContent : '' };
  }
  function spans(card) { return $$('[data-role=moves] .mv', card); }
  function resetSpans(card) { spans(card).forEach(function (s) { s.classList.remove('active', 'done'); }); }
  function setAlgStatus(card, t) { var st = $('[data-role=alg-status]', card); if (st) st.textContent = t || ''; }

  function setupCard(card, info) {
    disarmPractice();
    setStateQuiet(setupState(info.setup));
    if (info.hl.length) view.highlight(info.hl); else view.clearHighlight();
    resetSpans(card);
  }

  function playAlg(card, dur) {
    var info = cardInfo(card);
    var id = begin('alg', card);
    stepper = null;
    setupCard(card, info);
    card.classList.add('is-playing');
    var sp = spans(card), n = info.moves.length, all = rep(info.moves, info.repeat), i = 0;
    function next() {
      if (!alive(id)) return Promise.resolve(false);
      if (i >= all.length) return Promise.resolve(true);
      var k = i++, j = k % n, r = Math.floor(k / n) + 1;
      if (j === 0 && k > 0) resetSpans(card);
      if (info.repeat > 1) setAlgStatus(card, '第 ' + r + '/' + info.repeat + ' 遍 · 第 ' + (j + 1) + '/' + n + ' 步');
      else setAlgStatus(card, '第 ' + (j + 1) + '/' + n + ' 步');
      if (sp[j]) sp[j].classList.add('active');
      setCaption((info.repeat > 1 ? '第 ' + r + '/' + info.repeat + ' 遍 · ' : '') + '第 ' + (j + 1) + '/' + n + ' 步：' + all[k]);
      return view.move(all[k], moveDur(dur)).then(function () {
        if (!alive(id)) return false;
        if (sp[j]) { sp[j].classList.remove('active'); sp[j].classList.add('done'); }
        return next();
      });
    }
    return next().then(function (ok) {
      if (!ok) return false;
      card.classList.remove('is-playing');
      var s = view.getState();
      setAlgStatus(card, CM.isSolved(s) ? '播放完毕 · 魔方已复原' : '播放完毕');
      setCaption('');
      end(id);
      return true;
    });
  }

  function stepAlg(card) {
    stopAll();
    var info = cardInfo(card);
    var all = rep(info.moves, info.repeat), n = info.moves.length;
    if (!stepper || stepper.card !== card || stepper.i >= all.length || view.getState() !== stepper.expect) {
      setupCard(card, info);
      stepper = { card: card, moves: all, i: 0, expect: view.getState() };
      setAlgStatus(card, '已摆好初始状态。再点「单步」做第 1 步（共 ' + all.length + ' 步）');
      setCaption('');
      return Promise.resolve();
    }
    if (view.isBusy()) view.cancel();
    var k = stepper.i++, j = k % n, sp = spans(card);
    if (j === 0) resetSpans(card);
    sp.forEach(function (s) { s.classList.remove('active'); });
    if (sp[j]) sp[j].classList.add('active');
    var m = all[k];
    stepper.expect = CM.apply(stepper.expect, [m]);
    var r = Math.floor(k / n) + 1;
    setAlgStatus(card, '第 ' + (k + 1) + '/' + all.length + ' 步：' + m + (info.repeat > 1 ? '（第 ' + r + '/' + info.repeat + ' 遍）' : '') +
      (k + 1 === all.length ? ' · 最后一步' : ''));
    setCaption(m);
    var mine = stepper;
    return view.move(m).then(function () {
      if (sp[j]) { sp[j].classList.remove('active'); sp[j].classList.add('done'); }
      if (mine === stepper && stepper.i >= all.length) setAlgStatus(card, '单步完成' + (CM.isSolved(view.getState()) ? ' · 魔方已复原' : '') + '。再点一次「单步」从头来。');
    });
  }

  function setupAlg(card) {
    stopAll();
    stepper = null;
    setupCard(card, cardInfo(card));
    setAlgStatus(card, '已摆好初始状态');
    setCaption('');
  }

  // =====================================================================
  // 练习
  // =====================================================================
  function practiceKey(stage) { return 'cube.practice.' + stage; }
  function practiceCount(stage) { return parseInt(store(practiceKey(stage)), 10) || 0; }
  function renderCounts() {
    $$('.practice[data-stage]').forEach(function (el) {
      var c = $('[data-role=count]', el);
      if (c) c.textContent = practiceCount(el.getAttribute('data-stage'));
    });
  }
  function setStatus(el, text, cls) {
    var st = $('[data-role=status]', el);
    if (!st) return;
    st.textContent = text;
    st.classList.remove('is-ok', 'is-bad');
    if (cls) st.classList.add(cls);
  }
  function hideHint(el) { var h = $('[data-role=hint]', el); if (h) { h.hidden = true; h.innerHTML = ''; } }
  function disarmPractice() {
    if (!pr) return;
    clearTimeout(pr.badTimer);
    if (!pr.done) setStatus(pr.el, '练习已暂停（魔方被拿去演示了）。点「重置」回到本题，或「出题」换一题。');
    pr.armed = false;
  }
  function stageDone(state, stage) { return stage === 'full' ? CM.isSolved(state) : CM.isStageSolved(state, stage); }

  function makePuzzle(stage) {
    var k = STAGES.indexOf(stage);
    for (var t = 0; t < 40; t++) {
      var s = CM.scramble(25).state;
      if (stage === 'full' || k <= 0) { if (!stageDone(s, stage)) return s; continue; }
      var r = CS.solve(s);
      if (!r.ok) continue;
      var p = r.stages[k - 1].state;
      if (!CM.isStageSolved(p, stage)) return p;
    }
    return CM.scramble(25).state;
  }

  function practiceNew(el) {
    stopAll();
    stepper = null;
    if (pr) clearTimeout(pr.badTimer);
    var stage = el.getAttribute('data-stage');
    var s = makePuzzle(stage);
    setStateQuiet(s);
    view.clearHighlight();
    pr = { el: el, stage: stage, start: s, armed: true, done: false, solving: false, badTimer: 0 };
    hideHint(el);
    setStatus(el, '题目已出，开始吧。');
    setCaption(stage === 'full' ? '已随机打乱 25 步' : '新题：前面的阶段已经帮你做好');
    $$('.practice').forEach(function (p) { p.classList.toggle('is-active', p === el); });
    return s;
  }

  function practiceReset(el) {
    stopAll();
    stepper = null;
    if (!pr || pr.el !== el) { setStatus(el, '还没出题：先点「' + (el.getAttribute('data-stage') === 'full' ? '打乱' : '出题') + '」。'); return; }
    clearTimeout(pr.badTimer);
    setStateQuiet(pr.start);
    view.clearHighlight();
    pr.armed = true; pr.done = false; pr.solving = false;
    hideHint(el);
    setStatus(el, '已回到本题起点。');
    setCaption('');
  }

  function practiceHint(el) {
    stopAll();
    var stage = el.getAttribute('data-stage');
    var s = view.getState();
    var h = $('[data-role=hint]', el);
    if (!h) return;
    h.hidden = false;
    if (stageDone(s, stage)) { h.textContent = stage === 'full' ? '已经完全复原了！' : '这一阶段已经完成了。'; return; }
    var r = null;
    try { r = CS.hint(s); } catch (e) { r = null; }
    if (!r) { h.textContent = '这个状态求解器解不了（可能被拆装过）。点「重置」或「出题」。'; return; }
    h.innerHTML = '<b>' + esc(r.title) + '</b>：' + esc(r.step.note) + ' <code>' + esc(r.step.moves.join(' ')) + '</code>';
    highlight(r.step.highlight);
  }

  function practiceSolve(el) {
    var stage = el.getAttribute('data-stage');
    var id = begin('solve', el);
    stepper = null;
    var s = view.getState();
    hideHint(el);
    if (stageDone(s, stage)) { setStatus(el, '这一阶段已经完成了。', 'is-ok'); end(id); return Promise.resolve(true); }
    var r = CS.solve(s);
    if (!r.ok) { setStatus(el, '这个状态求解器解不了。点「重置」或「出题」。', 'is-bad'); end(id); return Promise.resolve(false); }
    if (pr && pr.el === el) { pr.solving = true; clearTimeout(pr.badTimer); } else disarmPractice();
    var last = stage === 'full' ? STAGES.length - 1 : STAGES.indexOf(stage);
    var steps = [];
    r.stages.forEach(function (stg, i) {
      if (i <= last) stg.steps.forEach(function (st) { steps.push({ stage: stg.title, step: st }); });
    });
    setStatus(el, '正在演示答案（共 ' + steps.length + ' 段）……点任意按钮可打断。');
    var i = 0;
    function next() {
      if (!alive(id)) return Promise.resolve(false);
      if (i >= steps.length) return Promise.resolve(true);
      var it = steps[i++];
      setCaption(it.stage + '：' + it.step.note + '  ' + it.step.moves.join(' '));
      highlight(it.step.highlight);
      setStatus(el, '演示中 ' + i + '/' + steps.length + ' · ' + it.stage);
      return view.move(it.step.moves.join(' ')).then(function () { return next(); });
    }
    return next().then(function (ok) {
      if (!ok) return false;
      end(id);
      if (pr && pr.el === el) pr.solving = false;
      view.clearHighlight();
      var done = stageDone(view.getState(), stage);
      setStatus(el, done ? '答案演示完毕（看答案不计入完成次数）。点「重置」自己再做一遍。' : '演示结束，但状态没有达标——请反馈这个题目。', done ? 'is-ok' : 'is-bad');
      setCaption(done ? (stage === 'full' ? '复原完成' : '本阶段完成') : '');
      return done;
    });
  }

  function celebrate(el) {
    [el, $('.viewport')].forEach(function (x) {
      if (!x) return;
      x.classList.remove('is-celebrate');
      void x.offsetWidth; // 重新触发动画
      x.classList.add('is-celebrate');
      setTimeout(function () { x.classList.remove('is-celebrate'); }, 1400);
    });
  }

  function onViewMove(m, state) {
    if (suppress || !pr || !pr.armed || pr.solving || pr.done) return;
    var el = pr.el, stage = pr.stage;
    clearTimeout(pr.badTimer);
    if (stageDone(state, stage)) {
      pr.done = true;
      var n = practiceCount(stage) + 1;
      store(practiceKey(stage), String(n));
      renderCounts();
      setStatus(el, stage === 'full' ? '完成！整个魔方复原了。' : '完成！这一阶段达标了。', 'is-ok');
      setCaption('完成！');
      hideHint(el);
      view.clearHighlight();
      celebrate(el);
      return;
    }
    var need = stage === 'full' ? -1 : STAGES.indexOf(stage) - 1;
    if (need < 0) { maybeClearBad(el); return; }
    if (CM.stageProgress(state) >= need) { maybeClearBad(el); return; }
    // 公式做到一半时前面的阶段本来就会暂时被拆开：停手 1.5 秒后仍然倒退才提示
    var mine = pr;
    pr.badTimer = setTimeout(function () {
      if (pr !== mine || !pr.armed || pr.done || pr.solving || view.isBusy()) return;
      if (CM.stageProgress(view.getState()) < need) setStatus(el, '前面的阶段被打乱了，点重置或看提示。', 'is-bad');
    }, 1500);
  }
  function maybeClearBad(el) {
    var st = $('[data-role=status]', el);
    if (st && st.classList.contains('is-bad')) setStatus(el, '好，前面的阶段恢复了，继续。');
  }

  // =====================================================================
  // 自动讲解
  // =====================================================================
  function rate() { var s = $('[data-control=script-rate]'); return Math.max(0.25, parseFloat(s && s.value) || 1); }
  function scriptDur() { return speed / rate(); }
  function scriptWait(st) { return (st.wait != null ? st.wait : DEFAULT_WAIT) / rate() * waitScale; }

  // 进入一句：setup → look → hl → 字幕
  function enterSentence(st, instant) {
    if (st.setup != null) { setStateQuiet(setupState(st.setup)); if (st.hl === undefined) view.clearHighlight(); }
    if (st.look) { view.lookAt(st.look, instant ? { duration: 0 } : undefined); markLook(st.look); }
    if (st.hl !== undefined) highlight(st.hl || []);
    setCaption(st.say || '');
  }
  // 快进到第 idx 句之前的状态（瞬间），再进入第 idx 句：保证跳句后状态、视角、高亮与顺序播放一致
  function prepare(idx) {
    var script = sc.ch.script;
    suppress++;
    try {
      view.setState(SOLVED);
      view.clearHighlight();
      var look = 'front';
      for (var j = 0; j < idx && j < script.length; j++) {
        var st = script[j];
        if (st.setup != null) { view.setState(setupState(st.setup)); if (st.hl === undefined) view.clearHighlight(); }
        if (st.look) look = st.look;
        if (st.hl !== undefined) highlight(st.hl || []);
        if (st.do) view.move(st.do, { duration: 0 });
      }
      view.lookAt(look, { duration: 0 }); markLook(look);
      if (idx < script.length) enterSentence(script[idx], true);
    } finally { suppress--; }
  }

  function nextChapterWithScript(ch) {
    var i = LESSONS.indexOf(ch);
    for (var k = i + 1; k < LESSONS.length; k++) if (LESSONS[k].script && LESSONS[k].script.length) return LESSONS[k];
    return null;
  }
  function showChapterEnd() {
    var nx = nextChapterWithScript(sc.ch);
    setCaption(nx ? '本章讲完 · 下一章：' + nx.num + ' ' + shortTitle(nx) + '（点 ⏭ 继续）' : '全部讲完。去练习场自己还原一次吧！');
    view.clearHighlight();
  }

  function updateScriptUI() {
    var playing = run.kind === 'script';
    var label = $('[data-role=script-label]');
    if (label) {
      if (!sc.ch) label.textContent = '自动讲解';
      else {
        var len = sc.ch.script.length;
        label.textContent = sc.ch.num + ' ' + shortTitle(sc.ch) + ' · ' + (sc.idx >= len ? '讲完' : (sc.idx + 1) + '/' + len);
      }
    }
    var tg = $('[data-action=script-toggle]');
    if (tg) { tg.textContent = playing ? '❚❚' : '▶'; tg.setAttribute('aria-label', playing ? '暂停' : '播放'); }
    $$('[data-action=play-script]').forEach(function (b) {
      var on = playing && sc.ch && sc.ch.id === b.getAttribute('data-chapter');
      b.textContent = on ? '❚❚ 暂停讲解' : (sc.ch && sc.ch.id === b.getAttribute('data-chapter') && sc.idx > 0 && sc.idx < sc.ch.script.length ? '▶ 继续讲解' : '▶ 自动讲解');
    });
  }

  function loadChapter(ch, scroll) {
    sc.ch = ch; sc.idx = 0; sc.phase = 'dirty';
    disarmPractice();
    stepper = null;
    if (scroll) scrollToEl(document.getElementById('ch-' + ch.num));
    updateScriptUI();
  }

  function scriptPlay() {
    if (!sc.ch) return Promise.resolve();
    if (sc.idx >= sc.ch.script.length) { sc.idx = 0; sc.phase = 'dirty'; }
    var id = begin('script');
    disarmPractice();
    stepper = null;
    updateScriptUI();
    return scriptLoop(id);
  }

  function scriptLoop(id) {
    if (!alive(id)) return Promise.resolve();
    var script = sc.ch.script;
    if (sc.limit != null && sc.idx >= sc.limit) { stopAll(); return Promise.resolve(); }
    if (sc.idx >= script.length) { end(id); showChapterEnd(); updateScriptUI(); return Promise.resolve(); }
    var st = script[sc.idx];
    if (sc.phase === 'dirty') { prepare(sc.idx); sc.phase = 'pre'; }
    else if (sc.phase === 'none') { enterSentence(st, false); sc.phase = 'pre'; }
    updateScriptUI();
    var p;
    if (sc.phase === 'pre') {
      p = (st.do ? view.move(st.do, { duration: scriptDur() }) : Promise.resolve()).then(function () {
        if (!alive(id)) return 'stop';
        sc.phase = 'post';
        return sleep(scriptWait(st));
      });
    } else p = Promise.resolve();
    return p.then(function (r) {
      if (r === 'stop' || !alive(id)) return;
      sc.idx++; sc.phase = 'none';
      return scriptLoop(id);
    });
  }

  function scriptPause() { if (run.kind === 'script') stopAll(); updateScriptUI(); }

  function scriptToggle() {
    if (run.kind === 'script') { scriptPause(); return Promise.resolve(); }
    var ch = sc.ch;
    if (ch && sc.idx >= ch.script.length) {
      var nx = nextChapterWithScript(ch);
      if (nx) { loadChapter(nx, true); return scriptPlay(); }
      loadChapter(ch, true); return scriptPlay();
    }
    var vis = chapterById(currentChapter);
    if (vis && vis.script && vis.script.length && vis !== ch) { loadChapter(vis, false); return scriptPlay(); }
    if (!ch) {
      ch = vis && vis.script && vis.script.length ? vis : nextChapterWithScript({}) || LESSONS[0];
      loadChapter(ch, !vis);
    }
    return scriptPlay();
  }

  function playScriptChapter(id) {
    var ch = chapterById(id);
    if (!ch || !ch.script || !ch.script.length) return Promise.resolve();
    if (sc.ch === ch) {
      if (run.kind === 'script') { scriptPause(); return Promise.resolve(); }
      return scriptPlay();
    }
    loadChapter(ch, true);
    return scriptPlay();
  }

  function scriptJump(delta) {
    var wasPlaying = run.kind === 'script';
    if (wasPlaying) stopAll();
    if (!sc.ch) {
      var vis = chapterById(currentChapter);
      loadChapter(vis && vis.script && vis.script.length ? vis : LESSONS[0], false);
      sc.idx = 0;
    } else {
      var len = sc.ch.script.length;
      if (delta > 0 && sc.idx >= len) {
        var nx = nextChapterWithScript(sc.ch);
        if (!nx) { showChapterEnd(); updateScriptUI(); return; }
        loadChapter(nx, true);
        sc.idx = 0;
        wasPlaying = true; // 「继续」：进入下一章并开始讲
      } else {
        sc.idx = Math.max(0, Math.min(len, sc.idx + delta));
      }
    }
    stepper = null;
    disarmPractice();
    if (sc.idx >= sc.ch.script.length) { sc.phase = 'none'; prepare(sc.idx); showChapterEnd(); updateScriptUI(); return; }
    prepare(sc.idx);
    sc.phase = 'pre';
    updateScriptUI();
    if (wasPlaying) scriptPlay();
  }

  // =====================================================================
  // 进度 / 导航
  // =====================================================================
  function doneList() { var v = storeJSON('cube.done', []); return Array.isArray(v) ? v : []; }
  function renderProgress() {
    var done = doneList(), total = LESSONS.length || 12;
    var n = LESSONS.filter(function (c) { return done.indexOf(c.id) >= 0; }).length;
    var bar = $('[data-role=progress-bar]'), prog = $('[data-role=progress]'), txt = $('[data-role=progress-text]');
    if (bar) bar.style.width = (n / total * 100).toFixed(1) + '%';
    if (prog) { prog.setAttribute('aria-valuenow', n); prog.setAttribute('aria-valuemax', total); }
    if (txt) txt.textContent = n + ' / ' + total + ' 章';
    $$('#toc a[data-chapter]').forEach(function (a) { a.classList.toggle('is-done', done.indexOf(a.getAttribute('data-chapter')) >= 0); });
    $$('input[data-action=done]').forEach(function (cb) { cb.checked = done.indexOf(cb.getAttribute('data-chapter')) >= 0; });
  }
  function setDone(id, on) {
    var d = doneList().filter(function (x) { return x !== id; });
    if (on) d.push(id);
    store('cube.done', JSON.stringify(d));
    renderProgress();
  }

  var io = null;
  function readingLine() {
    if (isMobile()) { var st = $('#stage'); return Math.min(window.innerHeight - 40, (st ? st.getBoundingClientRect().bottom : 0) + 60); }
    return Math.round(window.innerHeight * 0.3);
  }
  function pickCurrent() {
    var line = readingLine(), cur = null;
    $$('article.chapter').forEach(function (a) { if (a.getBoundingClientRect().top <= line) cur = a; });
    if (!cur) cur = $('article.chapter');
    var id = cur ? cur.getAttribute('data-chapter') : null;
    if (id === currentChapter) return;
    currentChapter = id;
    $$('#toc a[data-chapter]').forEach(function (a) { a.classList.toggle('is-current', a.getAttribute('data-chapter') === id); });
    if (!run.kind && !(pr && pr.armed)) view.clearHighlight();
  }
  function setupObserver() {
    if (io) io.disconnect();
    var arts = $$('article.chapter');
    if (typeof IntersectionObserver === 'undefined') {
      var t = 0;
      window.addEventListener('scroll', function () { if (!t) t = requestAnimationFrame(function () { t = 0; pickCurrent(); }); }, { passive: true });
      pickCurrent();
      return;
    }
    var line = readingLine(), h = window.innerHeight;
    // 根区域收窄成「阅读线」附近一条细带：章节进出这条带时重新挑当前章
    io = new IntersectionObserver(function () { pickCurrent(); },
      { rootMargin: '-' + line + 'px 0px -' + Math.max(0, h - line - 2) + 'px 0px', threshold: 0 });
    arts.forEach(function (a) { io.observe(a); });
    pickCurrent();
  }

  function gotoHash() {
    var h = location.hash && decodeURIComponent(location.hash.slice(1));
    if (!h) return;
    var el = document.getElementById(h);
    if (el) el.scrollIntoView();
  }

  // =====================================================================
  // 视角 / 工具 / 小测 / 打印 / 手机收起
  // =====================================================================
  function markLook(look) {
    $$('[data-action=look]').forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-look') === look); });
  }
  function setSpeed(ms) {
    speed = Math.max(0, +ms || 0);
    if (view) view.setSpeed(speed);
    var s = $('[data-control=speed]');
    if (s && +s.value !== speed) s.value = speed;
  }

  function answerQuiz(btn) {
    var q = btn.closest('.quiz');
    if (!q || q.classList.contains('is-answered')) return;
    var ans = parseInt(q.getAttribute('data-answer'), 10), i = parseInt(btn.getAttribute('data-i'), 10);
    $$('.opt', q).forEach(function (o) {
      var k = parseInt(o.getAttribute('data-i'), 10);
      if (k === ans) o.classList.add('is-right');
      if (o !== btn) o.disabled = true;
    });
    if (i !== ans) btn.classList.add('is-wrong');
    btn.setAttribute('aria-pressed', 'true');
    q.classList.add('is-answered');
    var ex = $('[data-role=explain]', q);
    if (ex) { ex.hidden = false; ex.insertAdjacentHTML('afterbegin', '<b class="quiz-verdict">' + (i === ans ? '答对了。' : '不对。') + '</b> '); }
  }

  function printCheatsheet() {
    document.body.classList.add('print-cheatsheet');
    var off = function () { document.body.classList.remove('print-cheatsheet'); window.removeEventListener('afterprint', off); };
    window.addEventListener('afterprint', off);
    try { window.print(); } catch (e) { /* ignore */ }
    setTimeout(off, 1500);
  }

  // =====================================================================
  // 平面展开图：包一层 view 的 setState / highlight，让展开图始终和 3D 一致
  // =====================================================================
  var COLOR_CN = { W: '白', Y: '黄', G: '绿', B: '蓝', O: '橙', R: '红' };
  // 展开图 + 环形图：两份都保持同步，只显示当前选中的那一个
  function makeNetGroup(list) {
    var call = function (name) {
      return function () { var args = arguments; list.forEach(function (n) { n[name].apply(n, args); }); };
    };
    return { update: call('update'), highlight: call('highlight'), clearHighlight: call('clearHighlight'),
      setFacing: call('setFacing'), setTurning: call('setTurning'),
      getState: function () { return list[0].getState(); }, parts: list };
  }
  function initNet() {
    var host = document.getElementById('cube-net');
    if (!host || !window.CubeNet) return;
    var parts = [new CubeNet(host, { state: view.getState(), onPick: onNetPick })];
    var ringHost = document.getElementById('cube-ring');
    if (ringHost && window.CubeRing) {
      try { parts.push(new CubeRing(ringHost, { state: view.getState(), onPick: onNetPick })); }
      catch (e) { console.warn('环形图不可用：', e && e.message); }
    }
    net = makeNetGroup(parts);
    var origSet = view.setState, origHl = view.highlight, origClear = view.clearHighlight;
    view.setState = function (s) { var r = origSet.apply(view, arguments); net.update(view.getState()); return r; };
    view.highlight = function (sel) { netPicked = null; net.highlight(sel, view.getState()); return origHl.apply(view, arguments); };
    view.clearHighlight = function () { netPicked = null; net.clearHighlight(); return origClear.apply(view, arguments); };
    view.on('move', function (m, st) { net.update(st || view.getState()); });
    view.on('turnstart', function (m, ms) { net.setTurning(m, ms); });
    view.on('view', function (f) { net.setFacing(f); });
    net.setFacing(view.facing ? view.facing() : { U: 1, F: 1, R: 1 });
    var on = store('cube.net');
    setNet(on === null || on === undefined ? true : on !== '0', false);
    setNetMode(store('cube.netMode') === 'ring' && parts.length > 1 ? 'ring' : 'flat', false);
  }
  function setNetMode(mode, save) {
    $$('#net-panel [data-view]').forEach(function (e) { e.hidden = e.getAttribute('data-view') !== mode; });
    $$('[data-action=net-mode]').forEach(function (b) {
      var on = b.getAttribute('data-mode') === mode;
      b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.body.classList.toggle('net-ring', mode === 'ring');
    if (save) store('cube.netMode', mode);
  }
  function onNetPick(pos, k) {
    if (netPicked === pos) { view.clearHighlight(); setCaption(''); return; }
    view.highlight([pos]);
    netPicked = pos;
    var st = view.getState(), ids = CubeNet.SLOT_FACELETS[pos.split('').sort().join('')] || [k];
    var cols = ids.map(function (i) { return COLOR_CN[st[i]] || '?'; }).join('-');
    var kind = ids.length === 3 ? '角块（3 色）' : ids.length === 2 ? '棱块（2 色）' : '中心块（永远不动）';
    setCaption('这一格属于 ' + cols + ' ' + kind + '，3D 里已经亮起来了；再点一次取消');
  }
  function setNet(on, save) {
    document.body.classList.toggle('net-off', !on);
    var cb = $('[data-control=net]'); if (cb) cb.checked = !!on;
    if (save) store('cube.net', on ? '1' : '0');
    requestAnimationFrame(function () { if (view) view.resize(); });
  }

  function setCollapsed(on, save) {
    document.body.classList.toggle('stage-collapsed', !!on);
    var b = $('[data-action=toggle-stage]');
    if (b) { b.textContent = on ? '展开' : '收起'; b.setAttribute('aria-expanded', on ? 'false' : 'true'); }
    if (save) store('cube.stageCollapsed', on ? '1' : '0');
    requestAnimationFrame(function () { if (view) view.resize(); setupObserver(); });
  }

  // =====================================================================
  // 事件委托
  // =====================================================================
  function onClick(e) {
    var t = e.target.closest ? e.target.closest('[data-move],[data-action]') : null;
    if (!t) {
      var toc = $('details.toc');
      if (toc && toc.open && (!e.target.closest('details.toc') || e.target.closest('#toc a'))) toc.open = false;
      return;
    }
    if (t.hasAttribute('data-move')) { userMove(t.getAttribute('data-move')); return; }
    var a = t.getAttribute('data-action');
    var card = t.closest('[data-alg]'), prac = t.closest('.practice');
    switch (a) {
      case 'play-alg': if (card) playAlg(card); break;
      case 'slow-alg': if (card) playAlg(card, 900); break;
      case 'step-alg': if (card) stepAlg(card); break;
      case 'setup-alg': if (card) setupAlg(card); break;
      case 'practice-new': if (prac) practiceNew(prac); break;
      case 'practice-hint': if (prac) practiceHint(prac); break;
      case 'practice-solve': if (prac) practiceSolve(prac); break;
      case 'practice-reset': if (prac) practiceReset(prac); break;
      case 'quiz': answerQuiz(t); break;
      case 'play-script': playScriptChapter(t.getAttribute('data-chapter')); break;
      case 'script-toggle': scriptToggle(); break;
      case 'script-prev': scriptJump(-1); break;
      case 'script-next': scriptJump(1); break;
      case 'look': stopScriptOnly(); view.lookAt(t.getAttribute('data-look')); markLook(t.getAttribute('data-look')); break;
      case 'reset':
        stopAll(); stepper = null; disarmPractice();
        setStateQuiet(SOLVED); view.clearHighlight(); setCaption(''); break;
      case 'scramble':
        stopAll(); stepper = null; disarmPractice();
        var s = CM.scramble(20);
        setStateQuiet(s.state); view.clearHighlight();
        setCaption('打乱：' + s.moves.join(' '));
        break;
      case 'print-cheatsheet': printCheatsheet(); break;
      case 'net-mode': setNetMode(t.getAttribute('data-mode'), true); break;
      case 'toggle-stage': setCollapsed(!document.body.classList.contains('stage-collapsed'), true); break;
      case 'toggle-toc': break; // <details> 原生处理
      default: break;
    }
  }
  // 视角按钮不打断公式播放，但讲解中切视角会和脚本的 look 打架：只暂停讲解
  function stopScriptOnly() { if (run.kind === 'script') stopAll(); }

  function onChange(e) {
    var t = e.target;
    if (t.matches('input[data-action=done]')) setDone(t.getAttribute('data-chapter'), t.checked);
    else if (t.matches('[data-control=axes]')) view.setAxes(t.checked);
    else if (t.matches('[data-control=net]')) setNet(t.checked, true);
    else if (t.matches('[data-control=speed]')) { setSpeed(t.value); store('cube.speed', String(speed)); }
  }
  function onInput(e) {
    if (e.target.matches('[data-control=speed]')) setSpeed(e.target.value);
  }

  // =====================================================================
  // 启动
  // =====================================================================
  function init() {
    var chapters = document.getElementById('chapters');
    CubeRender.renderAll(LESSONS, chapters);
    caption = $('[data-role=caption]');

    var el = document.getElementById('cube-view');
    try { view = new CubeView(el, { state: SOLVED }); }
    catch (err) { console.warn('3D 视图不可用：', err && err.message); view = new LogicView(); }
    view.on('move', onViewMove);
    view.on('drag', function () { $$('[data-action=look]').forEach(function (b) { b.classList.remove('is-on'); }); });
    initNet();

    var saved = parseInt(store('cube.speed'), 10);
    if (reducedMotion()) setSpeed(0);
    else setSpeed(isNaN(saved) ? 350 : saved);

    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    document.addEventListener('input', onInput);
    document.addEventListener('keydown', onKey);

    renderProgress();
    renderCounts();
    updateScriptUI();
    if (store('cube.stageCollapsed') === '1' && isMobile()) setCollapsed(true, false);
    setupObserver();
    var rt = 0;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(setupObserver, 150); });
    window.addEventListener('hashchange', function () { setTimeout(pickCurrent, 50); });

    gotoHash();
    // 字体加载后布局会变：再对一次锚点
    if (location.hash) {
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { gotoHash(); });
      setTimeout(gotoHash, 400);
    }

    // 空闲时预热一次求解器（白十字的距离表等首次构建较慢）
    var warm = function () { try { CS.solve(CM.scramble(25).state); } catch (e) { /* ignore */ } };
    if (window.requestIdleCallback) window.requestIdleCallback(warm, { timeout: 3000 }); else setTimeout(warm, 1200);

    if (SELFTEST) setTimeout(selftest, 300);
  }

  // =====================================================================
  // 自测（?selftest=1）
  // =====================================================================
  function selftest() {
    var out = document.createElement('pre');
    out.id = 'selftest';
    out.style.cssText = 'position:relative;z-index:99;margin:16px;padding:12px;background:#000;color:#9f9;font:12px/1.5 monospace;white-space:pre-wrap';
    document.body.appendChild(out);
    var results = [];
    function log(ok, name, info) {
      var line = (ok ? 'ok   ' : 'FAIL ') + name + (info ? ' — ' + info : '');
      results.push(ok);
      out.textContent += line + '\n';
      console.log('[selftest] ' + line);
    }
    function tryStep(name, fn) {
      return function () {
        return Promise.resolve().then(fn).then(function (r) { log(r.ok, name, r.info); }, function (e) { log(false, name, 'exception: ' + (e && e.stack || e)); });
      };
    }
    setSpeed(0);
    waitScale = 0;
    var steps = [
      tryStep('3D 视图已渲染', function () {
        var cv = $('#cube-view canvas');
        if (!cv || !view.renderer) return { ok: false, info: '没有 WebGL canvas' };
        var info = view.renderer.info.render;
        var px = new Uint8Array(4), gl = view.renderer.getContext();
        view.renderer.render(view.scene, view.camera);
        gl.readPixels(Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        return { ok: cv.width > 0 && cv.height > 0 && px[3] > 0, info: 'canvas ' + cv.width + 'x' + cv.height + ' · css ' + cv.clientWidth + 'x' + cv.clientHeight + ' · calls ' + info.calls + ' · 中心像素 rgba(' + Array.prototype.join.call(px, ',') + ')' };
      }),
      tryStep('无横向滚动', function () {
        var de = document.documentElement;
        return { ok: de.scrollWidth <= de.clientWidth, info: 'scrollWidth=' + de.scrollWidth + ' clientWidth=' + de.clientWidth };
      }),
      tryStep('cross 练习：出题 → 看答案 → isStageSolved', function () {
        var el = $('.practice[data-stage=cross]');
        var s0 = practiceNew(el);
        var bad = CM.isStageSolved(s0, 'cross');
        return practiceSolve(el).then(function () {
          var s = view.getState();
          return { ok: !bad && CM.isStageSolved(s, 'cross') && CM.isValid(s), info: 'stageProgress=' + CM.stageProgress(s) };
        });
      }),
      tryStep('full 练习：打乱 → 自动解 → isSolved', function () {
        var el = $('.practice[data-stage=full]');
        var s0 = practiceNew(el);
        return practiceSolve(el).then(function () {
          var s = view.getState();
          return { ok: !CM.isSolved(s0) && CM.isSolved(s), info: 'moves=' + CS.solve(s0).total };
        });
      }),
      tryStep("第 03 章 R U R' U' ×6 → 回到起点", function () {
        var card = $('#ch-03 .alg-card[data-repeat="6"]');
        if (!card) return { ok: false, info: '找不到 ×6 卡' };
        var start = setupState(card.getAttribute('data-setup'));
        var moved = false;
        var probe = function () { if (view.getState() !== start) moved = true; };
        view.on('move', probe);
        return playAlg(card).then(function (done) {
          view.off('move', probe);
          var s = view.getState();
          var allDone = spans(card).every(function (x) { return x.classList.contains('done'); });
          return { ok: done && moved && s === start && allDone, info: 'status=' + $('[data-role=alg-status]', card).textContent };
        });
      }),
      tryStep('第 04 章自动讲解前 5 句', function () {
        var ch = chapterById('cross');
        var exp = SOLVED;
        ch.script.slice(0, 5).forEach(function (st) {
          if (st.setup != null) exp = setupState(st.setup);
          if (st.do) exp = CM.apply(exp, st.do);
        });
        sc.limit = 5;
        loadChapter(ch, true);
        return scriptPlay().then(function () {
          sc.limit = null;
          var lab = $('[data-role=script-label]').textContent;
          var s = view.getState();
          return { ok: s === exp && sc.idx === 5 && run.kind !== 'script', info: 'label=' + lab + ' caption=' + caption.textContent };
        });
      }),
      tryStep('全部章节脚本跑完，终态与模型一致', function () {
        var bad = [];
        var chain = Promise.resolve();
        LESSONS.forEach(function (ch) {
          if (!ch.script || !ch.script.length) return;
          chain = chain.then(function () {
            var exp = SOLVED;
            ch.script.forEach(function (st) { if (st.setup != null) exp = setupState(st.setup); if (st.do) exp = CM.apply(exp, st.do); });
            loadChapter(ch, false);
            return scriptPlay().then(function () {
              if (view.getState() !== exp || sc.idx !== ch.script.length || caption.textContent.indexOf('讲完') < 0) bad.push(ch.num);
            });
          });
        });
        return chain.then(function () { return { ok: !bad.length, info: bad.length ? '不一致：' + bad.join(',') : '12 章全部讲完' }; });
      }),
      tryStep('练习 + setSpeed(0) 手动转 → 判定完成并计数', function () {
        var el = $('.practice[data-stage=corners]');
        var before = practiceCount('corners');
        var s0 = practiceNew(el);
        var r = CS.solveStage(s0, 'corners');
        var ms = [];
        r.steps.forEach(function (st) { ms = ms.concat(st.moves); });
        ms.forEach(function (m) { userMove(m); });
        return sleep(20).then(function () {
          var st = $('[data-role=status]', el);
          return { ok: st.classList.contains('is-ok') && practiceCount('corners') === before + 1, info: ms.length + ' 步 · ' + st.textContent };
        });
      }),
      tryStep('连点转动按钮（有动画）→ 串行不乱；播放中点另一张卡 → 先停再播', function () {
        setSpeed(120);
        setStateQuiet(SOLVED);
        ['R', 'U', "R'", "U'", 'F'].forEach(function (m) { $('[data-move="' + m + '"]').click(); });
        var want = CM.apply(SOLVED, "R U R' U' F");
        return waitIdle().then(function () {
          var ok1 = view.getState() === want;
          var c1 = $('#ch-05 .case[data-alg]'), c2 = $('#ch-06 .case[data-alg]');
          var p1 = playAlg(c1);
          return sleep(150).then(function () {
            var p2 = playAlg(c2);
            return Promise.all([p1, p2]).then(function (rs) {
              var i2 = cardInfo(c2);
              var want2 = CM.apply(setupState(i2.setup), rep(i2.moves, i2.repeat));
              setSpeed(0);
              return { ok: ok1 && rs[0] === false && rs[1] === true && view.getState() === want2 && !c1.classList.contains('is-playing'),
                info: 'serial=' + ok1 + ' first=' + rs[0] + ' second=' + rs[1] };
            });
          });
        });
      }),
      tryStep('跳句：⏭ 三次后状态与模型一致', function () {
        var ch = chapterById('corners');
        loadChapter(ch, false);
        prepare(0); sc.phase = 'pre';
        scriptJump(1); scriptJump(1); scriptJump(1);
        var exp = SOLVED;
        ch.script.slice(0, 3).forEach(function (st) {
          if (st.setup != null) exp = setupState(st.setup);
          if (st.do) exp = CM.apply(exp, st.do);
        });
        var st3 = ch.script[3];
        if (st3.setup != null) exp = setupState(st3.setup);
        return { ok: view.getState() === exp && sc.idx === 3, info: 'label=' + $('[data-role=script-label]').textContent };
      }),
      tryStep('展开图与 3D 同步（转动 / setState / 高亮跟块）', function () {
        if (!net) return { ok: false, info: '没有展开图' };
        stopAll();
        view.setState(CM.apply(SOLVED, "R U F' L2 D B'"));
        var a = net.getState() === view.getState();
        view.highlight(['UFR']);
        var before = CubeNet.SLOT_FACELETS['FRU'].map(function (i) { return view.getState()[i]; }).sort().join('');
        return view.move("R U y").then(function () {
          var st = view.getState(), lit = $$('#cube-net .net-cell.is-lit');
          var cols = lit.map(function (c) { return st[+c.getAttribute('data-i')]; }).sort().join('');
          var b = net.getState() === st;
          var vis = $$('#cube-net .net-frame.is-visible').length;
          view.clearHighlight();
          return { ok: a && b && lit.length === 3 && cols === before && vis >= 2,
            info: 'sync=' + a + '/' + b + ' lit=' + lit.length + ' piece ' + before + '→' + cols + ' visibleFaces=' + vis };
        });
      }),
      tryStep('环形图与 3D 同步（每环 12 点、转动后颜色一致、高亮跟块）', function () {
        var ring = net && net.parts[1];
        if (!ring) return { ok: false, info: '没有环形图' };
        stopAll();
        view.setState(CM.apply(SOLVED, "F2 L' U B D' R"));
        var a = ring.getState() === view.getState();
        view.highlight(['DF']);
        return view.move("D R' z").then(function () {
          var st = view.getState(), lit = $$('#cube-ring .ring-dot.is-lit');
          var b = ring.getState() === st;
          var belts = $$('#cube-ring .ring-belt').length;
          view.clearHighlight();
          return { ok: a && b && lit.length === 2 && belts === 6 && CubeRing.SIGN === -1,
            info: 'sync=' + a + '/' + b + ' lit=' + lit.length + ' belts=' + belts + ' sign=' + CubeRing.SIGN };
        });
      })
    ];
    function waitIdle() {
      return new Promise(function (res) {
        (function poll() { if (!view.isBusy()) res(); else setTimeout(poll, 30); })();
      });
    }
    var chain = Promise.resolve();
    steps.forEach(function (s) { chain = chain.then(s); });
    chain.then(function () {
      var okN = results.filter(Boolean).length;
      var line = (okN === results.length ? 'ALL OK ' : 'SOME FAILED ') + okN + '/' + results.length;
      out.textContent += line + '\n';
      out.setAttribute('data-done', '1');
      console.log('[selftest] ' + line);
      setStateQuiet(SOLVED);
      view.clearHighlight();
    });
  }

  window.CubeApp = {
    init: init,
    get view() { return view; },
    playAlg: playAlg, stepAlg: stepAlg, setupAlg: setupAlg,
    practiceNew: practiceNew, practiceSolve: practiceSolve, practiceHint: practiceHint, practiceReset: practiceReset,
    playScript: playScriptChapter, scriptToggle: scriptToggle, scriptJump: scriptJump,
    stop: stopAll, setSpeed: setSpeed, selftest: selftest
  };

  try { init(); }
  catch (err) {
    console.error(err);
    var c = document.getElementById('chapters');
    if (c && !c.querySelector('article') && window.CubeRender) CubeRender.renderAll(LESSONS, c);
  }
})();
