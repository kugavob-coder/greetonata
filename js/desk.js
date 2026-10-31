/* Greetonata — wide screens only: "program notes" on the left, and on the right a little
   score that writes itself while the card plays (floating notes the rest of the time). */
(function () {
  const WIDE = window.matchMedia('(min-width:1080px)');
  const css = `
.desk{display:none}
@media (min-width:1080px){
  .desk{display:block;position:fixed;top:120px;width:250px;bottom:40px;pointer-events:none}
  .desk-notes{left:calc(50% - 230px - 300px)}
  .desk-art{right:calc(50% - 230px - 300px)}
  .desk-notes .rule{width:100%;height:14px;display:block;overflow:visible}
  .desk-notes .rule path{fill:none;stroke:var(--gold);stroke-width:1.2}
  .desk-notes .k{font:600 12px 'DM Sans',sans-serif;letter-spacing:2.5px;text-transform:uppercase;color:var(--gold);margin:14px 0 8px}
  .desk-notes h4{font:600 26px/1.1 'Cormorant Garamond',serif;color:var(--ink);margin-bottom:10px}
  .desk-notes p{font:italic 18px/1.5 'Cormorant Garamond',serif;color:var(--muted);margin-bottom:10px}
  .desk-notes p b{font-style:normal;font-weight:600;color:var(--ink)}
  .desk-notes .body{transition:opacity .45s,transform .45s}
  .desk-notes .body.out{opacity:0;transform:translateY(8px)}
  .desk-art canvas{width:100%;height:100%;display:block}
}`;
  const st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);
  const notesEl = document.createElement('aside');
  notesEl.className = 'desk desk-notes';
  notesEl.setAttribute('aria-label', 'Program notes');
  notesEl.innerHTML =
    '<svg class="rule" viewBox="0 0 250 14" preserveAspectRatio="none"><path d="M0 7 Q62 0 125 7 T250 7"/></svg><div class="k">Program notes</div><div class="body"><h4></h4><div class="txt"></div></div><svg class="rule" viewBox="0 0 250 14" preserveAspectRatio="none"><path d="M0 7 Q62 14 125 7 T250 7"/></svg>';
  const artEl = document.createElement('aside');
  artEl.className = 'desk desk-art';
  artEl.setAttribute('aria-hidden', 'true');
  const cv = document.createElement('canvas');
  artEl.appendChild(cv);
  document.body.append(notesEl, artEl);

  let NOTES = {},
    current = null,
    song = null,
    clock = null,
    floaters = [],
    last = 0;
  const accent = () => getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#a87832';
  const gold = () => getComputedStyle(document.body).getPropertyValue('--gold').trim() || '#a87832';
  const line = () => getComputedStyle(document.body).getPropertyValue('--line').trim() || '#dfcba8';

  function show(key) {
    if (key === current || !NOTES[key]) return;
    current = key;
    const body = notesEl.querySelector('.body');
    body.classList.add('out');
    setTimeout(
      () => {
        const [t, html] = NOTES[key];
        body.querySelector('h4').textContent = t;
        body.querySelector('.txt').innerHTML = html;
        body.classList.remove('out');
      },
      WIDE.matches ? 300 : 0,
    );
  }
  function size() {
    const r = artEl.getBoundingClientRect(),
      d = Math.min(2, window.devicePixelRatio || 1),
      w = Math.max(1, Math.round(r.width * d)),
      h = Math.max(1, Math.round(r.height * d));
    if (cv.width !== w || cv.height !== h) {
      cv.width = w;
      cv.height = h;
    }
    return d;
  }

  /* the score: melody notes on staves, written as they sound */
  function drawScore(ctx, W, H, el) {
    const mel = song.notes.filter(n => n.beats),
      N = mel.length;
    if (!N) return;
    const perRow = 10,
      rows = Math.ceil(N / perRow),
      gap = 9,
      staffH = gap * 4,
      rowH = staffH + 46,
      top = 20;
    const lo = Math.min(...mel.map(n => n.midi)),
      hi = Math.max(...mel.map(n => n.midi));
    ctx.strokeStyle = line();
    ctx.lineWidth = 1;
    for (let r = 0; r < rows; r++)
      for (let k = 0; k < 5; k++) {
        const y = top + r * rowH + k * gap;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
    const keys = new Set((song.words || []).filter(w => w.key).map(w => w.t.toFixed(3)));
    mel.forEach((n, i) => {
      if (n.t > el) return;
      const r = Math.floor(i / perRow),
        c = i % perRow,
        x = 14 + (c * (W - 28)) / (perRow - 1);
      const y = top + r * rowH + staffH - ((n.midi - lo) / Math.max(1, hi - lo)) * staffH * 1.15 + 4;
      const fresh = Math.max(0, 1 - (el - n.t) / 0.6),
        big = keys.has(n.t.toFixed(3));
      ctx.fillStyle = big ? gold() : accent();
      ctx.strokeStyle = ctx.fillStyle;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.35);
      ctx.beginPath();
      ctx.ellipse(
        0,
        0,
        (big ? 6 : 4.6) * (1 + fresh * 0.5),
        (big ? 4.4 : 3.4) * (1 + fresh * 0.5),
        0,
        0,
        Math.PI * 2,
      );
      n.beats >= 2 ? ((ctx.lineWidth = 1.4), ctx.stroke()) : ctx.fill();
      ctx.restore();
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + 4.2, y - 1);
      ctx.lineTo(x + 4.2, y - 24);
      ctx.stroke();
      if (n.beats < 1) {
        ctx.beginPath();
        ctx.moveTo(x + 4.2, y - 24);
        ctx.quadraticCurveTo(x + 12, y - 18, x + 10, y - 10);
        ctx.stroke();
      }
      if (fresh > 0) {
        ctx.globalAlpha = fresh * 0.5;
        ctx.beginPath();
        ctx.arc(x, y, 14 * fresh + 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    });
  }
  /* the rest of the time: a few notes and stars drifting up */
  function drawFloaters(ctx, W, H, dt) {
    if (floaters.length < 14 && Math.random() < dt * 2.2)
      floaters.push({
        x: Math.random() * W,
        y: H + 10,
        v: 12 + Math.random() * 16,
        s: 14 + Math.random() * 12,
        g: ['♪', '♫', '✧', '♩'][Math.floor(Math.random() * 4)],
        a: 0,
        w: Math.random() * 6,
      });
    ctx.textAlign = 'center';
    for (const f of floaters) {
      f.y -= f.v * dt;
      f.w += dt;
      f.a = Math.min(0.55, f.a + dt * 0.4);
      const fade = Math.min(1, f.y / (H * 0.35));
      ctx.globalAlpha = f.a * Math.max(0, fade);
      ctx.fillStyle = f.g === '✧' ? gold() : accent();
      ctx.font = f.s + 'px "Cormorant Garamond",serif';
      ctx.fillText(f.g, f.x + Math.sin(f.w) * 8, f.y);
    }
    ctx.globalAlpha = 1;
    floaters = floaters.filter(f => f.y > -20);
  }
  function frame(now) {
    const dt = Math.min(0.05, (now - (last || now)) / 1000);
    last = now;
    if (WIDE.matches) {
      const d = size(),
        ctx = cv.getContext('2d'),
        W = cv.width / d,
        H = cv.height / d;
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (song) drawScore(ctx, W, H, clock ? clock() : 1e9);
      else if (!matchMedia('(prefers-reduced-motion: reduce)').matches) drawFloaters(ctx, W, H, dt);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.Desk = {
    setNotes(n) {
      NOTES = n;
    },
    notes: show,
    score(s, c) {
      song = s;
      clock = c;
    }, // show the tune being written (clock = seconds since it started)
    idle() {
      song = null;
      clock = null;
    },
  };
})();
