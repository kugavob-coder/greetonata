/* Greetonata — drawing on the page.
   paint() draws a shape up to a given moment, the sparkles live along the card's edges,
   and the candles of a birthday cake can be lit and blown out. */

/* "reduce motion" in the system settings: no sparkles, no gliding, quieter decorations */
const REDUCED_MOTION = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
const calm = () => !!(REDUCED_MOTION && REDUCED_MOTION.matches);
const glide = () => (calm() ? 'auto' : 'smooth');

/* the accent as a text colour: same hue, but dark (or light) enough to read on the card paper */
function readableInk(color, paper) {
  const rgb = c => {
    const x = document.createElement('canvas').getContext('2d');
    x.fillStyle = c;
    const h = x.fillStyle.slice(1);
    return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16) / 255);
  };
  const lum = c => {
    const [r, g, b] = c.map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  const bg = rgb(paper),
    darkPaper = lum(bg) < 0.3;
  let c = rgb(color);
  for (let i = 0; i < 40 && contrast(c, bg) < 4.5; i++)
    c = c.map(v => (darkPaper ? v + (1 - v) * 0.08 : v * 0.92));
  return '#' + c.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}

/* ================= drawing a card shape ================= */
const clamp = v => (v < 0 ? 0 : v > 1 ? 1 : v);
function normT(els) {
  const m = Math.max(...els.map(e => e.t1));
  if (m > 1)
    for (const e of els) {
      e.t0 /= m;
      e.t1 /= m;
    }
  return els;
}
function sizeCanvas(c, css) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = c.height = Math.round(css * dpr);
}
function tracePath(ctx, pts, X, Y) {
  ctx.beginPath();
  pts.forEach((pt, i) => (i ? ctx.lineTo(X(pt), Y(pt)) : ctx.moveTo(X(pt), Y(pt))));
}
/* p = how much is drawn (0..1); mono = draw everything in one colour (wax seal) */
function paint(ctx, els, p, mono) {
  const S = ctx.canvas.width,
    c = S / 2,
    u = S * 0.47,
    px = (S / 360) * (mono ? 2.2 : 1);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, S, S);
  const X = pt => c + pt.x * u,
    Y = pt => c + pt.y * u;
  for (const e of els) {
    if (p <= e.t0) continue;
    const q = clamp((p - e.t0) / Math.max(0.001, e.t1 - e.t0));
    if (e.k === 'fill') {
      if (mono) {
        ctx.globalAlpha = 0.18 * q;
        ctx.fillStyle = mono;
      } else {
        ctx.globalAlpha = q * (celestial ? 0.62 : 0.95);
        if (e.lin) {
          const g = ctx.createLinearGradient(0, Y(P(0, e.lin[0])), 0, Y(P(0, e.lin[1])));
          for (const [o, col] of e.stops) g.addColorStop(o, col);
          ctx.fillStyle = g;
        } else if (e.stops) {
          const g = ctx.createRadialGradient(c, c, e.r0 * u, c, c, Math.max(e.r0 + 0.01, e.r1) * u);
          for (const [o, col] of e.stops) g.addColorStop(o, col);
          ctx.fillStyle = g;
        } else ctx.fillStyle = e.col;
      }
      tracePath(ctx, e.pts, X, Y);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (e.k === 'line') {
      const n = e.pts.length - 1,
        upto = q * n,
        full = Math.floor(upto);
      ctx.beginPath();
      ctx.moveTo(X(e.pts[0]), Y(e.pts[0]));
      for (let i = 1; i <= full; i++) ctx.lineTo(X(e.pts[i]), Y(e.pts[i]));
      if (full < n) {
        const a = e.pts[full],
          b = e.pts[full + 1],
          t = upto - full,
          m = P(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
        ctx.lineTo(X(m), Y(m));
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (e.dash) ctx.setLineDash([2 * px, 6 * px]);
      const col = mono || (typeof e.col === 'string' ? e.col : hsl(e.col));
      if (celestial && !mono) {
        ctx.globalAlpha = 0.22;
        ctx.strokeStyle = col;
        ctx.lineWidth = e.w * px * 3.2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.globalAlpha = mono ? 0.85 : 1;
      ctx.strokeStyle = col;
      ctx.lineWidth = e.w * px * (mono ? 0.7 : 1);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    } else if (e.k === 'text') {
      /* a number candle: a big numeral, filled and outlined */
      ctx.save();
      ctx.globalAlpha = q;
      ctx.translate(X(e), Y(e));
      const sc = 0.7 + 0.3 * q;
      ctx.scale(sc, sc);
      ctx.font = `700 ${e.size * u}px 'DM Sans',Arial,sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic'; // lining figures, so every digit has the same height
      if (mono) {
        ctx.fillStyle = mono;
        ctx.globalAlpha = 0.85 * q;
        ctx.fillText(e.txt, 0, 0);
      } else {
        ctx.fillStyle = e.col;
        ctx.fillText(e.txt, 0, 0);
        ctx.lineWidth = 1.4 * px;
        ctx.strokeStyle = e.stroke;
        ctx.strokeText(e.txt, 0, 0);
      }
      const top = ctx.measureText(e.txt).actualBoundingBoxAscent || e.size * u * 0.7,
        wick = e.size * u * 0.07;
      if (q >= 1) {
        ctx.strokeStyle = mono || '#4a3424';
        ctx.lineWidth = 2 * px;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -top + 1);
        ctx.lineTo(0, -top - wick);
        ctx.stroke();
      }
      ctx.restore();
      if (e.flame) e.flame.y = (Y(e) - top - wick * 0.85 - c) / u;
    } else {
      const k = q < 1 ? 1 + 0.35 * Math.sin(q * Math.PI) : 1;
      if (celestial && !mono) {
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = e.col;
        ctx.beginPath();
        ctx.arc(X(e), Y(e), e.r * u * k * q * 2, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = mono || e.col;
      ctx.beginPath();
      ctx.arc(X(e), Y(e), e.r * u * k * q, 0, TAU);
      ctx.fill();
    }
  }
}
/* splits the message into word spans (each word lights up with its note) */
function fillMessage(el, text, waiting) {
  el.innerHTML = '';
  const spans = [];
  for (const part of text.split(/(\s+)/)) {
    if (part === '' || /^\s+$/.test(part)) {
      el.appendChild(document.createTextNode(part));
      continue;
    }
    const s = document.createElement('span');
    s.textContent = part;
    if (waiting) s.className = 'wait';
    el.appendChild(s);
    spans.push(s);
  }
  return spans;
}

/* keeps the word that is playing in view: the page glides down by itself */
function followWord(span) {
  const r = span.getBoundingClientRect(),
    h = window.innerHeight;
  if (r.bottom > h * 0.82) window.scrollBy({ top: r.top - h * 0.55, behavior: glide() });
}
/* brings the top of the card to the top of the screen */
function cardToTop(el) {
  const y = el.getBoundingClientRect().top + window.scrollY - 12;
  window.scrollTo({ top: Math.max(0, y), behavior: glide() });
}

/* ================= sparkles along the edges ================= */
const GOLD = ['#d4a94e', '#e9c46a', '#f0d99b'];
function makeFx(canvas) {
  return { cv: canvas, parts: [], on: false, w: 0, h: 0, dpr: 1 };
}
function fxKinds() {
  return {
    birthday: ['star', 'flower', 'dot'],
    celebration: ['petal', 'star', 'dot'],
    xmas: ['twinkle', 'flake', 'twinkle'],
    thanks: ['heart', 'flower', 'heart'],
  }[occ];
}
function fxColors() {
  const a = scene ? scene.accent : '#d97861';
  let c = {
    birthday: [a, '#f1b86b', '#e88b70'],
    celebration: [a, '#e9b2a1', '#d7a3c7'],
    xmas: celestial ? ['#cfe6ff', '#b9dcbf', '#f0d99b'] : ['#6f9ec9', '#8fb9d8', '#c9a64e'],
    thanks: [a, '#e8a05d', '#d9776f'],
  }[occ];
  if (mood === 'festive') c = [...GOLD, ...GOLD, c[0]];
  return AI && AI.palette ? [...c, ...AI.palette] : c;
}
function sizeFx(o) {
  const w = o.cv.offsetWidth,
    h = o.cv.offsetHeight,
    dpr = Math.min(2, window.devicePixelRatio || 1);
  o.cv.width = Math.max(1, w * dpr);
  o.cv.height = Math.max(1, h * dpr);
  o.dpr = dpr;
  o.w = w;
  o.h = h;
}
function spawn(o, kind, x, y) {
  const R = Math.random,
    cols = fxColors();
  const p = {
    kind,
    x,
    y,
    r: 3 + R() * 4,
    rot: R() * 6.28,
    vr: (R() - 0.5) * 2,
    vx: 0,
    vy: 0,
    age: 0,
    life: 1 + R() * 1.2,
    col: cols[Math.floor(R() * cols.length)],
    sw: R() * 6.28,
  };
  if (kind === 'flake') {
    p.vy = 14 + R() * 14;
    p.life = 3 + R() * 2;
    p.r = 4 + R() * 3;
  }
  if (kind === 'heart' || kind === 'flower') {
    p.vy = -(10 + R() * 14);
    p.life = 2.4 + R() * 1.6;
    p.vr = (R() - 0.5) * 1.6;
    p.r = 4 + R() * 3;
  }
  if (kind === 'petal') {
    p.vx = (R() - 0.5) * 16;
    p.vy = 8 + R() * 10;
    p.life = 2.5 + R() * 1.5;
  }
  if (kind === 'confetti') {
    p.vx = (R() - 0.5) * 12;
    p.vy = 18 + R() * 16;
    p.life = 2.4 + R() * 1.4;
    p.r = 3 + R() * 2.5;
    p.vr = (R() - 0.5) * 6;
  }
  if (kind === 'dot') {
    p.r = 1.4 + R() * 1.6;
    p.life = 0.8 + R() * 0.8;
  }
  if (kind === 'twinkle' || kind === 'star') {
    p.r = 4 + R() * 5;
    p.life = 0.8 + R() * 0.9;
    p.vr = (R() - 0.5) * 0.6;
  }
  if (mood === 'playful') {
    p.vr *= 1.6;
    p.vy *= 1.25;
  }
  if (mood === 'warm') {
    p.vy *= 0.75;
    p.life *= 1.2;
  }
  o.parts.push(p);
  if (o.parts.length > 46) o.parts.shift();
}
function edgePoint(o, kind) {
  const R = Math.random,
    band = 8 + R() * 18,
    W = o.w,
    H = o.h;
  if (kind === 'flake' || kind === 'petal' || kind === 'confetti') {
    const side = R();
    if (side < 0.4) return [R() * W, band];
    return [side < 0.7 ? band : W - band, R() * H * 0.6];
  }
  if (kind === 'heart' || kind === 'flower') {
    const side = R() < 0.5;
    return [side ? band : W - band, H * 0.35 + R() * H * 0.6];
  }
  const t = R() * (2 * W + 2 * H);
  if (t < W) return [t, band];
  if (t < W + H) return [W - band, t - W];
  if (t < 2 * W + H) return [t - W - H, H - band];
  return [band, t - 2 * W - H];
}
function emitEdge(o, n = 1) {
  if (!o.on || calm()) return;
  const kinds = fxKinds();
  for (let i = 0; i < n; i++) {
    const k =
      mood === 'playful' && Math.random() < 0.35
        ? 'confetti'
        : kinds[Math.floor(Math.random() * kinds.length)];
    const [x, y] = edgePoint(o, k);
    spawn(o, k, x, y);
  }
}
function drawPart(ctx, p) {
  const life = p.age / p.life,
    fade = life < 0.2 ? life / 0.2 : life > 0.7 ? (1 - life) / 0.3 : 1;
  let sc = 1;
  if (p.kind === 'twinkle' || p.kind === 'star' || p.kind === 'dot')
    sc = Math.sin(Math.min(1, life) * Math.PI);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.globalAlpha = Math.max(0, fade) * (p.kind === 'dot' ? 0.9 : 0.95);
  ctx.fillStyle = p.col;
  ctx.strokeStyle = p.col;
  if (celestial) {
    ctx.shadowBlur = 8;
    ctx.shadowColor = p.col;
  }
  const r = p.r * sc;
  if (p.kind === 'twinkle' || p.kind === 'star') {
    ctx.beginPath();
    const k = r * 0.18;
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(k, -k, r, 0);
    ctx.quadraticCurveTo(k, k, 0, r);
    ctx.quadraticCurveTo(-k, k, -r, 0);
    ctx.quadraticCurveTo(-k, -k, 0, -r);
    ctx.fill();
    if (p.kind === 'twinkle') {
      ctx.globalAlpha *= 0.6;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.28, 0, 6.28);
      ctx.fillStyle = '#fff8e0';
      ctx.fill();
    }
  } else if (p.kind === 'dot') {
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0.4, r), 0, 6.28);
    ctx.fill();
  } else if (p.kind === 'flower') {
    for (let i = 0; i < 5; i++) {
      const a = i * 1.2566;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.48, r * 0.34, a, 0, 6.28);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.3, 0, 6.28);
    ctx.fillStyle = '#f4d27a';
    ctx.fill();
  } else if (p.kind === 'heart') {
    const h = r * 1.1;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.35);
    ctx.bezierCurveTo(-h * 1.1, -h * 0.3, -h * 0.45, -h * 1.05, 0, -h * 0.45);
    ctx.bezierCurveTo(h * 0.45, -h * 1.05, h * 1.1, -h * 0.3, 0, h * 0.35);
    ctx.fill();
  } else if (p.kind === 'petal') {
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 1.1, r * 0.5, 0, 0, 6.28);
    ctx.fill();
  } else if (p.kind === 'flake') {
    ctx.lineWidth = 1.1;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      ctx.rotate(1.0472);
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.lineTo(r, 0);
      ctx.moveTo(r * 0.55, 0);
      ctx.lineTo(r * 0.8, -r * 0.25);
      ctx.moveTo(r * 0.55, 0);
      ctx.lineTo(r * 0.8, r * 0.25);
      ctx.moveTo(-r * 0.55, 0);
      ctx.lineTo(-r * 0.8, -r * 0.25);
      ctx.moveTo(-r * 0.55, 0);
      ctx.lineTo(-r * 0.8, r * 0.25);
      ctx.stroke();
    }
  } else if (p.kind === 'confetti') {
    ctx.scale(1, Math.cos(p.sw));
    ctx.fillRect(-r, -r * 0.45, r * 2, r * 0.9);
  }
  ctx.restore();
}
/* move and draw every sparkle of one layer */
function fxStep(o, dt) {
  const ctx = o.cv.getContext('2d');
  ctx.setTransform(o.dpr, 0, 0, o.dpr, 0, 0);
  ctx.clearRect(0, 0, o.w, o.h);
  for (const p of o.parts) {
    p.age += dt;
    p.x += p.vx * dt + Math.sin(p.age * 2 + p.sw) * (p.kind === 'flake' || p.kind === 'petal' ? 0.35 : 0);
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    p.sw += dt * 5;
  }
  o.parts = o.parts.filter(p => p.age < p.life);
  for (const p of o.parts) drawPart(ctx, p);
}
const IDLE_RATE = { warm: 1.2, playful: 3, festive: 2.4 };

/* ================= candles: make a wish ================= */
function makeWish() {
  return { lit: 0, blown: 0, blownAt: -1 };
}
/* draws the card and, for a cake, its flames and smoke; t = seconds (for the flicker) */
function paintCard(sc, p, wish, t) {
  paint(sc.ctx, sc.els, p, null);
  if (!sc.flames) return;
  if (wish.lit > 0) drawFlames(sc.ctx, sc.flames, t, wish.lit, wish.blown);
  if (wish.blownAt >= 0) drawSmoke(sc.ctx, sc.flames, t - wish.blownAt);
}
function blowCandles(wish, t, done) {
  if (!wish.lit || wish.blownAt >= 0) return false;
  wish.blownAt = t;
  const t0 = performance.now();
  const step = () => {
    wish.blown = Math.min(1, (performance.now() - t0) / 450);
    if (wish.blown < 1) requestAnimationFrame(step);
    else {
      wish.lit = 0;
      if (done) done();
    }
  };
  requestAnimationFrame(step);
  return true;
}
