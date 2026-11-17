/* ADePT project page: interactive charts (vanilla JS, no dependencies).
   Data: static/js/data.js (window.AD), taken from the paper's tables and figure data files. */
(function () {
  'use strict';
  var AD = window.AD, NS = 'http://www.w3.org/2000/svg';
  var COL = { 'ST-Net': '#f4a81d', 'Hist2ST': '#9aa5b1', 'BLEEP': '#12a39a', 'STEM': '#b08968', 'HyperST': '#e0478f', 'TRIPLEX': '#2f7fd6', 'ADePT': '#6d3fc8' };
  var DC = ['#c6dbef', '#6baed6', '#3182bd', '#e6550d'], COH = AD.coh, METHODS = Object.keys(AD.acc['HVG-50']);
  var FULL = { IDC: 'breast', CCRCC: 'kidney', PAAD: 'pancreas', PRAD: 'prostate', SKCM: 'skin' };
  function f3(v) { return v.toFixed(3); }
  function sg3(v) { return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(3); }

  /* ---------- helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function h(tag, attrs, html) { var e = document.createElement(tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function s(tag, attrs, text) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; }
  function f1(v) { return (Math.round(v * 10) / 10).toFixed(1); }
  function sgn(v) { return (v >= 0 ? '+' : '−') + f1(Math.abs(v)); }

  var tip = h('div', { class: 'vb-tip', role: 'status' }); document.body.appendChild(tip);
  function showTip(ev, html) {
    tip.innerHTML = html; tip.classList.add('on');
    var x = ev.clientX, y = ev.clientY, w = tip.offsetWidth, hh = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x + 14)) + 'px';
    tip.style.top = (y - hh - 12 < 8 ? y + 18 : y - hh - 12) + 'px';
  }
  function hideTip() { tip.classList.remove('on'); }
  function bindTip(el, fn) {
    el.addEventListener('pointermove', function (ev) { showTip(ev, fn(ev)); });
    el.addEventListener('pointerleave', hideTip);
    el.addEventListener('click', function (ev) { showTip(ev, fn(ev)); });
  }
  function seg(host, opts, cur, onPick, label) {
    var box = h('div', { class: 'seg', role: 'group', 'aria-label': label });
    opts.forEach(function (o) {
      var b = h('button', { type: 'button', class: o === cur ? 'on' : '' }, o);
      b.addEventListener('click', function () { box.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); onPick(o); });
      box.appendChild(b);
    });
    host.appendChild(box); return box;
  }
  function responsive(host, draw) {
    var last = 0;
    function run() { var w = host.clientWidth; if (w && Math.abs(w - last) > 4) { last = w; draw(w); } }
    run(); if ('ResizeObserver' in window) new ResizeObserver(run).observe(host); else window.addEventListener('resize', run);
    return function () { last = 0; run(); };
  }
  /* autoplay: runs while the visual is on screen; hovering pauses it, a click or key press hands control to the reader */
  var STILL = window.__still || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function autoplay(host, start, stop) {
    if (STILL || !('IntersectionObserver' in window)) return;
    var ok = true, vis = false, over = false;
    function sync() { if (!ok) return; if (vis && !over) start(); else stop(); }
    new IntersectionObserver(function (es) { vis = es[0].isIntersecting; sync(); }, { threshold: .1 }).observe(host);
    host.addEventListener('pointerenter', function (ev) { if (ev.pointerType === 'mouse') { over = true; sync(); } });
    host.addEventListener('pointerleave', function () { over = false; sync(); });
    host.addEventListener('pointerdown', function (ev) { if (ev.isTrusted) ok = false; }, true);
    host.addEventListener('keydown', function (ev) { if (ev.isTrusted) ok = false; }, true);
  }
  function autocycle(host, box, ms) {
    var t = null;
    autoplay(host, function () { if (!t) t = setInterval(function () {
      var bs = box.querySelectorAll('button'), i = 0; bs.forEach(function (b, k) { if (b.classList.contains('on')) i = k; }); bs[(i + 1) % bs.length].click();
    }, ms || 3800); }, function () { clearInterval(t); t = null; });
  }
  function axis(svg, x0, x1, y0, y1, xt, yt, xl, yl) {
    yt.forEach(function (t) {
      svg.appendChild(s('line', { x1: x0, x2: x1, y1: t[0], y2: t[0], class: 'grid' }));
      svg.appendChild(s('text', { x: x0 - 6, y: t[0] + 4, 'text-anchor': 'end', class: 'tick' }, t[1]));
    });
    xt.forEach(function (t) { svg.appendChild(s('text', { x: t[0], y: y1 + 16, 'text-anchor': 'middle', class: 'tick' }, t[1])); });
    svg.appendChild(s('line', { x1: x0, x2: x1, y1: y1, y2: y1, class: 'ax' }));
    if (xl) svg.appendChild(s('text', { x: (x0 + x1) / 2, y: y1 + 34, 'text-anchor': 'middle', class: 'lab' }, xl));
    if (yl) svg.appendChild(s('text', { x: 12, y: (y0 + y1) / 2, 'text-anchor': 'middle', class: 'lab', transform: 'rotate(-90 12 ' + (y0 + y1) / 2 + ')' }, yl));
  }

  /* ranked bars, reused by several charts */
  function rank(list, rows, max, fmt, tipfn) {
    list.innerHTML = '';
    rows.forEach(function (r) {
      var row = h('div', { class: 'rk' + (r.ours ? ' ours' : '') }, '<div class="nm">' + r.name + '</div><div class="tr"><div class="b" style="background:' + r.col + ';width:0"></div><span class="v">' + fmt(r.v) + '</span></div>');
      bindTip(row, function () { return tipfn(r); });
      row.addEventListener('pointerenter', function () { list.classList.add('dim'); row.classList.add('hot'); });
      row.addEventListener('pointerleave', function () { list.classList.remove('dim'); row.classList.remove('hot'); });
      list.appendChild(row); setTimeout(function () { row.querySelector('.b').style.width = Math.max(0, r.v / max * 100) + '%'; }, 30);
    });
  }

  /* ---------- hero: one real slide, update by update ---------- */
  (function () {
    var host = $('slide'); if (!host) return;
    var SP = AD.spots, N = SP.length, cnt = [0, 0, 0, 0], t = 4, timer = null, hold = 0;
    SP.forEach(function (p) { cnt[p[2] - 1]++; });
    var W = 58 * 10 + 10, H = 28 * 10 + 10, svg = s('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'slide-svg', role: 'img', 'aria-label': 'Per-spot executed depth on SKCM slide TENX117' });
    var dots = SP.map(function (p) {
      var c = s('circle', { cx: 10 + p[0] * 10, cy: 10 + p[1] * 10, r: 4.4 });
      bindTip(c, function () { return 'This spot stops after <b>' + p[2] + '</b> update' + (p[2] > 1 ? 's' : '') + '.'; });
      svg.appendChild(c); return c;
    });
    host.appendChild(svg);
    function set(v) {
      t = v; var done = 0, used = 0;
      SP.forEach(function (p, i) {
        var d = p[2], run = d > t, c = dots[i];
        c.setAttribute('fill', t === 0 ? '#e7e2f3' : run ? '#ffffff' : DC[d - 1]);
        c.setAttribute('class', t > 0 && run ? 'run' : (d === t ? 'pop' : ''));
        if (!run) done++; used += Math.min(d, t);
      });
      $('sl-t').textContent = t; $('sl-range').value = t;
      $('sl-note').innerHTML = !t ? 'Every spot starts with its image features. The router has not decided anything yet.' :
        '<b>After update ' + t + ':</b> ' + Math.round(done / N * 100) + '% of spots have stopped' + (t < 4 ? ', and the rest get another update.' : '.') +
        ' Updates so far: <b>' + used.toLocaleString() + '</b>, against ' + (N * t).toLocaleString() + ' at fixed depth' + (t === 4 ? ' <b>(' + Math.round((1 - used / (N * 4)) * 100) + '% fewer on this slide)</b>.' : '.');
      document.querySelectorAll('#sl-key span').forEach(function (k, i) { k.classList.toggle('on', i < t); });
    }
    function stop() { clearInterval(timer); timer = null; $('sl-play').innerHTML = '<i class="fas fa-play"></i>'; }
    $('sl-range').addEventListener('input', function () { stop(); set(+this.value); });
    $('sl-play').addEventListener('click', function () {
      if (timer) return stop();
      this.innerHTML = '<i class="fas fa-pause"></i>'; if (t >= 4) set(0);
      timer = setInterval(function () { if (t >= 4) { if (++hold > 2) { hold = 0; set(0); } } else set(t + 1); }, 1500);
    });
    var key = $('sl-key'); cnt.forEach(function (c, i) { key.appendChild(h('span', { style: '--c:' + DC[i] }, 'stops at ' + (i + 1) + ' <b>' + Math.round(c / N * 100) + '%</b>')); });
    set(4);
    autoplay(host.parentNode, function () { if (!timer) $('sl-play').click(); }, stop);
  })();

  /* ---------- method diagram ---------- */
  (function () {
    var host = $('fig2'); if (!host) return;
    var INFO = {
      he: ['H&E slide', 'A routine histology slide. Spatial transcriptomics gives the expression at each spot for training; at test time the model sees only the image.'],
      enc: ['Frozen encoders', 'Two pathology foundation models, UNI and CONCH, embed the image patch around each spot. Their weights stay frozen and the two embeddings are concatenated.'],
      knn: ['Spatial neighbors', 'Spot coordinates define a k-nearest-neighbor graph. With a fixed number of neighbors, the attention cost grows linearly with the number of spots.'],
      blk: ['Shared local–slide block', 'One block with shared weights, applied up to four times. It combines attention over the spatial neighbors of a spot with an attention-pooled summary of the whole slide.'],
      rt: ['Halting router', 'After each update a small network reads the spot state, the local message and the slide summary, and decides whether the spot stops. It uses only image features, never the expression values.'],
      halt: ['Halted spots', 'A spot that has stopped gets no further updates, but it stays in the graph as context for its neighbors.'],
      head: ['Linear head', 'A linear layer maps the final state of each spot to the expression of the genes in the panel.'],
      out: ['Predicted expression', 'One expression profile per spot. The default panel is the 50 most highly variable genes.']
    };
    var ORDER = ['he', 'enc', 'knn', 'blk', 'rt', 'halt', 'head', 'out'], LINK = { blk: ['rt'], rt: ['blk', 'halt'], halt: ['blk'], knn: ['blk'], enc: ['blk'] };
    host.innerHTML =
      '<div class="f2-row top"><div class="f2-b gray" data-k="he"><span class="f2-h"><i class="fas fa-microscope"></i> H&amp;E slide</span>spot-centered image patches</div><i class="f2-ar fas fa-arrow-right"></i>' +
      '<div class="f2-b blue" data-k="enc"><span class="f2-h"><i class="fas fa-snowflake"></i> UNI + CONCH</span>frozen encoders, one embedding per spot</div><i class="f2-ar fas fa-arrow-right"></i>' +
      '<div class="f2-b teal" data-k="knn"><span class="f2-h"><i class="fas fa-project-diagram"></i> Spatial neighbors</span>k-nearest-neighbor graph from spot coordinates</div></div>' +
      '<div class="f2-loop"><span><i class="fas fa-arrow-down"></i> spot states</span><b>one shared block, up to 4 updates</b><span>repeat <i class="fas fa-redo"></i></span></div>' +
      '<div class="f2-row top"><div class="f2-agent"><span class="f2-cap">Recursion</span><div class="f2-b pink" data-k="blk"><span class="f2-h"><i class="fas fa-layer-group"></i> Local–slide block</span>neighbor attention + slide summary, shared weights</div><span class="f2-reads"><i class="fas fa-arrow-right"></i></span><div class="f2-b ans" data-k="rt"><span class="f2-h"><i class="fas fa-traffic-light"></i> Halting router</span>stop or continue, per spot</div><span class="f2-reads"><i class="fas fa-arrow-right"></i></span><div class="f2-b white" data-k="halt"><span class="f2-h"><i class="fas fa-hand-paper"></i> Halted spots</span>no more updates, still context</div></div></div>' +
      '<div class="f2-row top"><div class="f2-b blue" data-k="head"><span class="f2-h"><i class="fas fa-ruler-horizontal"></i> Linear head</span>final spot state to genes</div><i class="f2-ar fas fa-arrow-right"></i><div class="f2-b gray" data-k="out"><span class="f2-h"><i class="fas fa-dna"></i> Predicted expression</span>one profile per spot</div></div>' +
      '<div class="f2-info" aria-live="polite"><button type="button" class="ep-play" id="f2-play" aria-label="Walk through"><i class="fas fa-play"></i></button><div><b id="f2-it"></b><span id="f2-ix"></span></div></div>';
    var timer = null, wi = 0, parts = host.querySelectorAll('[data-k]');
    function pick(k) {
      host.classList.add('focus');
      parts.forEach(function (p) { var kk = p.dataset.k; p.classList.toggle('on', kk === k); p.classList.toggle('rel', (LINK[k] || []).indexOf(kk) >= 0); });
      $('f2-it').textContent = INFO[k][0]; $('f2-ix').textContent = INFO[k][1];
    }
    function stop() { clearInterval(timer); timer = null; $('f2-play').innerHTML = '<i class="fas fa-play"></i>'; }
    parts.forEach(function (p) {
      p.setAttribute('tabindex', '0');
      p.addEventListener('click', function () { stop(); pick(p.dataset.k); });
      p.addEventListener('pointerenter', function (ev) { if (ev.pointerType === 'mouse' && !timer) pick(p.dataset.k); });
    });
    $('f2-play').addEventListener('click', function () {
      if (timer) return stop();
      this.innerHTML = '<i class="fas fa-pause"></i>'; pick(ORDER[wi]);
      timer = setInterval(function () { wi = (wi + 1) % ORDER.length; pick(ORDER[wi]); }, 2800);
    });
    $('f2-it').textContent = 'How to read this'; $('f2-ix').textContent = 'The walk-through plays while the diagram is on screen. Hover or click any block to read about it.';
    autoplay(host, function () { if (!timer) $('f2-play').click(); }, stop);
  })();

  /* ---------- RQ1: accuracy explorer ---------- */
  (function () {
    var host = $('chart-acc'); if (!host) return;
    var panel = 'HVG-50', coh = 'Average', CO = ['Average'].concat(COH), ctl = h('div', { class: 'ctl' }); host.appendChild(ctl);
    seg(ctl, ['HVG-50', 'HVG-100', 'HVG-150'], panel, function (o) { panel = o; draw(); }, 'Gene panel');
    autocycle(host, seg(ctl, CO, coh, function (o) { coh = o; draw(); }, 'Cohort'), 3800);
    var list = h('div', { class: 'rank' }), note = h('p', { class: 'chart-note' }); host.appendChild(list); host.appendChild(note);
    function draw() {
      var i = coh === 'Average' ? 5 : COH.indexOf(coh), rows = METHODS.map(function (m) { return { name: m === 'ADePT' ? 'ADePT (ours)' : m, m: m, v: AD.acc[panel][m][i], col: COL[m], ours: m === 'ADePT' }; });
      rows.sort(function (a, b) { return b.v - a.v; });
      var best = rows.filter(function (r) { return !r.ours; })[0];
      rank(list, rows, rows[0].v * 1.1, f3, function (r) {
        var e = AD.err[panel][r.m];
        return '<b>' + r.name + '</b><br>' + panel + ', ' + (coh === 'Average' ? 'mean of five cohorts' : coh + ' (' + FULL[coh] + ')') + '<br>PCC <b>' + f3(r.v) + '</b>' + (coh === 'Average' ? '<br>MSE ' + f3(e[0]) + ', MAE ' + f3(e[1]) : '') +
          (r.ours ? '<br>' + sg3(r.v - best.v) + ' against ' + best.name : '');
      });
      var a = AD.acc[panel].ADePT[i];
      note.textContent = 'Pearson correlation, mean over three seeds. ADePT ' + f3(a) + ', strongest baseline ' + best.name + ' ' + f3(best.v) + ' (' + sg3(a - best.v) + ').';
    }
    draw();
  })();

  /* ---------- RQ2a: accuracy against updates per spot ---------- */
  (function () {
    var host = $('chart-policy'); if (!host) return;
    var coh = 'CCRCC', ctl = h('div', { class: 'ctl' }); host.appendChild(ctl);
    autocycle(host, seg(ctl, COH, coh, function (o) { coh = o; redraw(); }, 'Cohort'), 4200);
    var box = h('div', {}); host.appendChild(box);
    var redraw = responsive(box, function (W) {
      box.innerHTML = ''; var F = AD.fixed[coh], T = AD.trade['HVG-50'][coh], H = 270, svg = s('svg', { width: W, height: H, class: 'ch' }); box.appendChild(svg);
      var all = F.concat([T[1]]), lo = Math.floor((Math.min.apply(null, all) - .008) * 100) / 100, hi = Math.ceil((Math.max.apply(null, all) + .008) * 100) / 100;
      var x0 = 52, x1 = W - 18, y0 = 18, y1 = H - 44, X = function (v) { return x0 + (v - .6) / 3.8 * (x1 - x0); }, Y = function (v) { return y1 - (v - lo) / (hi - lo) * (y1 - y0); }, yt = [];
      for (var v = lo; v <= hi + 1e-9; v += (hi - lo) / 4) yt.push([Y(v), v.toFixed(3)]);
      axis(svg, x0, x1, y0, y1, [1, 2, 3, 4].map(function (k) { return [X(k), k]; }), yt, 'Updates per spot', 'PCC');
      svg.appendChild(s('path', { d: F.map(function (v, k) { return (k ? 'L' : 'M') + X(k + 1) + ',' + Y(v); }).join(''), fill: 'none', stroke: '#9aa5b1', 'stroke-width': 2.5 }));
      F.forEach(function (v, k) {
        var c = s('circle', { cx: X(k + 1), cy: Y(v), r: 6.5, fill: '#fff', stroke: '#7d8794', 'stroke-width': 2.5, class: 'pt' });
        bindTip(c, function () { return '<b>Fixed depth K = ' + (k + 1) + '</b>, ' + coh + '<br>PCC <b>' + f3(v) + '</b><br>every spot gets ' + (k + 1) + ' update' + (k ? 's' : ''); }); svg.appendChild(c);
        svg.appendChild(s('text', { x: X(k + 1), y: Y(v) + 20, 'text-anchor': 'middle', class: 'tick' }, 'K=' + (k + 1)));
      });
      var g = s('g', { class: 'pt', transform: 'translate(' + X(T[2]) + ',' + Y(T[1]) + ')' }), d = '';
      for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? 6.3 : 14; d += (i ? 'L' : 'M') + (q * Math.cos(a)).toFixed(2) + ',' + (q * Math.sin(a)).toFixed(2); }
      g.appendChild(s('path', { d: d + 'Z', fill: COL.ADePT, stroke: '#fff', 'stroke-width': 1.5 }));
      var tx = s('text', { x: 17, y: 5, class: 'lab b' }, 'ADePT ' + f3(T[1])); tx.style.fill = COL.ADePT; if (X(T[2]) > x1 - 110) { tx.setAttribute('x', -17); tx.setAttribute('text-anchor', 'end'); } g.appendChild(tx);
      bindTip(g, function () { return '<b>ADePT</b>, ' + coh + '<br>PCC <b>' + f3(T[1]) + '</b> at <b>' + T[2].toFixed(2) + '</b> updates per spot<br>' + sg3(T[1] - T[0]) + ' PCC and ' + T[3] + '% fewer updates than fixed K = 4'; });
      svg.appendChild(g);
    });
  })();

  /* ---------- RQ2b: adaptive minus fixed, per cohort ---------- */
  (function () {
    var host = $('chart-trade'); if (!host) return;
    var panel = 'HVG-50', ctl = h('div', { class: 'ctl' }); host.appendChild(ctl);
    autocycle(host, seg(ctl, ['HVG-50', 'HVG-100', 'HVG-150'], panel, function (o) { panel = o; draw(); }, 'Gene panel'), 4400);
    var list = h('div', { class: 'dv' }); host.appendChild(list);
    function draw() {
      list.innerHTML = '';
      COH.concat(['Average']).forEach(function (c) {
        var T = AD.trade[panel][c], dl = T[1] - T[0], row = h('div', { class: 'dv-row' + (c === 'Average' ? ' avg' : '') },
          '<div class="nm">' + c + '</div><div class="dv-bar"><i></i><span style="' + (dl >= 0 ? 'left:50%' : 'right:50%') + ';width:0;background:' + (dl >= 0 ? '#12a39a' : '#e6550d') + '"></span></div><div class="dv-v">' + sg3(dl) + '</div><div class="dv-u"><b>' + T[3].toFixed(1) + '%</b> fewer updates</div>');
        bindTip(row, function () { return '<b>' + c + '</b>, ' + panel + '<br>Fixed K = 4: PCC ' + f3(T[0]) + '<br>ADePT: PCC <b>' + f3(T[1]) + '</b> (' + sg3(dl) + ')<br>' + T[2].toFixed(2) + ' updates per spot, <b>' + T[3] + '%</b> fewer'; });
        list.appendChild(row); setTimeout(function () { row.querySelector('.dv-bar span').style.width = Math.min(50, Math.abs(dl) / .026 * 50) + '%'; }, 30);
      });
    }
    draw();
  })();

  /* ---------- RQ2c: executed depth per cohort ---------- */
  (function () {
    var host = $('chart-dist'); if (!host) return;
    var list = h('div', { class: 'rank stack' }); host.appendChild(list);
    ['IDC', 'CCRCC', 'PRAD', 'SKCM', 'PAAD'].forEach(function (c) {
      var D = AD.dist[c], mean = AD.trade['HVG-50'][c][2], row = h('div', { class: 'rk' }, '<div class="nm">' + c + '</div><div class="tr"></div>'), tr = row.querySelector('.tr');
      D.forEach(function (v, k) {
        var b = h('div', { class: 'b sg d' + (k + 1), style: 'background:' + DC[k] + ';width:0' }, v >= 9 ? '<i>' + v.toFixed(0) + '</i>' : '');
        bindTip(b, function () { return '<b>' + c + '</b> (' + FULL[c] + ')<br><b>' + v.toFixed(1) + '%</b> of test spots stop after ' + (k + 1) + ' update' + (k ? 's' : '') + '<br>Mean depth ' + mean.toFixed(2); });
        tr.appendChild(b); setTimeout(function () { b.style.width = v + '%'; }, 30);
      });
      tr.appendChild(h('span', { class: 'v' }, mean.toFixed(2))); list.appendChild(row);
    });
    var key = h('div', { class: 'chips' }); DC.forEach(function (c, k) { key.appendChild(h('span', { class: 'chip', style: '--c:' + c }, 'Depth ' + (k + 1))); }); host.appendChild(key);
  })();

  /* ---------- RQ2d: benefit of extra depth on one slide ---------- */
  (function () {
    var host = $('chart-benefit'); if (!host) return;
    var B = [0, 23, 35, 51];
    responsive(host, function (W) {
      host.innerHTML = ''; var H = 250, svg = s('svg', { width: W, height: H, class: 'ch' }); host.appendChild(svg);
      var x0 = 44, x1 = W - 10, y0 = 22, y1 = H - 44, bw = Math.min(64, (x1 - x0) / 5.5), X = function (i) { return x0 + (i + .5) * (x1 - x0) / 4; }, Y = function (v) { return y1 - v / 60 * (y1 - y0); };
      axis(svg, x0, x1, y0, y1, B.map(function (b, i) { return [X(i), 'depth ' + (i + 1)]; }), [0, 20, 40, 60].map(function (v) { return [Y(v), v + '%']; }), 'Executed depth of the spot', 'Error drop');
      B.forEach(function (v, i) {
        var r = s('rect', { x: X(i) - bw / 2, y: Y(Math.max(v, .8)), width: bw, height: y1 - Y(Math.max(v, .8)), rx: 5, fill: DC[i], class: 'wbar' });
        bindTip(r, function () { return i ? 'Spots that run <b>' + (i + 1) + ' updates</b> end with a mean squared error <b>' + v + '%</b> lower than after their first update.' : 'Spots that stop after one update are the reference (0%).'; });
        svg.appendChild(r); svg.appendChild(s('text', { x: X(i), y: Y(v) - 7, 'text-anchor': 'middle', class: 'lab b' }, v + '%'));
      });
    });
  })();

  /* ---------- RQ3: measured cost ---------- */
  (function () {
    var host = $('chart-cost'); if (!host) return;
    var M = { 'Updates': [1, 2, ' updates per slide', 0], 'GFLOPs': [3, 4, ' GFLOPs per slide', 1], 'Latency': [5, 6, ' ms per slide', 1] }, mode = 'GFLOPs', ctl = h('div', { class: 'ctl' }); host.appendChild(ctl);
    autocycle(host, seg(ctl, Object.keys(M), mode, function (o) { mode = o; draw(); }, 'Cost measure'), 4200);
    var list = h('div', { class: 'pair' }); host.appendChild(list);
    var key = h('div', { class: 'chips' }, '<span class="chip" style="--c:#9aa5b1">Fixed depth K = 4</span><span class="chip" style="--c:#6d3fc8">ADePT</span>'); host.appendChild(key);
    var note = h('p', { class: 'chart-note' }); host.appendChild(note);
    function draw() {
      list.innerHTML = ''; var m = M[mode], order = ['IDC', 'CCRCC', 'PRAD', 'PAAD', 'SKCM'], max = 0;
      order.forEach(function (c) { max = Math.max(max, AD.cost[c][m[0]]); });
      order.forEach(function (c) {
        var C = AD.cost[c], a = C[m[0]], b = C[m[1]], better = b < a, fm = function (v) { return m[3] ? v.toFixed(1) : v.toLocaleString(); };
        var row = h('div', { class: 'pr' }, '<div class="nm">' + c + '<small>' + C[0] + 'k spots</small></div><div class="pr-b"><div><span style="background:#9aa5b1;width:0"></span><em>' + fm(a) + '</em></div><div><span style="background:#6d3fc8;width:0"></span><em><b>' + fm(b) + '</b></em></div></div><div class="pr-d ' + (better ? 'good' : 'bad') + '">' + (mode === 'Latency' ? (a / b).toFixed(2) + '×' : '−' + Math.round((1 - b / a) * 100) + '%') + '</div>');
        bindTip(row, function () { return '<b>' + c + '</b> (' + C[0] + 'k spots per slide)<br>Fixed K = 4: ' + fm(a) + m[2] + '<br>ADePT: <b>' + fm(b) + '</b>' + m[2] + '<br>' + (better ? Math.round((1 - b / a) * 100) + '% lower' : Math.round((b / a - 1) * 100) + '% higher') + (mode === 'Latency' ? ', speedup ' + (a / b).toFixed(2) + '×' : ''); });
        list.appendChild(row);
        setTimeout(function () { var sp = row.querySelectorAll('.pr-b span'); sp[0].style.width = a / max * 100 + '%'; sp[1].style.width = b / max * 100 + '%'; }, 30);
      });
      note.textContent = mode === 'Latency' ? 'Latency falls on four of five cohorts. On SKCM, the smallest slides, routing overhead outweighs the saving.' : mode === 'GFLOPs' ? 'Floating-point operations of the prediction model fall on all five cohorts.' : 'Block applications summed over the spots of a slide.';
    }
    draw();
  })();

  /* ---------- RQ4: component ablations ---------- */
  (function () {
    var host = $('chart-abl'); if (!host) return;
    var V = '#6d3fc8', G = '#b6bfca';
    var AB = {
      'Update block': ['IDC, HVG-50', [['Local + slide, shared (ADePT)', .582, V], ['Self-attention in place of the slide token', .581, G], ['Local only, no slide token', .576, G], ['Self-attention in place of local attention', .576, G], ['Slide only, no local attention', .575, G]], 'The local and slide parts together give the highest PCC. Self-attention in place of the slide token is close, but its cost is quadratic in the number of spots.'],
      'Loss': ['IDC, HVG-50', [['MSE + PCC loss (ADePT)', .582, V], ['MSE loss only', .577, G], ['PCC loss only', .577, G]], 'Each loss term alone gives 0.577; the two together give 0.582.'],
      'Neighbors': ['IDC, HVG-50', [['Spatial nearest neighbors (ADePT)', .582, V], ['No neighbors, slide only', .575, G], ['Random neighbors', .572, G]], 'Random spots as neighbors are worse than no neighbors, so the gain comes from spatially adjacent spots.'],
      'Encoder': ['IDC, HVG-50', [['UNI + CONCH (ADePT)', .582, V], ['UNI only', .569, G], ['CONCH only', .551, G]], 'The two frozen encoders together are better than either alone.'],
      'Neighbor count': ['five-cohort mean, HVG-50', [['k = 8 (ADePT)', .477, V], ['k = 4', .470, G], ['k = 6', .470, G], ['k = 10', .467, G], ['HyperST, strongest baseline', .453, '#e0478f']], 'Every neighbor count stays above the strongest baseline.'],
      'Halting rule': ['five-cohort mean, HVG-50', [['Learned router (ADePT)', .477, V], ['Convergence rule', .462, G], ['Random halting', .454, G], ['Local-variance rule', .452, G]], 'The learned router is above three simpler stopping rules. The largest gaps are on PAAD and SKCM, 0.034 to 0.058 PCC.']
    };
    var cur = 'Update block', ctl = h('div', { class: 'ctl' }); host.appendChild(ctl);
    autocycle(host, seg(ctl, Object.keys(AB), cur, function (o) { cur = o; draw(); }, 'Ablation'), 4600);
    var list = h('div', { class: 'rank wide' }), note = h('p', { class: 'chart-note' }); host.appendChild(list); host.appendChild(note);
    function draw() {
      var A = AB[cur], rows = A[1].map(function (r) { return { name: r[0], v: r[1], col: r[2], ours: r[2] === V }; }), lo = Math.min.apply(null, rows.map(function (r) { return r.v; })) - .012;
      rank(list, rows.map(function (r) { return { name: r.name, v: r.v - lo, raw: r.v, col: r.col, ours: r.ours }; }), rows[0].v - lo + .004, function (v) { return f3(v + lo); }, function (r) { return '<b>' + r.name + '</b><br>' + A[0] + '<br>PCC <b>' + f3(r.raw) + '</b>' + (r.ours ? '' : '<br>' + sg3(r.raw - rows[0].v) + ' against ADePT'); });
      note.textContent = A[2] + ' Bars start at ' + f3(lo) + ', not at zero (' + A[0] + ').';
    }
    draw();
  })();

  /* ---------- RQ5: unseen organs ---------- */
  (function () {
    var host = $('chart-looo'); if (!host) return;
    var coh = 'Average', ctl = h('div', { class: 'ctl' }); host.appendChild(ctl);
    autocycle(host, seg(ctl, ['Average'].concat(COH), coh, function (o) { coh = o; draw(); }, 'Held-out organ'), 4000);
    var list = h('div', { class: 'rank' }), note = h('p', { class: 'chart-note' }); host.appendChild(list); host.appendChild(note);
    function draw() {
      var i = coh === 'Average' ? 5 : COH.indexOf(coh), rows = METHODS.map(function (m) { return { name: m === 'ADePT' ? 'ADePT (ours)' : m, v: AD.looo[m][i], col: COL[m], ours: m === 'ADePT' }; });
      rows.sort(function (a, b) { return b.v - a.v; });
      rank(list, rows, rows[0].v * 1.12, f3, function (r) { return '<b>' + r.name + '</b><br>' + (coh === 'Average' ? 'mean over the five held-out organs' : coh + ' (' + FULL[coh] + ') held out of training') + '<br>PCC <b>' + f3(r.v) + '</b>'; });
      note.textContent = coh === 'Average' ? 'Each model is trained on four organs and tested on the fifth. The gain over TRIPLEX is not significant (p = 0.33).' : coh + ' held out; the model is trained on the other four organs.' + (i === 1 || i === 3 ? ' Accuracy stays low for every method on this organ.' : '');
    }
    draw();
  })();

  /* ---------- qualitative maps: ground truth against one method ---------- */
  (function () {
    var host = $('qual'); if (!host) return;
    var MM = ['ST-Net', 'Hist2ST', 'BLEEP', 'STEM', 'TRIPLEX', 'HyperST', 'ADePT'], gene = 'CD52', m = 'ADePT', ctl = h('div', { class: 'ctl' }); host.appendChild(ctl);
    seg(ctl, Object.keys(AD.qual), gene, function (o) { gene = o; draw(); }, 'Gene');
    autocycle(host, seg(ctl, MM, m, function (o) { m = o; draw(); }, 'Method'), 2600);
    var box = h('div', { class: 'q-pair' }, '<figure><img id="q-gt" class="zoomable nohint" alt="Measured expression"><figcaption>Measured expression</figcaption></figure><figure><img id="q-pr" class="zoomable nohint" alt="Predicted expression"><figcaption id="q-cap"></figcaption></figure>'); host.appendChild(box);
    var bars = h('div', { class: 'q-bars' }); host.appendChild(bars);
    function draw() {
      $('q-gt').src = 'static/images/qual/' + gene + '_0.jpg'; $('q-pr').src = 'static/images/qual/' + gene + '_' + (MM.indexOf(m) + 1) + '.jpg';
      $('q-cap').innerHTML = '<b style="color:' + COL[m] + '">' + m + '</b> prediction, PCC <b>' + AD.qual[gene][MM.indexOf(m)].toFixed(2) + '</b>';
      bars.innerHTML = '';
      MM.forEach(function (x, i) {
        var v = AD.qual[gene][i], b = h('button', { type: 'button', class: 'q-b' + (x === m ? ' on' : ''), style: '--c:' + COL[x] }, '<span style="height:' + ((v - .55) / .4 * 100) + '%"></span><em>' + v.toFixed(2) + '</em><small>' + x + '</small>');
        b.addEventListener('click', function () { m = x; ctl.querySelectorAll('.seg')[1].querySelectorAll('button')[i].click(); });
        bars.appendChild(b);
      });
    }
    draw();
  })();

  /* ---------- zoomable figures ---------- */
  (function () {
    var lb = h('div', { class: 'lb', role: 'dialog', 'aria-label': 'Figure viewer' }, '<div class="lb-bar"><span class="lb-t"></span><button type="button" data-z="1.4">+</button><button type="button" data-z="0.714">&minus;</button><button type="button" data-z="0">Fit</button><button type="button" class="x" aria-label="Close">&times;</button></div><div class="lb-stage"><img alt=""></div>');
    document.body.appendChild(lb);
    var img = lb.querySelector('img'), stage = lb.querySelector('.lb-stage'), z = 1, tx = 0, ty = 0, drag = null;
    function apply() { img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + z + ')'; }
    function zoom(f) { if (!f) { z = 1; tx = ty = 0; } else { z = Math.max(1, Math.min(8, z * f)); if (z === 1) tx = ty = 0; } apply(); }
    function close() { lb.classList.remove('on'); document.body.style.overflow = ''; }
    document.querySelectorAll('img.zoomable').forEach(function (im) {
      function open() { img.src = im.src; lb.querySelector('.lb-t').textContent = im.alt; img.style.minWidth = im.naturalWidth < 500 ? Math.min(420, im.naturalWidth * 2.5) + 'px' : ''; zoom(0); lb.classList.add('on'); document.body.style.overflow = 'hidden'; }
      im.addEventListener('click', open);
    });
    lb.querySelectorAll('[data-z]').forEach(function (b) { b.addEventListener('click', function () { zoom(parseFloat(b.dataset.z)); }); });
    lb.querySelector('.x').addEventListener('click', close);
    stage.addEventListener('click', function (ev) { if (ev.target === stage) close(); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') close(); });
    stage.addEventListener('wheel', function (ev) { ev.preventDefault(); zoom(ev.deltaY < 0 ? 1.15 : .87); }, { passive: false });
    img.addEventListener('dblclick', function () { zoom(z > 1 ? 0 : 2.5); });
    img.addEventListener('pointerdown', function (ev) { drag = [ev.clientX - tx, ev.clientY - ty]; img.setPointerCapture(ev.pointerId); });
    img.addEventListener('pointermove', function (ev) { if (drag && z > 1) { tx = ev.clientX - drag[0]; ty = ev.clientY - drag[1]; apply(); } });
    img.addEventListener('pointerup', function () { drag = null; });
    img.addEventListener('dragstart', function (ev) { ev.preventDefault(); });
  })();

  /* ---------- count-up stats and reveal ---------- */
  (function () {
    var still = window.__still || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var rev = document.querySelectorAll('.reveal');
    if (still || !('IntersectionObserver' in window)) { rev.forEach(function (e) { e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: .06 });
    rev.forEach(function (e) { io.observe(e); });
    document.querySelectorAll('.stat .num[data-to]').forEach(function (el) {
      var to = parseFloat(el.dataset.to), pre = el.dataset.pre || '', t0 = null;
      function step(t) { if (!t0) t0 = t; var p = Math.min(1, (t - t0) / 1100), v = to * (1 - Math.pow(1 - p, 3)); el.textContent = pre + v.toFixed(1); if (p < 1) requestAnimationFrame(step); }
      requestAnimationFrame(step);
    });
  })();
})();
