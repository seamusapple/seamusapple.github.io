/* cube-3d.js — Three.js (r128, global THREE) 3D Rubik's cube view.
 * Global: CubeView. Self-contained: tracks 27 cubies (integer position + integer rotation matrix)
 * and derives every turn geometrically; getState() reads the 54-char facelet string back
 * from where each sticker currently points (Kociemba order U R F D L B, see SPEC).
 * Coordinates: +x = R, +y = U, +z = F.
 */
(function (root) {
  'use strict';

  // ---------- pure geometry core (no THREE) ----------
  var FACE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B'];
  // n = outward normal, up/right = screen directions when looking straight at the face
  var FACES = {
    U: { n: [0, 1, 0], up: [0, 0, -1], right: [1, 0, 0] },
    R: { n: [1, 0, 0], up: [0, 1, 0], right: [0, 0, -1] },
    F: { n: [0, 0, 1], up: [0, 1, 0], right: [1, 0, 0] },
    D: { n: [0, -1, 0], up: [0, 0, 1], right: [1, 0, 0] },
    L: { n: [-1, 0, 0], up: [0, 1, 0], right: [0, 0, 1] },
    B: { n: [0, 0, -1], up: [0, 1, 0], right: [-1, 0, 0] }
  };
  var SOLVED = 'YYYYYYYYYOOOOOOOOOGGGGGGGGGWWWWWWWWWRRRRRRRRRBBBBBBBBB';
  var COLORS = { W: 0xF2F2F2, Y: 0xFFD500, G: 0x009B48, B: 0x0046AD, O: 0xFF5800, R: 0xB71234 };
  // turn axis = outward normal of that face; clockwise seen from the face = -90deg about it
  var MOVE_AXIS = { U: 'U', D: 'D', F: 'F', B: 'B', R: 'R', L: 'L', x: 'R', y: 'U', z: 'F' };

  function key(v) { return v[0] + ',' + v[1] + ',' + v[2]; }
  function eq(a, b) { return a[0] === b[0] && a[1] === b[1] && a[2] === b[2]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function matVec(m, v) {
    return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
            m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
            m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
  }
  function matMul(a, b) {
    var r = new Array(9);
    for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) {
      r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    }
    return r;
  }
  var IDENT = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  // integer rotation matrix about unit axis e by quarter turns q (angle = q * 90deg, right-hand rule)
  function quarterMatrix(e, q) {
    q = ((q % 4) + 4) % 4;
    var c = [1, 0, -1, 0][q], s = [0, 1, 0, -1][q], t = 1 - c;
    var x = e[0], y = e[1], z = e[2];
    return [c + t * x * x, t * x * y - s * z, t * x * z + s * y,
            t * x * y + s * z, c + t * y * y, t * y * z - s * x,
            t * x * z - s * y, t * y * z + s * x, c + t * z * z];
  }

  // facelet index -> { face, n, pos }
  var FACELETS = [];
  FACE_ORDER.forEach(function (f) {
    var F = FACES[f];
    for (var row = 0; row < 3; row++) for (var col = 0; col < 3; col++) {
      var p = [0, 1, 2].map(function (k) { return F.n[k] + F.right[k] * (col - 1) - F.up[k] * (row - 1); });
      FACELETS.push({ face: f, n: F.n, pos: p });
    }
  });

  var TOKEN_RE = /^([UDFBRLxyz])(2|'|)$/;
  function parseAlg(alg) {
    if (Array.isArray(alg)) alg = alg.join(' ');
    var toks = String(alg || '').trim().split(/\s+/).filter(Boolean);
    return toks.map(function (t) {
      var norm = t.replace(/[’′`]/g, "'");
      var m = TOKEN_RE.exec(norm);
      if (!m) throw new Error('非法记号: ' + t);
      var base = m[1];
      var q = m[2] === '2' ? 2 : (m[2] === "'" ? -1 : 1);
      var whole = base === 'x' || base === 'y' || base === 'z';
      var axisFace = MOVE_AXIS[base];
      return { name: base + m[2], base: base, whole: whole, axis: FACES[axisFace].n, layer: whole ? null : FACES[base].n, quarters: -q };
    });
  }

  // logical model: cubies = [{ home:[..], pos:[..], rot:[9], stickers:[{n:[local], color, home}] }]
  function makeCubies() {
    var list = [];
    for (var x = -1; x <= 1; x++) for (var y = -1; y <= 1; y++) for (var z = -1; z <= 1; z++) {
      var p = [x, y, z], st = [];
      FACE_ORDER.forEach(function (f) {
        var n = FACES[f].n;
        if (dot(p, n) === 1) st.push({ n: n.slice(), face: f, color: SOLVED[FACE_ORDER.indexOf(f) * 9 + 4] });
      });
      list.push({ home: p.slice(), pos: p.slice(), rot: IDENT.slice(), stickers: st });
    }
    return list;
  }
  function applyColors(cubies, facelets) {
    var byPos = {};
    cubies.forEach(function (c) { c.pos = c.home.slice(); c.rot = IDENT.slice(); byPos[key(c.pos)] = c; });
    FACELETS.forEach(function (fl, i) {
      var c = byPos[key(fl.pos)];
      c.stickers.forEach(function (s) { if (eq(s.n, fl.n)) s.color = facelets[i]; });
    });
  }
  function readState(cubies) {
    var byPos = {};
    cubies.forEach(function (c) { byPos[key(c.pos)] = c; });
    return FACELETS.map(function (fl) {
      var c = byPos[key(fl.pos)];
      for (var i = 0; i < c.stickers.length; i++) {
        if (eq(matVec(c.rot, c.stickers[i].n), fl.n)) return c.stickers[i].color;
      }
      return '?';
    }).join('');
  }
  function inLayer(c, mv) { return mv.whole || dot(c.pos, mv.layer) === 1; }
  function applyMoveLogical(cubies, mv) {
    var M = quarterMatrix(mv.axis, mv.quarters);
    cubies.forEach(function (c) {
      if (!inLayer(c, mv)) return;
      c.pos = matVec(M, c.pos);
      c.rot = matMul(M, c.rot);
    });
  }
  function validState(s) {
    return typeof s === 'string' && s.length === 54 && /^[WYGBOR]+$/.test(s);
  }

  var Core = { SOLVED: SOLVED, FACES: FACES, FACELETS: FACELETS, parse: parseAlg, makeCubies: makeCubies,
    applyColors: applyColors, readState: readState, applyMove: applyMoveLogical,
    apply: function (state, alg) {
      var cs = makeCubies(); applyColors(cs, state || SOLVED);
      parseAlg(alg).forEach(function (mv) { applyMoveLogical(cs, mv); });
      return readState(cs);
    } };

  // ---------- view ----------
  var PRESETS = {
    front: [30, -35],   // [tilt about X (deg), turn about Y (deg)] — sees U F R
    bottom: [-30, -35], // sees D F R
    top: [62, -25],
    back: [30, 145]     // sees U B L
  };
  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function prefersReducedMotion() {
    try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }

  function roundedRectShape(w, r) {
    var s = new THREE.Shape(), h = w / 2;
    s.moveTo(-h + r, -h);
    s.lineTo(h - r, -h); s.quadraticCurveTo(h, -h, h, -h + r);
    s.lineTo(h, h - r); s.quadraticCurveTo(h, h, h - r, h);
    s.lineTo(-h + r, h); s.quadraticCurveTo(-h, h, -h, h - r);
    s.lineTo(-h, -h + r); s.quadraticCurveTo(-h, -h, -h + r, -h);
    return s;
  }
  function presetQuat(name) {
    var p = PRESETS[name] || PRESETS.front;
    var qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), p[0] * Math.PI / 180);
    var qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), p[1] * Math.PI / 180);
    return qx.multiply(qy); // apply Y turn first, then X tilt (world frame)
  }
  function labelSprite(text) {
    var cv = document.createElement('canvas'); cv.width = cv.height = 128;
    var g = cv.getContext('2d');
    g.fillStyle = 'rgba(11,14,20,0.78)';
    g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.fill();
    g.lineWidth = 5; g.strokeStyle = '#4CC9F0'; g.stroke();
    g.fillStyle = '#E6E9EF'; g.font = 'bold 68px "JetBrains Mono", Menlo, monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 64, 68);
    var tex = new THREE.CanvasTexture(cv);
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
    sp.scale.set(0.62, 0.62, 1); sp.renderOrder = 10;
    return sp;
  }

  function CubeView(container, options) {
    if (typeof THREE === 'undefined') throw new Error('CubeView 需要先加载 three.js r128');
    options = options || {};
    var self = this;
    this.container = container;
    this._listeners = { move: [], drag: [] };
    this._queue = [];
    this._current = null;
    this._speed = prefersReducedMotion() ? 0 : 350;
    this._scale = options.size || 1;
    this._highlight = null;
    this._dirty = true;
    this._destroyed = false;

    // renderer / scene
    var renderer;
    try {
      renderer = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch (err) {
      // no WebGL: keep the logical model working (moves apply instantly), show a notice
      this._noGL = true; this._speed = 0;
      this.cubies = makeCubies();
      applyColors(this.cubies, validState(options.state) ? options.state : SOLVED);
      var note = document.createElement('div');
      note.textContent = '此浏览器无法启用 WebGL，3D 魔方无法显示。';
      note.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;color:#8B93A5;font-size:14px;text-align:center;padding:16px';
      container.appendChild(note); this._note = note;
      return;
    }
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    var cv = renderer.domElement;
    cv.style.display = 'block'; cv.style.width = '100%'; cv.style.height = '100%';
    cv.style.touchAction = 'none'; cv.style.cursor = 'grab'; cv.style.outline = 'none';
    cv.setAttribute('aria-label', '3D 魔方，可拖拽旋转视角');
    container.appendChild(cv);

    var scene = this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    this.camera.position.set(0, 0, 11.5);
    this.camera.lookAt(0, 0, 0);
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    var key = new THREE.DirectionalLight(0xffffff, 0.75); key.position.set(4, 6, 8); scene.add(key);
    var fill = new THREE.DirectionalLight(0xbfd8ff, 0.4); fill.position.set(-6, -3, 4); scene.add(fill);

    this.pivot = new THREE.Group(); scene.add(this.pivot);
    this.pivot.scale.setScalar(this._scale);
    this.pivot.quaternion.copy(presetQuat('front'));
    this.cubeGroup = new THREE.Group(); this.pivot.add(this.cubeGroup);

    // geometry shared
    var bodyGeo = new THREE.BoxGeometry(0.97, 0.97, 0.97);
    var bodyMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.55, metalness: 0.05 });
    var stickerGeo = new THREE.ShapeGeometry(roundedRectShape(0.84, 0.13), 6);
    this._shared = [bodyGeo, bodyMat, stickerGeo];

    this.cubies = makeCubies();
    this.cubies.forEach(function (c) {
      var mesh = new THREE.Group();
      mesh.add(new THREE.Mesh(bodyGeo, bodyMat));
      c.stickers.forEach(function (s) {
        var mat = new THREE.MeshStandardMaterial({ color: COLORS[s.color], roughness: 0.35, metalness: 0.0,
          polygonOffset: true, polygonOffsetFactor: -1 });
        var m = new THREE.Mesh(stickerGeo, mat);
        var n = new THREE.Vector3(s.n[0], s.n[1], s.n[2]);
        m.position.copy(n).multiplyScalar(0.492);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
        mesh.add(m);
        s.mesh = m; s.mat = mat;
      });
      c.mesh = mesh;
      self.cubeGroup.add(mesh);
    });

    // face labels
    this.labels = new THREE.Group(); this.labels.visible = false; this.pivot.add(this.labels);
    FACE_ORDER.forEach(function (f) {
      var sp = labelSprite(f), n = FACES[f].n;
      sp.position.set(n[0] * 2.2, n[1] * 2.2, n[2] * 2.2);
      sp.userData.n = new THREE.Vector3(n[0], n[1], n[2]);
      self.labels.add(sp);
    });

    applyColors(this.cubies, validState(options.state) ? options.state : SOLVED);
    this._syncAll();

    this._bindDrag();
    // resize
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(function () { self.resize(); });
      this._ro.observe(container);
    } else {
      this._onWinResize = function () { self.resize(); };
      root.addEventListener('resize', this._onWinResize);
    }
    this.resize();

    this._lastT = 0;
    this._loop = function (t) {
      if (self._destroyed) return;
      self._raf = root.requestAnimationFrame(self._loop);
      self._tick(root.performance && performance.now ? performance.now() : Date.now());
    };
    this._raf = root.requestAnimationFrame(this._loop);
    this._tick(performance.now());
  }

  var P = CubeView.prototype;

  // ----- events -----
  P.on = function (ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); return this; };
  P.off = function (ev, fn) {
    var l = this._listeners[ev]; if (!l) return this;
    this._listeners[ev] = fn ? l.filter(function (f) { return f !== fn; }) : []; return this;
  };
  P._emit = function (ev) {
    var args = Array.prototype.slice.call(arguments, 1);
    (this._listeners[ev] || []).forEach(function (fn) { try { fn.apply(null, args); } catch (e) { console.error(e); } });
  };

  // ----- state -----
  P.getState = function () { return readState(this.cubies); };
  P.setState = function (facelets) {
    if (!validState(facelets)) throw new Error('非法状态串（需 54 个 WYGBOR 字符）');
    this.cancel();
    this._restoreGroup();
    applyColors(this.cubies, facelets);
    this._syncAll();
    this._applyHighlight();
  };
  P.setSpeed = function (ms) { if (!this._noGL) this._speed = Math.max(0, +ms || 0); };

  P._syncCubie = function (c) {
    if (this._noGL) return;
    var m = c.rot;
    var mat4 = new THREE.Matrix4().set(m[0], m[1], m[2], 0, m[3], m[4], m[5], 0, m[6], m[7], m[8], 0, 0, 0, 0, 1);
    c.mesh.quaternion.setFromRotationMatrix(mat4);
    c.mesh.position.set(c.pos[0], c.pos[1], c.pos[2]);
    this._dirty = true;
  };
  P._syncAll = function () { if (this._noGL) return; var self = this; this.cubies.forEach(function (c) { self._syncCubie(c); }); this._applyHighlight(); };

  // ----- moves -----
  P.move = function (alg, opts) {
    var self = this, moves;
    try { moves = parseAlg(alg); } catch (e) { return Promise.reject(e); }
    var duration = opts && opts.duration != null ? Math.max(0, +opts.duration) : null;
    if (!moves.length) return Promise.resolve(this.getState());
    return new Promise(function (resolve) {
      moves.forEach(function (mv, i) {
        self._queue.push({ mv: mv, duration: duration, resolve: i === moves.length - 1 ? resolve : null });
      });
      self._pump();
    });
  };
  P._pump = function () {
    // start next queued move(s); zero-duration moves complete synchronously
    while (!this._current && this._queue.length) {
      var job = this._queue.shift();
      var dur = job.duration != null ? job.duration : this._speed;
      if (!dur || this._noGL) { this._finishJob(job); continue; }
      var mv = job.mv, self = this, g = new THREE.Group();
      this.cubeGroup.add(g);
      this.cubies.forEach(function (c) { if (inLayer(c, mv)) g.add(c.mesh); });
      job.group = g; job.dur = dur; job.start = null;
      job.axisV = new THREE.Vector3(mv.axis[0], mv.axis[1], mv.axis[2]);
      job.angle = mv.quarters * Math.PI / 2;
      // quarter turns are slightly faster per 90deg than half turns
      if (Math.abs(mv.quarters) === 2) job.dur = dur * 1.5;
      this._current = job;
      this._dirty = true;
      this._emit('turnstart', mv.name, job.dur);
      // watchdog: if rAF is stalled (background tab, headless), still complete the move
      (function (self, job) {
        job.timer = setTimeout(function () {
          if (self._current === job) { self._finishJob(job); self._pump(); self._dirty = true; }
        }, job.dur + 250);
      })(this, job);
    }
  };
  P._restoreGroup = function () {
    var job = this._current; if (!job || !job.group) return;
    var self = this;
    job.group.children.slice().forEach(function (m) { self.cubeGroup.add(m); });
    this.cubeGroup.remove(job.group);
    job.group = null;
  };
  P._finishJob = function (job) {
    if (job.timer) { clearTimeout(job.timer); job.timer = null; }
    if (job.group) { this._current = job; this._restoreGroup(); }
    this._current = null;
    var self = this;
    applyMoveLogical(this.cubies, job.mv);
    this.cubies.forEach(function (c) { self._syncCubie(c); });
    var st = this.getState();
    this._emit('move', job.mv.name, st);
    if (job.resolve) job.resolve(st);
  };
  P.cancel = function () {
    var q = this._queue; this._queue = [];
    if (this._current) { var j = this._current; this._finishJob(j); }
    // resolve promises of dropped moves (no rejection noise); they resolve with the current state
    var st = this.getState();
    q.forEach(function (job) { if (job.resolve) job.resolve(st); });
  };
  P.isBusy = function () { return !!this._current || this._queue.length > 0; };

  // ----- highlight -----
  // selectors bind to the pieces at the time of the call and follow them through later moves
  P.highlight = function (selectors) {
    if (typeof selectors === 'string') selectors = [selectors];
    var lit = new Set();
    var self = this;
    (selectors || []).forEach(function (sel) {
      sel = String(sel);
      var m;
      if (sel === 'centers') {
        self.cubies.forEach(function (c) {
          if (Math.abs(c.pos[0]) + Math.abs(c.pos[1]) + Math.abs(c.pos[2]) === 1) c.stickers.forEach(function (s) { lit.add(s); });
        });
      } else if ((m = /^(face|layer):([UDFBRL])$/.exec(sel))) {
        var n = FACES[m[2]].n;
        self.cubies.forEach(function (c) {
          if (dot(c.pos, n) !== 1) return;
          c.stickers.forEach(function (s) {
            if (m[1] === 'layer' || eq(matVec(c.rot, s.n), n)) lit.add(s);
          });
        });
      } else if (/^[UDFBRL]{1,3}$/.test(sel)) {
        var p = [0, 0, 0];
        sel.split('').forEach(function (f) { var n = FACES[f].n; p = [p[0] + n[0], p[1] + n[1], p[2] + n[2]]; });
        self.cubies.forEach(function (c) { if (eq(c.pos, p)) c.stickers.forEach(function (s) { lit.add(s); }); });
      }
    });
    this._highlight = lit;
    this._applyHighlight();
  };
  P.clearHighlight = function () { this._highlight = null; this._applyHighlight(); };
  P._applyHighlight = function () {
    if (this._noGL) return;
    var lit = this._highlight, dim = new THREE.Color(0x2a2d33);
    this.cubies.forEach(function (c) {
      c.stickers.forEach(function (s) {
        s.mat.color.setHex(COLORS[s.color] || 0x777777);
        if (lit && !lit.has(s)) {
          // desaturate + darken
          var col = s.mat.color, l = col.r * 0.3 + col.g * 0.59 + col.b * 0.11;
          col.setRGB(l, l, l).lerp(dim, 0.8);
          s.mat.emissive.setHex(0x000000);
        } else if (lit) {
          s.mat.emissive.copy(s.mat.color).multiplyScalar(0.18);
        } else {
          s.mat.emissive.setHex(0x000000);
        }
      });
    });
    this._dirty = true;
  };

  // ----- view -----
  P.lookAt = function (preset, opts) {
    if (this._noGL) return;
    var target = presetQuat(preset);
    var dur = opts && opts.duration != null ? opts.duration : (this._speed === 0 ? 0 : 600);
    this._vel = null;
    if (!dur) { this.pivot.quaternion.copy(target); this._viewAnim = null; this._dirty = true; return; }
    this._viewAnim = { from: this.pivot.quaternion.clone(), to: target, dur: dur, start: null };
  };
  P.setAxes = function (show) { if (this._noGL) return; this.labels.visible = !!show; this._dirty = true; };
  P.resize = function () {
    if (this._noGL) return;
    var w = this.container.clientWidth || 300, h = this.container.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // keep the whole cube in frame for narrow (portrait) containers
    var baseFov = 32;
    if (w / h < 1) {
      var vf = 2 * Math.atan(Math.tan(baseFov * Math.PI / 360) / (w / h)) * 180 / Math.PI;
      this.camera.fov = Math.min(vf, 70);
    } else this.camera.fov = baseFov;
    this.camera.updateProjectionMatrix();
    this._dirty = true;
  };

  P._bindDrag = function () {
    var self = this, cv = this.renderer.domElement, last = null, lastTime = 0;
    var ax = new THREE.Vector3(), q = new THREE.Quaternion();
    function rotateBy(dx, dy) {
      var k = 0.0085;
      q.setFromAxisAngle(ax.set(0, 1, 0), dx * k); self.pivot.quaternion.premultiply(q);
      q.setFromAxisAngle(ax.set(1, 0, 0), dy * k); self.pivot.quaternion.premultiply(q);
      self.pivot.quaternion.normalize();
      self._dirty = true;
    }
    this._rotateBy = rotateBy;
    this._onDown = function (e) {
      if (e.button != null && e.button !== 0 && e.pointerType === 'mouse') return;
      e.preventDefault();
      try { cv.setPointerCapture(e.pointerId); } catch (_) {}
      last = { x: e.clientX, y: e.clientY, id: e.pointerId };
      lastTime = performance.now();
      self._vel = null; self._viewAnim = null;
      cv.style.cursor = 'grabbing';
    };
    this._onMove = function (e) {
      if (!last || e.pointerId !== last.id) return;
      e.preventDefault();
      var dx = e.clientX - last.x, dy = e.clientY - last.y, now = performance.now();
      last.x = e.clientX; last.y = e.clientY;
      rotateBy(dx, dy);
      var dt = Math.max(1, now - lastTime); lastTime = now;
      self._vel = { x: dx / dt * 16, y: dy / dt * 16 };
      self._emit('drag', { dx: dx, dy: dy });
    };
    this._onUp = function (e) {
      if (!last || e.pointerId !== last.id) return;
      last = null; cv.style.cursor = 'grab';
      if (performance.now() - lastTime > 80) self._vel = null;
    };
    this._onTouch = function (e) { e.preventDefault(); };
    cv.addEventListener('pointerdown', this._onDown);
    cv.addEventListener('pointermove', this._onMove);
    cv.addEventListener('pointerup', this._onUp);
    cv.addEventListener('pointercancel', this._onUp);
    cv.addEventListener('touchstart', this._onTouch, { passive: false });
    cv.addEventListener('touchmove', this._onTouch, { passive: false });
  };

  P._tick = function (t) {
    // view preset animation
    var va = this._viewAnim;
    if (va) {
      if (va.start == null) va.start = t;
      var k = Math.min(1, (t - va.start) / va.dur);
      THREE.Quaternion.slerp(va.from, va.to, this.pivot.quaternion, easeInOut(k));
      this._dirty = true;
      if (k >= 1) this._viewAnim = null;
    }
    // drag inertia (damped)
    if (this._vel && !this._viewAnim) {
      this._rotateBy(this._vel.x, this._vel.y);
      this._vel.x *= 0.9; this._vel.y *= 0.9;
      if (Math.abs(this._vel.x) + Math.abs(this._vel.y) < 0.05) this._vel = null;
    }
    // turn animation
    var job = this._current;
    if (job && job.group) {
      if (job.start == null) job.start = t;
      var p = Math.min(1, (t - job.start) / job.dur);
      job.group.quaternion.setFromAxisAngle(job.axisV, job.angle * easeInOut(p));
      this._dirty = true;
      if (p >= 1) { this._finishJob(job); this._pump(); }
    }
    if (this._dirty) {
      this._dirty = false;
      this._emitFacing();
      if (this.labels.visible) this._updateLabels();
      this.renderer.render(this.scene, this.camera);
    }
  };

  // which faces point at the camera: {U: z, ...}, z in [-1, 1] (> 0 means visible)
  P.facing = function () {
    var out = {};
    if (this._noGL) { out.U = out.F = out.R = 1; out.D = out.L = out.B = -1; return out; }
    var q = this.pivot.quaternion, v = new THREE.Vector3();
    FACE_ORDER.forEach(function (f) { var n = FACES[f].n; out[f] = v.set(n[0], n[1], n[2]).applyQuaternion(q).z; });
    return out;
  };
  P._emitFacing = function () {
    if (!(this._listeners.view && this._listeners.view.length)) return;
    var f = this.facing(), sig = FACE_ORDER.map(function (k) { return Math.round(f[k] * 20); }).join(',');
    if (sig === this._facingSig) return;
    this._facingSig = sig;
    this._emit('view', f);
  };

  // only show labels of faces turned toward the camera (fade near the silhouette)
  P._updateLabels = function () {
    var q = this.pivot.quaternion, v = new THREE.Vector3();
    this.labels.children.forEach(function (sp) {
      var z = v.copy(sp.userData.n).applyQuaternion(q).z;
      var a = Math.max(0, Math.min(1, (z - 0.08) / 0.25));
      sp.visible = a > 0;
      sp.material.opacity = a;
    });
  };

  P.destroy = function () {
    this._destroyed = true;
    this.cancel();
    if (this._noGL) { if (this._note && this._note.parentNode) this._note.parentNode.removeChild(this._note); return; }
    if (this._raf) root.cancelAnimationFrame(this._raf);
    if (this._ro) this._ro.disconnect();
    if (this._onWinResize) root.removeEventListener('resize', this._onWinResize);
    var cv = this.renderer.domElement;
    cv.removeEventListener('pointerdown', this._onDown);
    cv.removeEventListener('pointermove', this._onMove);
    cv.removeEventListener('pointerup', this._onUp);
    cv.removeEventListener('pointercancel', this._onUp);
    cv.removeEventListener('touchstart', this._onTouch);
    cv.removeEventListener('touchmove', this._onTouch);
    this.scene.traverse(function (o) {
      if (o.material) {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
      }
      if (o.geometry) o.geometry.dispose();
    });
    this.renderer.dispose();
    if (cv.parentNode) cv.parentNode.removeChild(cv);
    this._listeners = { move: [], drag: [] };
  };

  CubeView.Core = Core;
  CubeView.SOLVED = SOLVED;
  CubeView.COLORS = COLORS;

  if (typeof module !== 'undefined' && module.exports) module.exports = CubeView; else root.CubeView = CubeView;
})(typeof window !== 'undefined' ? window : globalThis);
