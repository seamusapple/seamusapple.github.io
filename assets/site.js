(function () {
  'use strict';
  var book = document.getElementById('book');
  var progress = document.getElementById('progress');
  if (!book) return;
  if (location.search.indexOf('flat=1') !== -1) { document.documentElement.classList.add('flat'); return; }

  var wide = window.matchMedia('(min-width: 880px)');
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)');
  var panels = Array.prototype.slice.call(book.querySelectorAll('.panel'));
  var target = book.scrollLeft, raf = 0;

  function step() {
    var d = target - book.scrollLeft;
    if (Math.abs(d) < .5) { book.scrollLeft = target; raf = 0; return; }
    book.scrollLeft += d * .14;
    raf = requestAnimationFrame(step);
  }
  function go(x) {
    var max = book.scrollWidth - book.clientWidth;
    target = Math.max(0, Math.min(max, x));
    if (calm.matches) { book.scrollLeft = target; return; }
    if (!raf) raf = requestAnimationFrame(step);
  }
  // wheel: vertical motion turns the pages sideways
  book.addEventListener('wheel', function (e) {
    if (!wide.matches) return;
    var dy = e.deltaY, dx = e.deltaX;
    if (Math.abs(dy) <= Math.abs(dx)) return;            // real sideways gesture: let the browser do it
    e.preventDefault();
    if (e.deltaMode === 1) dy *= 16;                     // lines → px
    if (!raf) target = book.scrollLeft;
    go(target + dy);
  }, { passive: false });
  // keys: one panel at a time
  function current() {
    var x = book.scrollLeft + 1, i = 0;
    panels.forEach(function (p, k) { if (p.offsetLeft <= x) i = k; });
    return i;
  }
  document.addEventListener('keydown', function (e) {
    if (!wide.matches || e.altKey || e.ctrlKey || e.metaKey) return;
    var t = e.target; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    var i = current();
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(panels[Math.min(i + 1, panels.length - 1)].offsetLeft); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(panels[Math.max(i - 1, 0)].offsetLeft); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(book.scrollWidth); }
  });
  // in-page links: scroll the strip, not the page
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || !wide.matches) return;
    var el = document.getElementById(a.getAttribute('href').slice(1));
    if (!el) return;
    e.preventDefault(); go(el.offsetLeft);
    if (history.replaceState) history.replaceState(null, '', a.getAttribute('href'));
  });
  // progress counter: 01 / 07 from the panel under the left edge
  var big = document.querySelector('.cover .big');
  var total = big ? big.textContent.trim() : String(panels.length);
  function tick() {
    if (!progress) return;
    var p = panels[current()];
    var n = p.getAttribute('data-n') || '\u2014';
    progress.textContent = n + ' / ' + total;
  }
  book.addEventListener('scroll', function () { if (!raf) tick(); }, { passive: true });
  var tock = setInterval(function () { if (raf) tick(); }, 120);
  window.addEventListener('pagehide', function () { clearInterval(tock); });
  // arrive via #hash: land on that panel
  if (location.hash && wide.matches) {
    var h = document.getElementById(location.hash.slice(1));
    if (h) { book.scrollLeft = h.offsetLeft; target = book.scrollLeft; }
  }
  tick();
})();
