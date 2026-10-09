(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 私密模式等情况下不记忆，页面照常可用 */ } }
  };

  var toastEl = $('#toast'), toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg; toastEl.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1600);
  }

  /* ---------- 出发日 & 倒计时 ---------- */
  var depInput = $('#dep-date');
  var WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  function parseDate(s) { var p = (s || '').split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function renderDates() {
    if (!depInput || !depInput.value) return;
    var dep = parseDate(depInput.value);
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var diff = Math.round((dep - today) / 864e5);
    var big = $('#cd-days');
    if (big) big.textContent = diff > 0 ? String(diff) : (diff === 0 ? '今天' : '已出发');
    $$('.date[data-day-offset]').forEach(function (el) {
      var d = new Date(dep); d.setDate(d.getDate() + (+el.getAttribute('data-day-offset')));
      el.textContent = (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + WEEK[d.getDay()];
    });
  }
  if (depInput) {
    var saved = store.get('sd.dep', null);
    if (saved) depInput.value = saved;
    depInput.addEventListener('change', function () { store.set('sd.dep', depInput.value); renderDates(); });
    renderDates();
  }

  /* ---------- 推荐 / 备选车次 ---------- */
  var pa = $('#plan-a'), pb = $('#plan-b'), boxA = $('#plan-a-box'), boxB = $('#plan-b-box');
  function showPlan(b) {
    if (!pa || !pb) return;
    pa.setAttribute('aria-pressed', String(!b)); pb.setAttribute('aria-pressed', String(b));
    boxA.hidden = b; boxB.hidden = !b;
  }
  if (pa && pb) {
    pa.addEventListener('click', function () { showPlan(false); });
    pb.addEventListener('click', function () { showPlan(true); });
    showPlan(false);
  }

  /* ---------- 每日 tabs ---------- */
  var tabs = $$('[role="tab"]');
  function activateDay(n, scroll) {
    tabs.forEach(function (t) {
      var on = t.id === 'tab-day' + n;
      t.setAttribute('aria-selected', String(on));
      var p = $('#' + t.getAttribute('aria-controls'));
      if (p) p.hidden = !on;
    });
    store.set('sd.tab', n);
    if (scroll) { var sec = $('#days'); if (sec) sec.scrollIntoView({ behavior: scroll === 'instant' ? 'auto' : 'smooth', block: 'start' }); }
  }
  tabs.forEach(function (t) {
    t.addEventListener('click', function () { activateDay(t.id.replace('tab-day', ''), false); });
  });
  if (tabs.length) {
    var m = /^#day([1-3])$/.exec(location.hash), q = /[?&]tab=([1-3])/.exec(location.search);
    if (m) activateDay(m[1], 'instant'); else activateDay(q ? q[1] : store.get('sd.tab', '1'), false);
  }
  $$('.route-map .node').forEach(function (n) {
    var go = function () { activateDay(n.getAttribute('data-day'), true); };
    n.addEventListener('click', go);
    n.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });

  /* ---------- 剑门关地图景点卡片 ---------- */
  var SPOTS = {
    beimen: { name: '北门', meta: '沟底 · 动线第 ① 站 · 08:00 开', text: '售票、检票、索道站都在这。从昭化打车直接报「剑门关北门」。', tip: '早上 8 点前到，索道排队最短。要背《蜀道难》免票就在这个售票处背。', img: null, cap: '' },
    liangshan: { name: '梁山寺 · 山顶', meta: '索道上站 · 动线第 ② 站', text: '索道 10 分钟上来就是山顶，梁山寺旁边的观景台能看到剑门七十二峰一字排开。', tip: '山顶比山下低三四度，先把外套穿上。往下走之前上个厕所，接下来一个多小时没有。', img: null, cap: '' },
    yuannao: { name: '猿猱道', meta: '崖壁上 · 动线第 ③ 站 · 68 元 · 要预约', text: '440 米长、30 厘米宽，外侧没护栏，挂安全绳和头盔走。李白写的「猿猱欲度愁攀援」就是这段。', tip: '7–59 岁、1.2 米以上，签免责协议；恐高、高血压别硬上。单向上行，和鸟道二选一；阴雨大风停运。', img: 'jmg-zhandao.jpg', cap: '崖壁上的路' },
    zhandao: { name: '仙云栈道', meta: '崖壁上 · 不走猿猱道就走这条', text: '贴着崖壁修的栈道，有护栏，中间一段是悬空玻璃观景台，风景和猿猱道一样。', tip: '栈道上风大，帽子抓紧。石笋峰就在栈道对面。', img: 'shisunfeng.jpg', cap: '栈道对面的石笋峰' },
    guanlou: { name: '关楼', meta: '两崖之间 · 动线第 ④ 站', text: '大剑山和小剑山中间唯一的口子，三国时诸葛亮在这里立关。现在的关楼是 2009 年重建的，但那个口子还是那个口子。', tip: '从山顶往下走到关楼大约 1 小时台阶，膝盖不好就慢点。关楼里能上二层，往南看是镇子，往北看是来路。', img: 'jmg-lou.jpg', cap: '剑门关关楼' },
    nanmen: { name: '南门', meta: '镇子这头 · 动线第 ⑤ 站', text: '从关楼再走 20 分钟就出南门，出来就是剑门关镇，豆腐店一条街。', tip: '去翠云廊的专线车在南门外；去高铁站的 7 路公交也在这边。', img: null, cap: '' },
    cuiyunlang: { name: '翠云廊', meta: '离南门 10 km · 40 元 · 1 小时', text: '7000 多棵古柏夹着一段古蜀道，剑阁柏 2300 岁，是世界上最老的柏树；还有张飞柏、阿斗柏。', tip: '默写《翠云廊》全文免票。走一圈 1 小时，14:30 前要离开去车站。', img: 'gushudao.jpg', cap: '古柏夹着的蜀道' }
  };
  var spotCard = $('#spot-card');
  function showSpot(key) {
    var s = SPOTS[key]; if (!s || !spotCard) return;
    $('#spot-name').textContent = s.name;
    $('#spot-meta').textContent = s.meta;
    $('#spot-text').textContent = s.text;
    $('#spot-tip').textContent = '贴士：' + s.tip;
    var fig = $('figure', spotCard), img = $('#spot-img'), cap = $('#spot-cap');
    if (s.img) { fig.hidden = false; img.src = 'img/' + s.img; img.alt = s.name; cap.textContent = s.cap; }
    else { fig.hidden = true; }
    $$('.park-map .spot').forEach(function (g) { g.classList.toggle('on', g.getAttribute('data-spot') === key); });
  }
  $$('.park-map .spot').forEach(function (g) {
    var go = function () { showSpot(g.getAttribute('data-spot')); spotCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); };
    g.addEventListener('click', go);
    g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
  if (spotCard) showSpot('guanlou');

  /* ---------- 清单 ---------- */
  var boxes = $$('.todo input[type="checkbox"]');
  var todoState = store.get('sd.todo', {});
  function renderTodo() {
    var done = 0;
    boxes.forEach(function (b) { if (b.checked) done++; });
    var c = $('#todo-count'), bar = $('#todo-bar'), msg = $('#todo-done');
    if (c) c.textContent = done + ' / ' + boxes.length;
    if (bar) bar.style.width = (boxes.length ? done / boxes.length * 100 : 0) + '%';
    if (msg) msg.hidden = !(boxes.length && done === boxes.length);
  }
  boxes.forEach(function (b) {
    var k = b.getAttribute('data-key');
    if (todoState[k]) b.checked = true;
    b.addEventListener('change', function () {
      todoState[k] = b.checked; store.set('sd.todo', todoState); renderTodo();
    });
  });
  var reset = $('#todo-reset');
  if (reset) reset.addEventListener('click', function () {
    boxes.forEach(function (b) { b.checked = false; }); todoState = {}; store.set('sd.todo', todoState); renderTodo(); toast('已清空');
  });
  renderTodo();

  /* ---------- 预算 ---------- */
  var bPeople = $('#b-people'), bStay = $('#b-stay'), bYuan = $('#b-yuannao');
  var STAY = { eco: 200, mid: 350, high: 650 };
  function fmt(n) { return Math.round(n).toLocaleString('zh-CN'); }
  function renderBudget() {
    if (!bPeople) return;
    var n = Math.min(6, Math.max(1, +bPeople.value || 1));
    var rooms = Math.ceil(n / 2);
    var rows = [
      ['高铁 3 段', 422, '152 + 40 + 230'],
      ['门票', 427, '皇泽寺 50 · 千佛崖 50 · 昭化套票 50 · 剑门关 105 · 索道 50 · 翠云廊 40 · 三星堆 72 · 导览 10'],
      ['住宿 2 晚', STAY[bStay.value] * 2 * rooms / n, rooms + ' 间 × 2 晚 × ' + STAY[bStay.value] + ' 元'],
      ['吃饭 3 天', 360, '每人每天 120 元'],
      ['打车', 330 / n, '按 330 元/车估，' + n + ' 人分摊']
    ];
    if (bYuan.checked) rows.push(['猿猱道', 68, '要预约，7–59 岁']);
    var body = $('#b-body'); if (!body) return;
    var html = '', per = 0;
    rows.forEach(function (r) {
      per += r[1];
      html += '<tr><td>' + r[0] + '<small>' + r[2] + '</small></td><td class="n">' + fmt(r[1]) + '</td><td class="n">' + fmt(r[1] * n) + '</td></tr>';
    });
    html += '<tr class="total"><td>合计（' + n + ' 人）</td><td class="n">≈' + fmt(per) + '</td><td class="n">≈' + fmt(per * n) + '</td></tr>';
    body.innerHTML = html;
  }
  if (bPeople) {
    [bPeople, bStay, bYuan].forEach(function (el) { el.addEventListener('change', renderBudget); el.addEventListener('input', renderBudget); });
    renderBudget();
  }

  /* ---------- 高德：手机上链接本身就是 App scheme，没装 App 再退回网页 ---------- */
  var ua = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/.test(ua), isAndroid = /Android/.test(ua);
  if (isIOS || isAndroid) {
    $$('a[data-amap-kw]').forEach(function (a) {
      var kw = a.getAttribute('data-amap-kw'), c = a.getAttribute('data-amap-center').split(',');
      var lon = +c[0], lat = +c[1], d = 0.15, web = a.href;
      a.setAttribute('data-web', web);
      a.removeAttribute('target');
      if (isIOS) {
        a.href = 'iosamap://poi?sourceApplication=seamusapple&name=' + encodeURIComponent(kw) +
          '&lat1=' + (lat - d).toFixed(5) + '&lon1=' + (lon - d).toFixed(5) + '&lat2=' + (lat + d).toFixed(5) + '&lon2=' + (lon + d).toFixed(5) + '&dev=0';
      } else {
        a.href = 'androidamap://arroundpoi?sourceApplication=seamusapple&keywords=' + encodeURIComponent(kw) + '&lat=' + lat + '&lon=' + lon + '&dev=0';
      }
      a.addEventListener('click', function () {
        var t0 = Date.now();
        toast('正在打开高德地图…');
        setTimeout(function () { if (!document.hidden && Date.now() - t0 < 3000) location.href = web; }, 2000);
      });
      if (isIOS) {
        var apple = document.createElement('a');
        apple.className = 'chip'; apple.textContent = 'Apple 地图';
        apple.href = 'https://maps.apple.com/?q=' + encodeURIComponent(kw) + '&sll=' + lat + ',' + lon + '&z=13';
        a.parentNode.appendChild(apple);
      }
    });
  }

  /* ---------- 电话复制 ---------- */
  function copyText(t, el) {
    function fallback() {
      try { var r = document.createRange(); r.selectNodeContents(el); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); toast('已选中，长按复制'); } catch (e) { /* 无法选中时忽略 */ }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () { toast('已复制 ' + t); }, fallback);
    } else fallback();
  }
  $$('.phone').forEach(function (p) {
    var n = $('.n', p), btn = $('button', p);
    if (!n) return;
    var h = function () { copyText(n.textContent.trim(), n); };
    if (btn) btn.addEventListener('click', h);
    n.addEventListener('click', h);
  });
})();
