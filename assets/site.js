(function () {
  'use strict';
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 存不了就不记 */ } }
  };
  var cards = Array.prototype.slice.call(document.querySelectorAll('.card[data-tags]'));
  var buttons = Array.prototype.slice.call(document.querySelectorAll('.filters button'));
  var count = document.getElementById('shelf-count');
  var empty = document.getElementById('shelf-empty');

  function apply(tag) {
    var shown = 0;
    cards.forEach(function (c) {
      var on = tag === '*' || (' ' + c.getAttribute('data-tags') + ' ').indexOf(' ' + tag + ' ') !== -1;
      c.hidden = !on; if (on) shown++;
    });
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-tag') === tag)); });
    if (count) count.textContent = shown + ' 个';
    if (empty) empty.hidden = shown !== 0;
    store.set('site.tag', tag);
  }
  buttons.forEach(function (b) { b.addEventListener('click', function () { apply(b.getAttribute('data-tag')); }); });
  if (buttons.length) {
    var saved = store.get('site.tag', '*');
    var ok = buttons.some(function (b) { return b.getAttribute('data-tag') === saved; });
    apply(ok ? saved : '*');
  }
})();
