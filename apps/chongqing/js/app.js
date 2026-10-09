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
    var saved = store.get('cq.dep', null);
    if (saved) depInput.value = saved;
    depInput.addEventListener('change', function () { store.set('cq.dep', depInput.value); renderDates(); });
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
    store.set('cq.tab', n);
    if (scroll) { var sec = $('#days'); if (sec) sec.scrollIntoView({ behavior: scroll === 'instant' ? 'auto' : 'smooth', block: 'start' }); }
  }
  tabs.forEach(function (t) {
    t.addEventListener('click', function () { activateDay(t.id.replace('tab-day', ''), false); });
  });
  if (tabs.length) {
    var m = /^#day([1-4])$/.exec(location.hash), q = /[?&]tab=([1-4])/.exec(location.search);
    if (m) activateDay(m[1], 'instant'); else activateDay(q ? q[1] : store.get('cq.tab', '1'), false);
  }
  $$('.route-map .node').forEach(function (n) {
    var go = function () { activateDay(n.getAttribute('data-day'), true); };
    n.addEventListener('click', go);
    n.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });

  /* ---------- 渝中地图景点卡片 ---------- */
  var SPOTS = {
    hongyadong: { name: '洪崖洞', meta: '嘉陵江边 · 免费 · 亮灯 18:30–22:00', text: '11 层吊脚楼堆在崖壁上，1 楼和 11 楼都通马路，是重庆「8D」的教科书。里面是商铺，真正好看的是从外面看它亮灯。', tip: '全景在千厮门大桥桥面和江北嘴江边；灯 22:00 前后关，别拖到太晚。', img: 'cq-2025-03.jpg', cap: '洪崖洞夜景' },
    qiansimen: { name: '千厮门大桥', meta: '洪崖洞旁 · 免费 · 日落前后最好', text: '跨嘉陵江到江北嘴的斜拉桥，桥面人行道是拍洪崖洞全景的标准机位，顺便看两江交汇。', tip: '10 月中日落约 18:20，17:45 上桥，看完日落接着等亮灯。', img: 'qiansimen-2025.jpg', cap: '千厮门大桥' },
    jiangbeizui: { name: '江北嘴', meta: '千厮门大桥对岸 · 免费', text: '大剧院和江边步道。洪崖洞、千厮门大桥、渝中天际线三样能一起框进来的正面机位。', tip: '走过千厮门大桥 10 分钟就到；江边风大，带件外套。', img: 'cq-nightscape.jpg', cap: '江北嘴看洪崖洞和千厮门大桥' },
    jiefangbei: { name: '解放碑 · 八一路', meta: '渝中正中间 · 免费', text: '抗战胜利纪功碑，四周是步行街和商场。旁边的八一路好吃街有酸辣粉、鸡丝凉面、串串。', tip: '住在这附近最省事；晚上 21 点以后人才散。', img: 'jiefangbei-night.jpg', cap: '解放碑步行街' },
    chaotianmen: { name: '朝天门 · 来福士', meta: '半岛尖嘴 · 探索舱 120 元', text: '嘉陵江汇入长江的尖嘴，两种颜色的水在这里碰头。来福士八栋楼顶连起来的「探索舱」是空中观景台，两江夜游也从这上船。', tip: '游船 19:30–20:30 发，70–90 分钟，提前一天订；探索舱 10:00–22:00。', img: 'cq-2025-02.jpg', cap: '渝中的楼' },
    baixiangju: { name: '白象居', meta: '解放碑东南 · 免费', text: '1990 年代的 24 层老楼群，没有电梯，靠天桥把不同楼层接到不同的马路上。楼里还住着人。', tip: '楼间天桥能拍到长江索道从头顶过；别大声，别堵楼道。', img: null, cap: '' },
    suodao: { name: '长江索道', meta: '新华路站 ↔ 龙门浩站 · 单程 30 / 往返 50', text: '1987 年的「空中公交」，4 分钟跨过长江，车厢里能看到白象居和南岸。', tip: '公众号买票后要取号；渝中这头排队 1–2 小时，从南岸上新街站上车少一半；没票就坐两江轮渡（10 元）。', img: 'cableway-cbd.jpg', cap: '长江索道' },
    shibati: { name: '十八梯 · 山城巷', meta: '较场口 · 免费', text: '十八梯是重建的老街，山城巷是真老街加崖壁栈道。从较场口下去走一圈约 2 小时。', tip: '青石板爬坡多，穿运动鞋；山城巷傍晚看长江最舒服。', img: null, cap: '' },
    liziba: { name: '李子坝', meta: '2 号线李子坝站 · 免费', text: '轻轨从一栋 19 层居民楼的 6–8 层穿过去，站台就在楼里。', tip: '观景台在 A 出口外的平台，跟官方指示牌走，别跟商场里的「观景台」箭头；一班车 3–5 分钟，等两班就能拍到。', img: 'liziba-2025.jpg', cap: '李子坝 · 轻轨穿楼' },
    eling: { name: '鹅岭二厂', meta: '1 号线鹅岭站 · 免费', text: '印钞厂改的文创园，《从你的全世界路过》取景地，天台能看两江。', tip: '从鹅岭站上坡走 15 分钟；园里导航不准，跟路牌。', img: null, cap: '' },
    nanshan: { name: '南山一棵树', meta: '南岸 · 30 元 · 09:00–22:30', text: '对岸山上的观景台，整个渝中半岛摊在脚下，是「重庆夜景」明信片的机位。', tip: '17:30 到，看日落接亮灯；打车上山最省事，公交 346 / 347 到四中站再走 10 分钟；下山打车要等，先去泉水鸡街吃饭。', img: 'yuzhong-from-nanan.jpg', cap: '从南岸看渝中（雾天）' },
    ciqikou: { name: '磁器口', meta: '1 号线磁器口站 · 免费', text: '嘉陵江边的老码头古镇，一条主街全是麻花、火锅底料和小吃。', tip: '9:30 前到，10 点后人挤人；陈麻花认准「陈昌银」；逛 1–1.5 小时够了。', img: 'ciqikou.jpg', cap: '磁器口' }
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
  if (spotCard) showSpot('hongyadong');

  /* ---------- 清单 ---------- */
  var boxes = $$('.todo input[type="checkbox"]');
  var todoState = store.get('cq.todo', {});
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
      todoState[k] = b.checked; store.set('cq.todo', todoState); renderTodo();
    });
  });
  var reset = $('#todo-reset');
  if (reset) reset.addEventListener('click', function () {
    boxes.forEach(function (b) { b.checked = false; }); todoState = {}; store.set('cq.todo', todoState); renderTodo(); toast('已清空');
  });
  renderTodo();

  /* ---------- 预算 ---------- */
  var bPeople = $('#b-people'), bDays = $('#b-days'), bStay = $('#b-stay'), bNight = $('#b-night');
  var STAY = { eco: 200, mid: 450, high: 900 };
  function fmt(n) { return Math.round(n).toLocaleString('zh-CN'); }
  function renderBudget() {
    if (!bPeople) return;
    var n = Math.min(6, Math.max(1, +bPeople.value || 1));
    var days = +bDays.value, nights = days - 1, rooms = Math.ceil(n / 2), wulong = days >= 4;
    var rows = [
      ['高铁往返 西安 ↔ 重庆', 760, '按二等座 ≈380 元估'],
      ['住宿 ' + nights + ' 晚', STAY[bStay.value] * nights * rooms / n, rooms + ' 间 × ' + nights + ' 晚 × ' + STAY[bStay.value] + ' 元'],
      ['吃饭 ' + days + ' 天', 150 * days, '每人每天 150 元，含火锅'],
      ['门票', 80, '长江索道往返 50 + 南山一棵树 30'],
      ['市内交通', 30 * days, '轨道 + 打车']
    ];
    if (bNight.checked) rows.push(['两江夜游 + 来福士探索舱', 118 + 120, '夜游优惠价 118 + 探索舱 120']);
    if (wulong) rows.push(['武隆一天', 130 + 260 + 40, '动车往返 ≈130 + 三桥 155 + 地缝 105 + 景区交通 40']);
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
    [bPeople, bDays, bStay, bNight].forEach(function (el) { el.addEventListener('change', renderBudget); el.addEventListener('input', renderBudget); });
    renderBudget();
  }

  /* ---------- 高德：手机上链接本身就是 App scheme，没装 App 再退回网页 ---------- */
  var ua = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/.test(ua), isAndroid = /Android/.test(ua);
  if (isIOS || isAndroid) {
    $$('a[data-amap-kw]').forEach(function (a) {
      var kw = a.getAttribute('data-amap-kw'), c = a.getAttribute('data-amap-center').split(',');
      var lon = +c[0], lat = +c[1], d = 0.12, web = a.href;
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
        apple.href = 'https://maps.apple.com/?q=' + encodeURIComponent(kw) + '&sll=' + lat + ',' + lon + '&z=14';
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
