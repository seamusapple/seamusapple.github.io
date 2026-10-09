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
    var saved = store.get('jz.dep', null);
    if (saved) depInput.value = saved;
    depInput.addEventListener('change', function () { store.set('jz.dep', depInput.value); renderDates(); });
    renderDates();
  }

  /* ---------- 方案 A / B ---------- */
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
    store.set('jz.tab', n);
    if (scroll) { var sec = $('#days'); if (sec) sec.scrollIntoView({ behavior: scroll === 'instant' ? 'auto' : 'smooth', block: 'start' }); }
  }
  tabs.forEach(function (t) {
    t.addEventListener('click', function () { activateDay(t.id.replace('tab-day', ''), false); });
  });
  if (tabs.length) {
    var m = /^#day([1-4])$/.exec(location.hash), q = /[?&]tab=([1-4])/.exec(location.search);
    if (m) activateDay(m[1], 'instant'); else activateDay(q ? q[1] : store.get('jz.tab', '1'), false);
  }
  $$('.route-map .node').forEach(function (n) {
    var go = function () { activateDay(n.getAttribute('data-day'), true); };
    n.addEventListener('click', go);
    n.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });

  /* ---------- 沟内景点卡片 ---------- */
  var SPOTS = {
    changhai: { name: '长海', meta: '海拔 3100 m · 则查洼沟尽头 · ①', text: '九寨沟最高、最大、最深的海子，4.5 km 长，墨蓝色，背后是终年积雪的山。没有出水口，水从地下渗走。', tip: '早上第一批车到这里人最少。拍全景站在观景台左边；看完沿栈道往下走 1 km 到五彩池，20 分钟。', img: 'changhai.jpg', cap: '长海' },
    wucaichi: { name: '五彩池', meta: '海拔 2995 m · 则查洼沟 · ②', text: '全沟最小的海子，颜色最艳：水里的碳酸钙和水藻，在太阳下分成蓝、绿、黄好几层。', tip: '上午 9–10 点光线正好。从长海走下来 20 分钟，看完在站台等车回诺日朗换乘。', img: 'wucaichi.jpg', cap: '五彩池' },
    jianzhuhai: { name: '箭竹海', meta: '海拔 2618 m · 日则沟 · ③', text: '湖边长满箭竹，大熊猫的口粮。湖面很静，倒影好。这里是日则沟栈道下坡的起点。', tip: '再往上一站是原始森林，时间紧可以跳过，直接从箭竹海开始走。', img: 'rize.jpg', cap: '日则沟的海子' },
    xiongmaohai: { name: '熊猫海', meta: '海拔 2587 m · 日则沟 · ④', text: '以前有熊猫来喝水，得名。下游是熊猫海瀑布，栈道从瀑布边绕下去，是一段长台阶。', tip: '下午 1–3 点湖水最蓝。台阶湿滑，扶着走。', img: 'cailin.jpg', cap: '沟里的彩林' },
    wuhuahai: { name: '五花海', meta: '海拔 2472 m · 日则沟 · ⑤', text: '九寨沟的名片。湖底的钙华、水藻和倒下的树干，把水分成一块块孔雀蓝、翠绿、鹅黄。', tip: '上午 9–11 点倒影最清楚，中午顺光颜色最饱和。公路边高处的观景台（老虎嘴）能看全貌，别只在湖边看。', img: 'wuhuahai.jpg', cap: '五花海' },
    zhenzhutan: { name: '珍珠滩瀑布', meta: '海拔 2433 m · 日则沟 · ⑥', text: '一大片斜坡钙华滩，水在上面溅成珍珠，然后跌成 40 m 宽的瀑布。86 版《西游记》片尾师徒四人走的就是这里。', tip: '滩上的栈道可以走，瀑布正面观景台在最下面。', img: 'pearl-shoal.jpg', cap: '珍珠滩瀑布' },
    jinghai: { name: '镜海', meta: '海拔 2390 m · 日则沟 · ⑦', text: '无风时整座山倒进湖里，所以叫镜海。', tip: '一定要无风时来，中午风一起就是普通湖。这也是日则沟栈道的终点，上车回诺日朗吃午饭。', img: 'jinghai.jpg', cap: '镜海' },
    nuorilang: { name: '诺日朗瀑布', meta: '海拔 2365 m · 三条沟交汇处 · ⑧', text: '320 m 宽、25 m 高，中国最宽的钙华瀑布，就在换乘中心旁边。', tip: '午饭前后顺便看，正面观景台 15 分钟够了。秋天水量比夏天小一点。', img: 'nuorilang.jpg', cap: '诺日朗瀑布' },
    xiniuhai: { name: '犀牛海', meta: '海拔 2315 m · 树正沟 · ⑨', text: '树正沟最大最深的海子，倒影不输五花海，人少得多。', tip: '观光车站就在湖边，看完接着沿栈道往下走。', img: null, cap: '' },
    shuzheng: { name: '树正群海', meta: '海拔 2200–2300 m · 树正沟 · ⑩', text: '40 多个海子一层层叠下来，中间用钙华堤和小瀑布连着，最下面是树正瀑布。', tip: '这段栈道是树正沟最值得走的一段，约 1 km。沿途的树正寨可以歇脚买水。', img: 'valley-2011.jpg', cap: '树正沟的叠瀑' },
    huohuahai: { name: '卧龙海 · 火花海', meta: '海拔 2200 m · 树正沟 · ⑪', text: '卧龙海湖底有一条钙华长堤，像一条龙趴在水里。火花海早上阳光一照，水面像冒火花；2017 年地震决堤后已修复蓄水。', tip: '下午到这里光线平，看个形就行，别花太多时间。', img: 'wolonghai-falls.jpg', cap: '卧龙海边的瀑布' },
    luweihai: { name: '芦苇海 · 盆景滩', meta: '海拔 2140 m · 树正沟最下面 · ⑫', text: '芦苇海是一条 2 km 长的沼泽，中间一条碧绿的水道，秋天芦苇金黄。盆景滩是出沟前最后一站，水里一丛丛灌木像盆景。', tip: '16:30 之后逆光拍芦苇最好。看完上车 10 分钟到沟口。', img: 'penjingtan.jpg', cap: '盆景滩（春天拍的，秋天芦苇是金色）' }
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
  if (spotCard) showSpot('changhai');

  /* ---------- 清单 ---------- */
  var boxes = $$('.todo input[type="checkbox"]');
  var todoState = store.get('jz.todo', {});
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
      todoState[k] = b.checked; store.set('jz.todo', todoState); renderTodo();
    });
  });
  var reset = $('#todo-reset');
  if (reset) reset.addEventListener('click', function () {
    boxes.forEach(function (b) { b.checked = false; }); todoState = {}; store.set('jz.todo', todoState); renderTodo(); toast('已清空');
  });
  renderTodo();

  /* ---------- 预算 ---------- */
  var bPeople = $('#b-people'), bStay = $('#b-stay'), bGo = $('#b-go');
  var STAY = { eco: 250, mid: 500, high: 1500 };
  var GO = { train: 464 * 2, fly: 1050 * 2 };
  function fmt(n) { return Math.round(n).toLocaleString('zh-CN'); }
  function renderBudget() {
    if (!bPeople) return;
    var n = Math.min(6, Math.max(1, +bPeople.value || 1));
    var rooms = Math.ceil(n / 2);
    var rows = [
      ['九寨沟 门票 + 观光车', 280, '190 + 90，旺季官方价'],
      ['黄龙 门票 + 索道上行 + 观光车', 270, '170 + 80 + 20'],
      [bGo.value === 'train' ? '往返大交通（高铁全程）' : '往返大交通（飞机经成都）', GO[bGo.value], bGo.value === 'train' ? '西安北↔成都东 263 + 成都东↔黄龙九寨站 ≈150 + 直通车 51，往返' : '西安↔成都 + 成都↔九黄 + 机场大巴，往返，按常见票价估'],
      ['Day 3 包车 沟口 → 黄龙 → 川主寺', 500 / n, '按 500 元/车估，' + n + ' 人分摊'],
      ['住宿 3 晚', STAY[bStay.value] * 3 * rooms / n, rooms + ' 间 × 3 晚 × ' + STAY[bStay.value] + ' 元'],
      ['吃饭 4 天', 600, '每人每天 150 元'],
      ['打车、零食、手信', 150, '松潘古城打车、牦牛肉干']
    ];
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
    [bPeople, bStay, bGo].forEach(function (el) { el.addEventListener('change', renderBudget); el.addEventListener('input', renderBudget); });
    renderBudget();
  }

  /* ---------- 高德：手机上直接拉起 App，没装再退回网页 ---------- */
  var ua = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/.test(ua), isAndroid = /Android/.test(ua);
  if (isIOS || isAndroid) {
    $$('a[data-amap-kw]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var kw = a.getAttribute('data-amap-kw'), c = a.getAttribute('data-amap-center').split(',');
        var lon = +c[0], lat = +c[1], d = 0.15, web = a.href, scheme;
        if (isIOS) {
          scheme = 'iosamap://poi?sourceApplication=seamusapple&name=' + encodeURIComponent(kw) +
            '&lat1=' + (lat - d).toFixed(5) + '&lon1=' + (lon - d).toFixed(5) + '&lat2=' + (lat + d).toFixed(5) + '&lon2=' + (lon + d).toFixed(5) + '&dev=0';
        } else {
          scheme = 'androidamap://arroundpoi?sourceApplication=seamusapple&keywords=' + encodeURIComponent(kw) + '&lat=' + lat + '&lon=' + lon + '&dev=0';
        }
        e.preventDefault();
        var t0 = Date.now();
        location.href = scheme;
        setTimeout(function () { if (!document.hidden && Date.now() - t0 < 2600) location.href = web; }, 1800);
      });
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
