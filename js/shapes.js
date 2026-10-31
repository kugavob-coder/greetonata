/* Greetonata — the shapes.
   Every card's cake, flower, snowflake or heart is drawn from its own message: letters, words
   and sentences decide the numbers (how many petals, tiers, branches…), and the AI layer can
   tint the colours. Nothing here is random: the same message always gives the same drawing.
   A shape is a list of elements (lines, fills, dots, numerals), each with a start and end time,
   so it can be drawn little by little while the melody plays (see draw.js). */

/* ================= text → numbers ================= */
function hash(str) {
  let h1 = 0xdeadbeef,
    h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0) * 4294967296 + (h1 >>> 0);
}
function rng(seed) {
  let a = seed % 4294967296 >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function features(text) {
  const words = (text.match(/[A-Za-z']+/g) || []).map(w => w.toLowerCase());
  const letters = words.join('').replace(/'/g, '');
  const vowels = (letters.match(/[aeiouy]/g) || []).length;
  const sentences = text.split(/[.!?]+/).filter(s => /[a-z]/i.test(s)).length;
  const codes = [...letters].map(ch => ch.charCodeAt(0) - 97);
  return {
    words,
    wordLens: words.map(w => w.length),
    codes,
    vowelRatio: vowels / Math.max(1, letters.length),
    sentences,
    letterSum: codes.reduce((a, b) => a + b, 0),
    avgLen: letters.length / Math.max(1, words.length),
    h: hash(text),
  };
}
const code = (f, i) => f.codes[((i % f.codes.length) + f.codes.length) % f.codes.length];

/* ================= colour ================= */
const hsl = (c, a = 1) => `hsla(${c[0]},${c[1].toFixed(1)}%,${c[2].toFixed(1)}%,${a})`;
function tone(c) {
  let [h, s, l] = c;
  if (mood === 'warm') {
    s *= 0.72;
    l = l + (100 - l) * 0.22;
  } else if (mood === 'playful') {
    s = Math.min(100, s * 1.25);
    l = l > 85 ? l : l + (l < 50 ? 4 : 0);
  } else {
    s = Math.min(100, s * 1.05);
    l = l > 90 ? l : l * 0.84;
  }
  return [h, s, l];
}
function lineOf(c) {
  if (mood === 'festive') return celestial ? [44, 85, 74] : [38, 70, 36];
  return celestial
    ? [c[0], Math.min(70, c[1]), 78]
    : [c[0], Math.min(55, c[1] * 0.8 + 10), Math.max(24, Math.min(46, c[2] - 34))];
}
function colors(v) {
  const o = {};
  for (const k in v) o[k] = tone(v[k]);
  o.line = lineOf(o.petal || o.line);
  return o;
}

/* ================= geometry ================= */
const P = (x, y) => ({ x, y });
function bez(p0, p1, p2, p3, n) {
  const o = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      u = 1 - t;
    o.push(
      P(
        u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
        u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
      ),
    );
  }
  return o;
}
/* one petal: origin o, angle a, start r0, length L, half-width W.
   opt: k tip roundness, notch, curl, fringe, asym */
function petal(o, a, r0, L, W, opt = {}) {
  const k = opt.k ?? 0.5,
    n = opt.n ?? 20,
    asym = opt.asym || 0;
  const Wl = W * (1 + asym),
    Wr = W * (1 - asym * 0.6);
  let left,
    right,
    mid = [];
  if (opt.notch) {
    const e = r0 + L * (1 - opt.notch * 0.35);
    left = bez(P(r0, 0), P(r0 + L * 0.3, Wl), P(r0 + L * 0.9, Wl * k), P(e, Wl * 0.3), n);
    right = bez(P(r0, 0), P(r0 + L * 0.3, -Wr), P(r0 + L * 0.9, -Wr * k), P(e, -Wr * 0.3), n);
    mid = [P(r0 + L * (1 - opt.notch), 0)];
  } else {
    left = bez(P(r0, 0), P(r0 + L * 0.3, Wl), P(r0 + L * 0.85, Wl * k), P(r0 + L, 0), n);
    right = bez(P(r0, 0), P(r0 + L * 0.3, -Wr), P(r0 + L * 0.85, -Wr * k), P(r0 + L, 0), n);
  }
  let pts = left.concat(mid, right.reverse().slice(opt.notch ? 0 : 1));
  if (opt.fringe) {
    const c = P(r0 + L * 0.5, 0);
    pts = pts.map((p, i) => {
      const u = (p.x - r0) / L;
      if (u < 0.45 || i === 0 || i === pts.length - 1) return p;
      const m = i % 2 ? 1 + opt.fringe : 1 - opt.fringe * 0.4;
      return P(c.x + (p.x - c.x) * m, c.y + (p.y - c.y) * m);
    });
  }
  if (opt.curl)
    pts = pts.map(p => {
      const u = Math.max(0, (p.x - r0) / L);
      return P(p.x, p.y + opt.curl * L * u * u);
    });
  const d = P(Math.cos(a), Math.sin(a)),
    q = P(-d.y, d.x);
  return pts.map(p => P(o.x + d.x * p.x + q.x * p.y, o.y + d.y * p.x + q.y * p.y));
}
function circle(r, n = 40, cx = 0, cy = 0) {
  const o = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI;
    o.push(P(cx + r * Math.cos(a), cy + r * Math.sin(a)));
  }
  return o;
}
function hexagon(r, cx = 0, cy = 0, a0 = 0) {
  const o = [];
  for (let i = 0; i <= 6; i++) {
    const a = a0 + (i * Math.PI) / 3;
    o.push(P(cx + r * Math.cos(a), cy + r * Math.sin(a)));
  }
  return o;
}
const O = P(0, 0),
  TAU = Math.PI * 2;
const L_ = (pts, t0, t1, col, w, x = {}) => Object.assign({ k: 'line', pts, t0, t1, col, w }, x);
const F_ = (pts, t0, t1, col, x = {}) => Object.assign({ k: 'fill', pts, t0, t1, col }, x);
const D_ = (x, y, r, t0, t1, col) => ({ k: 'dot', x, y, r, t0, t1, col });
function addPetal(els, pts, t0, t1, c, stops, r0, r1, w = 1.4) {
  els.push(F_(pts, t0 + 0.06, t1 + 0.06, null, { stops, r0, r1 }));
  els.push(L_(pts, t0, t1, c.line, w));
}
const dir = a => P(Math.cos(a), Math.sin(a));
function rayLine(a, r0, r1) {
  const d = dir(a);
  return [P(d.x * r0, d.y * r0), P(d.x * r1, d.y * r1)];
}
function phyllo(els, N, R, size, col, t0, t1, f) {
  for (let k = 0; k < N; k++) {
    const r = R * Math.sqrt((k + 0.5) / N),
      th = k * 2.39996;
    els.push(
      D_(
        r * Math.cos(th),
        r * Math.sin(th),
        size * (0.75 + (0.5 * (code(f, k) % 5)) / 4),
        t0 + (((t1 - t0) * k) / N) * 0.8,
        t0 + (t1 - t0) * ((k / N) * 0.8 + 0.2),
        col,
      ),
    );
  }
}

/* ================= FLOWERS ================= */
const FLOWERS = [
  {
    id: 'daisy',
    name: 'Daisy',
    variants: [
      { name: 'white', inner: [48, 70, 90], petal: [40, 25, 97], center: [45, 90, 55], dark: [30, 70, 35] },
      { name: 'cream', inner: [45, 80, 80], petal: [42, 65, 90], center: [38, 90, 50], dark: [25, 70, 30] },
      { name: 'pink', inner: [340, 50, 92], petal: [338, 65, 80], center: [45, 90, 55], dark: [30, 70, 35] },
    ],
    build(f, R, c) {
      const els = [],
        n = 14 + (f.letterSum % 13),
        layers = f.sentences > 2 ? 2 : 1;
      for (let l = 0; l < layers; l++) {
        const off = (l * Math.PI) / n + R() * 0.2;
        for (let j = 0; j < n; j++) {
          const a = -Math.PI / 2 + off + (j * TAU) / n,
            L = 0.72 * (1 - l * 0.12) * (0.94 + (0.06 * (code(f, j) % 7)) / 6),
            W = L * (0.08 + 0.05 * f.vowelRatio);
          const pts = petal(O, a, 0.2, L, W, { k: 0.6 }),
            t0 = l * 0.25 + (0.4 * j) / n;
          addPetal(
            els,
            pts,
            t0,
            t0 + 0.2,
            c,
            [
              [0, hsl(c.inner)],
              [1, hsl(c.petal)],
            ],
            0.2,
            0.2 + L,
            1.1,
          );
          els.push(L_(rayLine(a, 0.24, 0.2 + L * 0.8), t0 + 0.15, t0 + 0.25, hsl(c.line, 0.35), 0.7));
        }
      }
      els.push(
        F_(circle(0.21), 0.7, 0.8, null, {
          stops: [
            [0, hsl(c.center)],
            [1, hsl(c.dark)],
          ],
          r0: 0,
          r1: 0.21,
        }),
      );
      els.push(L_(circle(0.21), 0.7, 0.8, hsl(c.line), 1.3));
      phyllo(els, 90, 0.19, 0.012, hsl(c.dark), 0.78, 1, f);
      return els;
    },
  },
  {
    id: 'cherry',
    name: 'Cherry blossom',
    variants: [
      {
        name: 'light pink',
        inner: [338, 70, 72],
        petal: [345, 70, 92],
        center: [340, 55, 45],
        stamen: [48, 90, 58],
      },
      {
        name: 'deep pink',
        inner: [330, 70, 55],
        petal: [335, 75, 78],
        center: [330, 55, 35],
        stamen: [48, 90, 60],
      },
      {
        name: 'white',
        inner: [345, 55, 85],
        petal: [350, 30, 97],
        center: [345, 45, 55],
        stamen: [45, 85, 55],
      },
    ],
    build(f, R, c) {
      const els = [],
        off = R() * TAU;
      for (let j = 0; j < 5; j++) {
        const a = off + (j * TAU) / 5,
          L = 0.84,
          W = L * (0.44 + 0.07 * R());
        const pts = petal(O, a, 0.03, L, W, {
            k: 0.75,
            notch: 0.1 + (0.05 * (f.wordLens[j % f.wordLens.length] % 3)) / 2,
            n: 24,
          }),
          t0 = (0.45 * j) / 5;
        addPetal(
          els,
          pts,
          t0,
          t0 + 0.28,
          c,
          [
            [0, hsl(c.inner)],
            [0.55, hsl(c.petal)],
            [1, hsl(c.petal)],
          ],
          0.03,
          0.87,
          1.5,
        );
        for (const s of [-0.18, 0, 0.18])
          els.push(L_(rayLine(a + s, 0.08, 0.45), t0 + 0.25, t0 + 0.35, hsl(c.inner, 0.5), 0.8));
      }
      const ns = 16 + (f.words.length % 10);
      for (let k = 0; k < ns; k++) {
        const a = (k * TAU) / ns + R() * 0.1,
          r1 = 0.2 + (0.1 * (code(f, k) % 6)) / 5,
          d = dir(a);
        els.push(L_(rayLine(a, 0.05, r1), 0.62 + (0.25 * k) / ns, 0.72 + (0.25 * k) / ns, hsl(c.center), 1));
        els.push(D_(d.x * r1, d.y * r1, 0.016, 0.7 + (0.25 * k) / ns, 0.78 + (0.25 * k) / ns, hsl(c.stamen)));
      }
      els.push(F_(circle(0.05), 0.6, 0.66, hsl(c.center)));
      return els;
    },
  },
  {
    id: 'rose',
    name: 'Rose',
    variants: [
      { name: 'red', inner: [350, 75, 30], petal: [355, 75, 50] },
      { name: 'pink', inner: [340, 60, 55], petal: [345, 65, 78] },
      { name: 'peach', inner: [18, 75, 62], petal: [25, 80, 80] },
    ],
    build(f, R, c) {
      const els = [];
      const rings = 3 + Math.floor(R() * 3) + Math.min(2, f.sentences >> 1); // 3–7 rings
      const outer = 4 + Math.floor(R() * 5); // 4–8 petals in the outer ring
      const round = 0.6 + R() * 0.4,
        wide = 0.42 + R() * 0.36,
        step = 0.3 + R() * 0.9; // petal roundness, width, how tightly the rings turn
      const ruffle = R() < 0.35 ? 0.04 + R() * 0.04 : 0; // some roses get ruffled edges
      let rot = R() * TAU;
      for (let j = 0; j < rings; j++) {
        const u = j / rings,
          Rj = 0.95 * (1 - u * 0.8),
          m = Math.max(3, outer - Math.floor((j * outer) / (rings + 1)));
        rot += step;
        const shade = 1 - j / (rings + 1),
          pc = [c.petal[0], c.petal[1], c.inner[2] + (c.petal[2] - c.inner[2]) * shade];
        for (let i = 0; i < m; i++) {
          const a = rot + (i * TAU) / m,
            L = Rj * (0.72 + (0.14 * (code(f, i + j * 7) % 4)) / 3),
            W = L * wide;
          const pts = petal(O, a, Rj * 0.16, L, W, { k: round, fringe: ruffle, n: ruffle ? 28 : 22 }),
            t0 = u * 0.75 + (0.1 * i) / m;
          addPetal(
            els,
            pts,
            t0,
            t0 + 0.16,
            c,
            [
              [0, hsl(c.inner)],
              [1, hsl(pc)],
            ],
            Rj * 0.16,
            Rj,
            1.3,
          );
        }
      }
      const turns = 2 + Math.floor(R() * 4),
        sp = [];
      for (let t = 0; t <= turns * Math.PI; t += 0.12) {
        const r = 0.01 + (0.034 * t) / turns;
        sp.push(P(r * Math.cos(t + rot), r * Math.sin(t + rot)));
      }
      els.push(F_(circle(0.16), 0.8, 0.86, hsl(c.inner, 0.6)));
      els.push(L_(sp, 0.84, 1, hsl(c.line), 1.4));
      return els;
    },
  },
  {
    id: 'lily',
    name: 'Water lily',
    variants: [
      {
        name: 'white & pink',
        inner: [45, 40, 96],
        petal: [335, 65, 76],
        center: [46, 92, 55],
        stamen: [35, 90, 50],
      },
      {
        name: 'violet',
        inner: [280, 40, 90],
        petal: [272, 50, 58],
        center: [46, 92, 58],
        stamen: [35, 90, 50],
      },
      {
        name: 'blush',
        inner: [30, 60, 94],
        petal: [350, 55, 84],
        center: [46, 92, 55],
        stamen: [30, 90, 48],
      },
    ],
    build(f, R, c) {
      const els = [],
        m = 8 + (f.letterSum % 5),
        lens = [0.92, 0.74, 0.54];
      for (let l = 0; l < 3; l++) {
        const off = (l * Math.PI) / m + R() * 0.1;
        for (let j = 0; j < m; j++) {
          const a = -Math.PI / 2 + off + (j * TAU) / m,
            L = lens[l] * (0.95 + (0.05 * (code(f, j + l * 3) % 5)) / 4),
            W = L * (0.24 + 0.05 * f.vowelRatio);
          const pts = petal(O, a, 0.04, L, W, { k: 0.08, n: 20 }),
            t0 = l * 0.24 + (0.3 * j) / m;
          addPetal(
            els,
            pts,
            t0,
            t0 + 0.2,
            c,
            [
              [0, hsl(c.inner)],
              [0.45, hsl(c.inner)],
              [1, hsl(c.petal)],
            ],
            0.04,
            0.04 + L,
            1.2,
          );
          els.push(L_(rayLine(a, 0.08, 0.04 + L * 0.85), t0 + 0.15, t0 + 0.25, hsl(c.petal, 0.45), 0.7));
        }
      }
      els.push(F_(circle(0.1), 0.76, 0.82, hsl(c.center)));
      for (let k = 0; k < 26; k++) {
        const a = (k * TAU) / 26,
          r1 = 0.15 + (0.04 * (code(f, k) % 4)) / 3,
          d = dir(a);
        els.push(L_(rayLine(a, 0.09, r1), 0.8 + (0.15 * k) / 26, 0.86 + (0.15 * k) / 26, hsl(c.stamen), 1.1));
        els.push(D_(d.x * r1, d.y * r1, 0.012, 0.84 + (0.15 * k) / 26, 0.9 + (0.15 * k) / 26, hsl(c.center)));
      }
      return els;
    },
  },
  {
    id: 'pompon',
    name: 'Pompon dahlia',
    variants: [
      { name: 'magenta', inner: [320, 60, 30], petal: [322, 72, 58] },
      { name: 'orange', inner: [15, 85, 42], petal: [28, 92, 62] },
      { name: 'burgundy', inner: [345, 60, 20], petal: [348, 62, 40] },
    ],
    build(f, R, c) {
      const els = [];
      const rings = 6 + Math.floor(R() * 5) + Math.min(2, f.words.length >> 4); // 6–12 rings
      const crowd = 18 + Math.floor(R() * 16); // petals in the outer ring
      const cup = 0.35 + R() * 0.6,
        tip = 0.5 + R() * 0.5,
        size = 0.1 + R() * 0.1; // round or pointed, small or large petals
      const twist = (R() - 0.5) * 0.5; // the rings swirl left or right
      for (let j = 0; j < rings; j++) {
        const u = j / (rings - 1),
          Rj = 0.95 - u * 0.84,
          Lj = size * (1 - u * 0.45),
          m = Math.max(6, Math.round(crowd - (j * (crowd - 6)) / rings));
        const pc = [c.petal[0], c.petal[1], c.petal[2] + (c.inner[2] - c.petal[2]) * u * 0.85];
        const off = (j * Math.PI) / m + j * twist;
        for (let i = 0; i < m; i++) {
          const a = off + (i * TAU) / m,
            d = dir(a),
            o = P(d.x * (Rj - Lj), d.y * (Rj - Lj));
          const pts = petal(o, a, 0, Lj, Lj * cup, { k: tip, n: 12 }),
            t0 = u * 0.75 + (0.12 * i) / m;
          els.push(F_(pts, t0 + 0.04, t0 + 0.12, hsl(pc)));
          els.push(L_(pts, t0, t0 + 0.1, hsl(c.line, 0.85), 1));
        }
      }
      els.push(F_(circle(0.06), 0.9, 0.95, hsl(c.inner)));
      return els;
    },
  },
  {
    id: 'mum',
    name: 'Chrysanthemum',
    variants: [
      { name: 'yellow', inner: [40, 85, 50], petal: [48, 92, 66] },
      { name: 'bronze', inner: [18, 70, 32], petal: [28, 70, 55] },
      { name: 'lilac', inner: [290, 40, 55], petal: [285, 48, 78] },
    ],
    build(f, R, c) {
      const els = [],
        lens = [0.93, 0.78, 0.62, 0.45],
        sign = f.letterSum % 2 ? 1 : -1;
      for (let l = 0; l < 4; l++) {
        const m = 22 + ((f.letterSum + l * 3) % 10),
          off = (l * Math.PI) / m + R() * 0.3,
          curl = sign * (l % 2 ? -0.12 : 0.14);
        for (let j = 0; j < m; j++) {
          const a = off + (j * TAU) / m,
            L = lens[l] * (0.9 + (0.1 * (code(f, j * 2 + l) % 5)) / 4),
            W = L * 0.075;
          const pts = petal(O, a, 0.06, L, W, { k: 0.05, curl, n: 14 }),
            t0 = l * 0.2 + (0.25 * j) / m;
          addPetal(
            els,
            pts,
            t0,
            t0 + 0.14,
            c,
            [
              [0, hsl(c.inner)],
              [1, hsl(c.petal)],
            ],
            0.06,
            0.06 + L,
            0.9,
          );
        }
      }
      els.push(F_(circle(0.08), 0.88, 0.94, hsl(c.inner)));
      phyllo(els, 24, 0.07, 0.01, hsl(c.petal), 0.9, 1, f);
      return els;
    },
  },
  {
    id: 'plumeria',
    name: 'Plumeria',
    variants: [
      { name: 'white', inner: [46, 95, 60], petal: [45, 35, 97] },
      { name: 'coral', inner: [44, 95, 62], petal: [8, 78, 72] },
      { name: 'pink', inner: [46, 90, 64], petal: [335, 65, 82] },
    ],
    build(f, R, c) {
      const els = [],
        off = R() * TAU;
      const L0 = 0.72 + R() * 0.24,
        wide = 0.32 + R() * 0.3,
        k = 0.6 + R() * 0.4; // petal length, width, how round the tip is
      const curl = (R() - 0.5) * 0.5,
        asym = R() * 0.45; // straight or twisted like a propeller
      const glow = 0.2 + R() * 0.35,
        edge = R() < 0.4; // size of the golden heart; some get coloured edges
      for (let j = 0; j < 5; j++) {
        const a = off + (j * TAU) / 5,
          L = L0 * (0.93 + (0.07 * (code(f, j * 3) % 4)) / 3),
          W = L * wide;
        const pts = petal(O, a, 0, L, W, { k, asym: asym * Math.sign(curl || 1), curl, n: 24 }),
          t0 = (0.5 * j) / 5;
        const stops = [
          [0, hsl(c.inner)],
          [glow, hsl(c.inner, 0.9)],
          [Math.min(0.95, glow + 0.3), hsl(c.petal)],
          [1, edge ? hsl(c.inner, 0.75) : hsl(c.petal)],
        ];
        addPetal(els, pts, t0, t0 + 0.3, c, stops, 0, L, 1.4);
        const sg = Math.sign(curl || 1),
          crease = bez(P(0, 0), P(0.15, 0.02 * sg), P(0.4, 0.06 * sg), P(L * 0.7, 0.1 * sg), 12).map(p => {
            const d = dir(a),
              q = P(-d.y, d.x);
            return P(d.x * p.x + q.x * p.y, d.y * p.x + q.y * p.y);
          });
        els.push(L_(crease, t0 + 0.25, t0 + 0.38, hsl(c.inner, 0.6), 0.9));
      }
      els.push(F_(circle(0.04), 0.8, 0.86, hsl(c.inner)));
      return els;
    },
  },
  {
    id: 'anemone',
    name: 'Anemone',
    variants: [
      {
        name: 'red',
        inner: [355, 70, 40],
        petal: [358, 82, 52],
        center: [240, 25, 14],
        stamen: [240, 25, 18],
      },
      {
        name: 'purple',
        inner: [275, 50, 35],
        petal: [278, 55, 52],
        center: [240, 25, 14],
        stamen: [240, 25, 18],
      },
      {
        name: 'blue',
        inner: [228, 55, 45],
        petal: [225, 62, 62],
        center: [240, 30, 14],
        stamen: [240, 25, 18],
      },
    ],
    build(f, R, c) {
      const els = [],
        n = 5 + (f.letterSum % 2),
        off = R() * TAU;
      for (let j = 0; j < n; j++) {
        const a = off + (j * TAU) / n,
          L = 0.84,
          W = L * 0.6;
        const pts = petal(O, a, 0.06, L, W, { k: 0.95, n: 24 }),
          t0 = (0.45 * j) / n;
        addPetal(
          els,
          pts,
          t0,
          t0 + 0.25,
          c,
          [
            [0, hsl(c.inner)],
            [0.35, hsl(c.petal)],
            [1, hsl(c.petal)],
          ],
          0.06,
          0.9,
          1.4,
        );
        for (let v = -2; v <= 2; v++)
          els.push(
            L_(
              rayLine(a + v * 0.09, 0.16, 0.62 - Math.abs(v) * 0.05),
              t0 + 0.22,
              t0 + 0.32,
              hsl(c.inner, 0.45),
              0.7,
            ),
          );
      }
      els.push(F_(circle(0.14), 0.62, 0.7, hsl(c.center)));
      const ns = 40 + (f.words.length % 15);
      for (let k = 0; k < ns; k++) {
        const a = (k * TAU) / ns + R() * 0.05,
          r1 = 0.19 + (0.08 * (code(f, k * 3) % 6)) / 5,
          d = dir(a);
        els.push(
          L_(rayLine(a, 0.13, r1), 0.68 + (0.25 * k) / ns, 0.76 + (0.25 * k) / ns, hsl(c.stamen), 0.9),
        );
        els.push(D_(d.x * r1, d.y * r1, 0.012, 0.72 + (0.25 * k) / ns, 0.8 + (0.25 * k) / ns, hsl(c.stamen)));
      }
      els.push(F_(circle(0.06), 0.9, 0.96, hsl(c.inner, 0.8)));
      return els;
    },
  },
  {
    id: 'carnation',
    name: 'Carnation',
    variants: [
      { name: 'pink', inner: [340, 55, 62], petal: [340, 70, 78], tip: [338, 75, 70] },
      { name: 'red', inner: [352, 70, 32], petal: [355, 75, 48], tip: [355, 78, 44] },
      { name: 'white & red', inner: [0, 0, 90], petal: [0, 0, 97], tip: [355, 78, 50] },
    ],
    build(f, R, c) {
      const els = [],
        m = 9 + (f.letterSum % 4),
        lens = [0.92, 0.72, 0.5];
      for (let l = 0; l < 3; l++) {
        const off = (l * Math.PI) / m + R() * 0.2;
        for (let j = 0; j < m; j++) {
          const a = off + (j * TAU) / m,
            L = lens[l] * (0.94 + (0.06 * (code(f, j + l) % 5)) / 4),
            W = L * 0.55;
          const pts = petal(O, a, 0.03, L, W, { k: 0.95, fringe: 0.11, n: 30 }),
            t0 = l * 0.27 + (0.3 * j) / m;
          addPetal(
            els,
            pts,
            t0,
            t0 + 0.2,
            c,
            [
              [0, hsl(c.inner)],
              [0.6, hsl(c.petal)],
              [1, hsl(c.tip)],
            ],
            0.03,
            0.03 + L,
            1.1,
          );
        }
      }
      els.push(F_(circle(0.07), 0.92, 0.98, hsl(c.inner)));
      return els;
    },
  },
];

/* ================= SNOWFLAKES ================= */
const SNOW_COLORS = [
  { name: 'ice blue', line: [205, 60, 40], fill: [200, 65, 90], accent: [210, 12, 62] },
  { name: 'blue & lilac', line: [248, 40, 46], fill: [255, 55, 91], accent: [285, 40, 60] },
  { name: 'gold', line: [38, 72, 36], fill: [46, 80, 88], accent: [45, 90, 52] },
  { name: 'red & gold', line: [355, 62, 40], fill: [44, 80, 90], accent: [42, 85, 48] },
];
function snowCol(v) {
  const t = c => tone(c);
  const o = { line: t(v.line), fill: t(v.fill), accent: t(v.accent) };
  if (celestial) {
    o.line = [o.line[0], Math.min(70, o.line[1] + 10), 80];
    o.fill = [o.fill[0], o.fill[1], 38];
    o.accent = [o.accent[0], o.accent[1], 72];
  }
  if (mood === 'festive') o.accent = celestial ? [44, 85, 72] : [40, 80, 45];
  return o;
}
function sixfold(fn) {
  for (let i = 0; i < 6; i++) fn(-Math.PI / 2 + (i * Math.PI) / 3, i);
}
const SNOWS = [
  {
    id: 'stellarPlate',
    name: 'Stellar plate',
    build(f, R, c) {
      const els = [],
        w = 0.055 + 0.04 * f.vowelRatio;
      els.push(F_(hexagon(0.15, 0, 0, Math.PI / 6), 0, 0.1, hsl(c.fill)));
      els.push(L_(hexagon(0.15, 0, 0, Math.PI / 6), 0, 0.12, hsl(c.line), 1.6));
      sixfold(a => {
        const loc = [
          [0.12, w],
          [0.6, w],
          [0.72, w * 1.7],
          [0.88, w * 1.1],
          [0.94, 0],
          [0.88, -w * 1.1],
          [0.72, -w * 1.7],
          [0.6, -w],
          [0.12, -w],
        ];
        const d = dir(a),
          q = P(-d.y, d.x),
          pts = loc.map(([s, t]) => P(d.x * s + q.x * t, d.y * s + q.y * t));
        pts.push(pts[0]);
        els.push(F_(pts, 0.15, 0.5, hsl(c.fill)));
        els.push(L_(pts, 0.1, 0.55, hsl(c.line), 1.5));
        els.push(L_(rayLine(a, 0.15, 0.9), 0.3, 0.6, hsl(c.line, 0.7), 1));
        const K = 2 + (f.sentences % 3);
        for (let k = 0; k < K; k++) {
          const s = 0.25 + (0.38 * (k + 0.5)) / K;
          els.push(
            L_(
              [
                P(d.x * s + q.x * w * 0.75, d.y * s + q.y * w * 0.75),
                P(d.x * s - q.x * w * 0.75, d.y * s - q.y * w * 0.75),
              ],
              0.5 + 0.06 * k,
              0.58 + 0.06 * k,
              hsl(c.line, 0.7),
              0.9,
            ),
          );
        }
        els.push(D_(d.x * 0.78, d.y * 0.78, 0.018, 0.8, 0.9, hsl(c.accent)));
      });
      els.push(L_(hexagon(0.08, 0, 0, Math.PI / 6), 0.6, 0.7, hsl(c.line), 1.1));
      return els;
    },
  },
  {
    id: 'sectored',
    name: 'Sectored plate',
    build(f, R, c) {
      const els = [],
        Rm = 0.9,
        K = 3 + (f.sentences % 3);
      const V = [],
        M = [];
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + Math.PI / 6 + (i * Math.PI) / 3;
        V.push(P(Rm * Math.cos(a), Rm * Math.sin(a)));
      }
      for (let i = 0; i < 6; i++) {
        const a = V[i],
          b = V[(i + 1) % 6],
          dent = 0.9 - (0.05 * (code(f, i) % 3)) / 2;
        M.push(P(((a.x + b.x) / 2) * dent, ((a.y + b.y) / 2) * dent));
      }
      const alt = [c.fill[0], c.fill[1], celestial ? c.fill[2] + 9 : c.fill[2] - 9];
      // twelve facets, alternately shaded like a cut gem
      for (let i = 0; i < 6; i++) {
        els.push(F_([O, V[i], M[i], O], 0.02 + 0.04 * i, 0.12 + 0.04 * i, hsl(c.fill)));
        els.push(F_([O, M[i], V[(i + 1) % 6], O], 0.04 + 0.04 * i, 0.14 + 0.04 * i, hsl(alt)));
      }
      const outline = [];
      for (let i = 0; i < 6; i++) outline.push(V[i], M[i]);
      outline.push(V[0]);
      els.push(L_(outline, 0, 0.35, hsl(c.line), 1.8));
      // ridges to the corners, with frost feathers along them
      for (let i = 0; i < 6; i++) {
        const v = V[i],
          a = Math.atan2(v.y, v.x);
        els.push(L_([O, v], 0.3, 0.55, hsl(c.line), 1.5));
        for (let k = 1; k <= K; k++) {
          const t = k / (K + 1),
            o = P(v.x * t, v.y * t),
            len = 0.16 * (1 - t * 0.6) * (0.8 + (0.2 * (code(f, k + i * 3) % 4)) / 3);
          for (const sg of [-1, 1]) {
            const d = dir(a + (sg * Math.PI * 5) / 6);
            els.push(
              L_(
                [o, P(o.x + d.x * len, o.y + d.y * len)],
                0.5 + 0.06 * k,
                0.58 + 0.06 * k,
                hsl(c.line, 0.65),
                0.9,
              ),
            );
          }
        }
        // tiny spike + bead at each corner
        const d = dir(a);
        els.push(L_([v, P(v.x + d.x * 0.06, v.y + d.y * 0.06)], 0.85, 0.9, hsl(c.line), 1.3));
        els.push(D_(v.x + d.x * 0.07, v.y + d.y * 0.07, 0.018, 0.88, 0.96, hsl(c.accent)));
      }
      els.push(F_(hexagon(0.1, 0, 0, Math.PI / 6), 0.75, 0.82, hsl(c.fill)));
      els.push(L_(hexagon(0.1, 0, 0, Math.PI / 6), 0.75, 0.85, hsl(c.line), 1.3));
      els.push(D_(0, 0, 0.025, 0.85, 0.95, hsl(c.accent)));
      return els;
    },
  },
  {
    id: 'dendrite',
    name: 'Stellar dendrite',
    build(f, R, c) {
      const els = [],
        Rm = 0.94,
        K = Math.min(6, Math.max(3, f.wordLens.length >> 2)),
        maxL = Math.max(...f.wordLens);
      const br = [];
      for (let k = 0; k < K; k++) {
        const wl = f.wordLens[(k * 3 + 1) % f.wordLens.length],
          t = 0.28 + (0.58 * (k + 0.3 + R() * 0.4)) / K;
        br.push({ t, len: Rm * (0.1 + (0.26 * wl) / maxL) * (1 - t * 0.55), sub: code(f, k * 5) % 3 === 0 });
      }
      els.push(F_(hexagon(0.13, 0, 0, Math.PI / 6), 0, 0.1, hsl(c.fill)));
      els.push(L_(hexagon(0.13, 0, 0, Math.PI / 6), 0, 0.12, hsl(c.line), 1.6));
      sixfold(a => {
        const d = dir(a),
          at = s => 0.12 + (0.68 * s) / Rm;
        els.push(L_(rayLine(a, 0.07, Rm), 0.12, 0.8, hsl(c.line), 1.9));
        for (const b of br) {
          const s = b.t * Rm,
            o = P(d.x * s, d.y * s);
          for (const sg of [-1, 1]) {
            const bd = dir(a + (sg * Math.PI) / 3),
              e = P(o.x + bd.x * b.len, o.y + bd.y * b.len);
            els.push(L_([o, e], at(s), at(s) + 0.12, hsl(c.line), 1.4));
            if (b.sub) {
              const m = P(o.x + bd.x * b.len * 0.55, o.y + bd.y * b.len * 0.55);
              for (const s2 of [-1, 1]) {
                const sd = dir(a + (sg * Math.PI) / 3 + (s2 * Math.PI) / 3);
                els.push(
                  L_(
                    [m, P(m.x + sd.x * b.len * 0.3, m.y + sd.y * b.len * 0.3)],
                    at(s) + 0.1,
                    at(s) + 0.17,
                    hsl(c.line),
                    1,
                  ),
                );
              }
            }
            els.push(D_(e.x, e.y, 0.012, at(s) + 0.11, at(s) + 0.15, hsl(c.accent)));
          }
        }
        els.push(D_(d.x * Rm, d.y * Rm, 0.022, 0.8, 0.92, hsl(c.accent)));
      });
      return els;
    },
  },
  {
    id: 'fern',
    name: 'Fernlike dendrite',
    build(f, R, c) {
      const els = [],
        Rm = 0.95;
      els.push(F_(hexagon(0.08, 0, 0, Math.PI / 6), 0, 0.08, hsl(c.fill)));
      els.push(L_(hexagon(0.08, 0, 0, Math.PI / 6), 0, 0.1, hsl(c.line), 1.3));
      sixfold((a, i) => {
        const d = dir(a),
          at = s => 0.08 + (0.75 * s) / Rm;
        els.push(L_(rayLine(a, 0.05, Rm), 0.08, 0.83, hsl(c.line), 1.6));
        let k = 0;
        for (let s = 0.16; s < Rm - 0.03; s += 0.034, k++) {
          const o = P(d.x * s, d.y * s),
            len = (0.15 * (1 - s / Rm) + 0.025) * (0.7 + (0.3 * (code(f, k + i * 7) % 5)) / 4);
          for (const sg of [-1, 1]) {
            const bd = dir(a + (sg * Math.PI) / 3),
              e = P(o.x + bd.x * len, o.y + bd.y * len);
            els.push(L_([o, e], at(s), at(s) + 0.08, hsl(c.line), 0.9));
            if (len > 0.09) {
              const m = P(o.x + bd.x * len * 0.5, o.y + bd.y * len * 0.5),
                sd = dir(a + (sg * Math.PI) / 3 - (sg * Math.PI) / 3);
              els.push(
                L_(
                  [m, P(m.x + sd.x * len * 0.28, m.y + sd.y * len * 0.28)],
                  at(s) + 0.06,
                  at(s) + 0.11,
                  hsl(c.line),
                  0.7,
                ),
              );
            }
          }
        }
        els.push(D_(d.x * Rm, d.y * Rm, 0.016, 0.85, 0.95, hsl(c.accent)));
      });
      return els;
    },
  },
  {
    id: 'twelve',
    name: '12-sided',
    build(f, R, c) {
      const els = [];
      els.push(F_(circle(0.12, 12), 0, 0.1, hsl(c.fill)));
      els.push(L_(circle(0.12, 12), 0, 0.12, hsl(c.line), 1.4));
      for (let i = 0; i < 12; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 6,
          Rm = i % 2 ? 0.68 : 0.94,
          d = dir(a),
          t0 = (i % 2) * 0.15;
        els.push(L_(rayLine(a, 0.12, Rm), 0.1 + t0, 0.65 + t0, hsl(c.line), i % 2 ? 1.3 : 1.7));
        const K = i % 2 ? 2 : 3;
        for (let k = 0; k < K; k++) {
          const s = Rm * (0.4 + (0.45 * (k + 0.5)) / K),
            len = (0.06 + (0.06 * (code(f, k + i) % 4)) / 3) * (1 - s * 0.4),
            o = P(d.x * s, d.y * s);
          for (const sg of [-1, 1]) {
            const bd = dir(a + (sg * Math.PI) / 3);
            els.push(
              L_(
                [o, P(o.x + bd.x * len, o.y + bd.y * len)],
                0.3 + t0 + 0.3 * s,
                0.4 + t0 + 0.3 * s,
                hsl(c.line),
                1,
              ),
            );
          }
        }
        els.push(D_(d.x * Rm, d.y * Rm, i % 2 ? 0.014 : 0.02, 0.85, 0.95, hsl(c.accent)));
      }
      return els;
    },
  },
  {
    id: 'split',
    name: 'Split star',
    build(f, R, c) {
      const els = [],
        tipR = 0.06 + 0.03 * f.vowelRatio;
      els.push(F_(hexagon(0.2, 0, 0, Math.PI / 6), 0, 0.15, hsl(c.fill)));
      els.push(L_(hexagon(0.2, 0, 0, Math.PI / 6), 0, 0.18, hsl(c.line), 1.6));
      els.push(L_(hexagon(0.11, 0, 0, Math.PI / 6), 0.1, 0.22, hsl(c.line), 1.1));
      sixfold(a => {
        const d = dir(a);
        els.push(L_(rayLine(a, 0.0, 0.2), 0.15, 0.25, hsl(c.line, 0.6), 0.9));
        els.push(L_(rayLine(a, 0.2, 0.86 - tipR), 0.25, 0.65, hsl(c.line), 1.7));
        const mid = 0.5;
        els.push(F_(hexagon(0.035, d.x * mid, d.y * mid, a), 0.45, 0.55, hsl(c.fill)));
        els.push(L_(hexagon(0.035, d.x * mid, d.y * mid, a), 0.45, 0.55, hsl(c.line), 1));
        const tp = P(d.x * 0.88, d.y * 0.88);
        els.push(F_(hexagon(tipR, tp.x, tp.y, a), 0.65, 0.8, hsl(c.fill)));
        els.push(L_(hexagon(tipR, tp.x, tp.y, a), 0.65, 0.8, hsl(c.line), 1.4));
        els.push(D_(tp.x, tp.y, 0.014, 0.85, 0.95, hsl(c.accent)));
        for (const sg of [-1, 1]) {
          const s = 0.72,
            o = P(d.x * s, d.y * s),
            bd = dir(a + (sg * Math.PI) / 3);
          els.push(L_([o, P(o.x + bd.x * 0.07, o.y + bd.y * 0.07)], 0.6, 0.68, hsl(c.line), 1.1));
        }
      });
      return els;
    },
  },
  {
    id: 'hexplate',
    name: 'Hexagonal plate',
    build(f, R, c) {
      const els = [],
        K = 3 + (f.sentences % 4);
      els.push(F_(hexagon(0.9, 0, 0, Math.PI / 6), 0, 0.2, hsl(c.fill)));
      for (let k = K; k >= 1; k--) {
        const r = (0.9 * k) / K;
        els.push(
          L_(
            hexagon(r, 0, 0, Math.PI / 6),
            0.05 + (K - k) * 0.1,
            0.15 + (K - k) * 0.1,
            hsl(c.line),
            k === K ? 1.8 : 1,
          ),
        );
      }
      sixfold(a => {
        const pts = petal(O, a, 0.03, 0.32, 0.08, { k: 0.4, n: 12 });
        els.push(F_(pts, 0.6, 0.7, hsl(c.accent, 0.35)));
        els.push(L_(pts, 0.55, 0.7, hsl(c.line), 1));
        const v = dir(a);
        for (let k = 1; k <= K; k++) {
          const r = (0.9 * k) / K;
          els.push(D_(v.x * r, v.y * r, 0.013, 0.75 + 0.04 * k, 0.82 + 0.04 * k, hsl(c.accent)));
        }
      });
      els.push(F_(circle(0.04), 0.8, 0.88, hsl(c.accent)));
      return els;
    },
  },
];

/* ================= HEART (Thank you) ================= */
const HEART_COLORS = [
  {
    name: 'amber',
    outline: [25, 70, 48],
    vine: [95, 32, 38],
    leaf: [95, 38, 64],
    bloom: [28, 85, 66],
    bloomIn: [45, 90, 76],
  },
  {
    name: 'rose',
    outline: [345, 55, 48],
    vine: [120, 25, 36],
    leaf: [110, 30, 62],
    bloom: [345, 70, 74],
    bloomIn: [45, 85, 76],
  },
  {
    name: 'golden',
    outline: [38, 70, 40],
    vine: [85, 32, 36],
    leaf: [80, 40, 62],
    bloom: [45, 90, 62],
    bloomIn: [40, 95, 82],
  },
];
function heartCol(v) {
  const o = {};
  for (const k in v) if (k !== 'name') o[k] = tone(v[k]);
  if (celestial) {
    o.outline = [o.outline[0], 70, 74];
    o.vine = [o.vine[0], 40, 70];
    o.leaf = [o.leaf[0], 35, 45];
  }
  if (mood === 'festive') o.outline = celestial ? [44, 85, 72] : [38, 70, 38];
  return o;
}
function heartPoly() {
  const raw = [];
  for (let i = 0; i <= 240; i++) {
    const t = (i / 240) * TAU;
    raw.push(
      P(
        16 * Math.sin(t) ** 3,
        -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)),
      ),
    );
  }
  let a = 1e9,
    b = -1e9,
    c = 1e9,
    d = -1e9;
  for (const p of raw) {
    a = Math.min(a, p.x);
    b = Math.max(b, p.x);
    c = Math.min(c, p.y);
    d = Math.max(d, p.y);
  }
  const s = 1.86 / Math.max(b - a, d - c),
    cy = (c + d) / 2;
  return raw.map(p => P(p.x * s, (p.y - cy) * s));
}
function inside(p, poly) {
  let r = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) r = !r;
  }
  return r;
}
function blossom(els, cx, cy, r, a0, t0, c) {
  for (let i = 0; i < 5; i++) {
    const pts = petal(P(cx, cy), a0 + (i * TAU) / 5, r * 0.15, r, r * 0.45, { k: 0.55, n: 12 });
    els.push(F_(pts, t0, t0 + 0.08, hsl(c.bloom)));
    els.push(L_(pts, t0, t0 + 0.08, hsl(c.outline), 1.1));
  }
  els.push(D_(cx, cy, r * 0.28, t0 + 0.05, t0 + 0.1, hsl(c.bloomIn)));
}
function buildHeart(f, R, c) {
  const els = [],
    H = heartPoly(),
    inner = H.map(p => P(p.x * 0.86, p.y * 0.86 + 0.03));
  els.push(L_(H, 0, 0.3, hsl(c.outline), 2.4));
  els.push(
    L_(
      H.map(p => P(p.x * 0.93, p.y * 0.93 + 0.015)),
      0.08,
      0.36,
      hsl(c.outline, 0.6),
      1,
      { dash: true },
    ),
  );
  const S = P(0, 0.32),
    V = Math.min(4, 1 + f.sentences),
    half = [];
  for (let v = 0; v < V; v++) {
    const wl = f.wordLens[(v * 5 + 2) % f.wordLens.length];
    let a = -Math.PI / 2 - 0.18 - v * (1.25 / Math.max(1, V - 1)),
      cv = (wl % 2 ? 1 : -1) * (0.022 + 0.03 * R());
    const pts = [S];
    let p = S;
    for (let i = 0; i < 80; i++) {
      a += cv * (1 + i * 0.025);
      const q = P(p.x + Math.cos(a) * 0.03, p.y + Math.sin(a) * 0.03);
      if (!inside(q, inner)) break;
      pts.push(q);
      p = q;
    }
    if (pts.length < 4) continue;
    const leaves = [];
    for (let i = 3; i < pts.length - 2; i += 3) {
      const cd = code(f, v * 11 + i),
        side = (i / 3) % 2 ? 1 : -1;
      leaves.push({
        o: pts[i],
        a: Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x) + side * 0.9,
        L: 0.05 + (0.035 * (cd % 6)) / 5,
        u: i / pts.length,
      });
    }
    half.push({ pts, leaves, end: pts[pts.length - 1], size: 0.04 + (0.02 * (wl % 4)) / 3 });
  }
  for (const m of [false, true])
    for (const vn of half) {
      els.push(L_(m ? vn.pts.map(q => P(-q.x, q.y)) : vn.pts, 0.32, 0.82, hsl(c.vine), 1.8));
      for (const lf of vn.leaves) {
        const o = m ? P(-lf.o.x, lf.o.y) : lf.o,
          a = m ? Math.PI - lf.a : lf.a,
          lp = petal(o, a, 0, lf.L, lf.L * 0.38, { k: 0.15, n: 10 }),
          t = 0.32 + 0.5 * lf.u;
        els.push(F_(lp, t + 0.03, t + 0.1, hsl(c.leaf)));
        els.push(L_(lp, t, t + 0.08, hsl(c.vine), 1));
      }
      const e = m ? P(-vn.end.x, vn.end.y) : vn.end;
      blossom(els, e.x, e.y, vn.size, R() * Math.PI, 0.82, c);
    }
  blossom(els, S.x, S.y, 0.07, -Math.PI / 2, 0.26, c);
  return els;
}

/* ================= BIRTHDAY CAKE ================= */
const CAKE_COLORS = [
  {
    name: 'strawberry',
    body: [345, 62, 80],
    cream: [345, 55, 93],
    accent: [350, 72, 52],
    candle: [345, 70, 60],
  },
  { name: 'vanilla', body: [40, 62, 84], cream: [42, 60, 95], accent: [12, 72, 58], candle: [200, 60, 60] },
  { name: 'chocolate', body: [22, 38, 40], cream: [32, 45, 82], accent: [350, 72, 55], candle: [45, 85, 58] },
  { name: 'mint', body: [150, 38, 78], cream: [150, 32, 93], accent: [340, 68, 62], candle: [340, 65, 62] },
  { name: 'lemon', body: [50, 82, 76], cream: [52, 70, 93], accent: [200, 62, 55], candle: [200, 60, 58] },
  { name: 'lavender', body: [268, 38, 80], cream: [270, 35, 93], accent: [45, 85, 55], candle: [45, 85, 55] },
];
function cakeCol(v) {
  const o = {};
  for (const k in v) if (k !== 'name') o[k] = tone(v[k]);
  o.line = celestial
    ? [o.body[0], 45, 80]
    : [o.body[0], Math.min(45, o.body[1]), Math.max(22, Math.min(38, o.body[2] - 40))];
  if (mood === 'festive') o.line = celestial ? [44, 85, 74] : [38, 70, 36];
  return o;
}
/* a number in the message: digits ("30", "21st") or words ("thirty", "twenty-one") */
const NUMW = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
};
function cakeNumber(text) {
  const body = text.split('\n').slice(1, -1).join(' ').toLowerCase();
  const d = body.match(/\b(\d{1,3})(?:st|nd|rd|th)?\b/);
  if (d) {
    const n = +d[1];
    if (n > 0 && n <= 120) return n;
  }
  const w = body.match(
    /\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-]+(one|two|three|four|five|six|seven|eight|nine)\b/,
  );
  if (w) return NUMW[w[1]] + NUMW[w[2]];
  const s = body.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\b(?=[\s-]*(years?|today|th|birthday|candles|!|\.|,|$))/,
  );
  if (s) return NUMW[s[1]];
  return 0;
}
function buildCake(f, R, c, text) {
  const els = [],
    flames = [];
  const tiers = 1 + Math.min(2, Math.floor(f.sentences / 2) + (R() < 0.3 ? 1 : 0));
  const styles = ['smooth', 'drip', 'scallop', 'stripes', 'dots', 'ruffle'];
  const plateY = 0.9;
  // plate
  const plate = [];
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * TAU;
    plate.push(P(0.94 * Math.cos(a), plateY + 0.11 * Math.sin(a)));
  }
  els.push(F_(plate, 0, 0.06, hsl([c.cream[0], 12, celestial ? 40 : 94])));
  els.push(L_(plate, 0, 0.08, hsl(c.line, 0.7), 1.2));
  let yB = plateY,
    w = tiers === 1 ? 1.36 : tiers === 2 ? 1.46 : 1.5;
  const tierH = tiers === 1 ? 0.66 : tiers === 2 ? 0.5 : 0.4;
  let topInfo = null;
  for (let k = 0; k < tiers; k++) {
    const h = tierH * (1 - k * 0.08),
      yT = yB - h,
      ry = w * 0.13,
      t0 = 0.06 + k * 0.2,
      t1 = t0 + 0.2;
    const style = styles[(code(f, k * 11 + 3) + k) % styles.length];
    // body (front side) and the top surface
    const body = [P(-w / 2, yT), P(-w / 2, yB)];
    for (let i = 0; i <= 24; i++) {
      const a = Math.PI - (i / 24) * Math.PI;
      body.push(P((w / 2) * Math.cos(a), yB + ry * Math.sin(a)));
    }
    body.push(P(w / 2, yT));
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI;
      body.push(P((w / 2) * Math.cos(a), yT + ry * Math.sin(a)));
    }
    els.push(
      F_(body, t0 + 0.03, t1, null, {
        lin: [yT, yB],
        stops: [
          [0, hsl([c.body[0], c.body[1], Math.min(97, c.body[2] + 6)])],
          [1, hsl([c.body[0], c.body[1], c.body[2] - 8])],
        ],
      }),
    );
    els.push(L_(body, t0, t1, hsl(c.line), 1.5));
    const top = [];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * TAU;
      top.push(P((w / 2) * Math.cos(a), yT + ry * Math.sin(a)));
    }
    els.push(F_(top, t1 - 0.04, t1 + 0.02, hsl(c.cream)));
    els.push(L_(top, t1 - 0.06, t1 + 0.02, hsl(c.line), 1.2));
    const front = x => yT + ry * Math.sqrt(Math.max(0, 1 - ((2 * x) / w) ** 2)); // y of the top front edge
    const frontB = x => yB + ry * Math.sqrt(Math.max(0, 1 - ((2 * x) / w) ** 2));
    const d0 = t1,
      d1 = t1 + 0.12;
    if (style === 'drip') {
      const n = 6 + (code(f, k * 5) % 5),
        band = [];
      for (let i = 0; i <= 60; i++) {
        const x = -w / 2 + (i / 60) * w;
        band.push(P(x, front(x)));
      }
      const low = [];
      for (let i = 60; i >= 0; i--) {
        const x = -w / 2 + (i / 60) * w;
        let dy = 0.035;
        for (let j = 0; j < n; j++) {
          const xj = -w / 2 + ((j + 0.5) / n) * w,
            L = ((0.06 + 0.12 * ((code(f, j * 7 + k) % 5) / 4)) * h) / 0.4;
          dy += L * Math.exp(-(((x - xj) / (w * 0.035)) ** 2));
        }
        low.push(P(x, front(x) + dy));
      }
      const pts = band.concat(low);
      els.push(F_(pts, d0, d1, hsl(c.cream)));
      els.push(L_(low, d0, d1, hsl(c.line, 0.8), 1.1));
    } else if (style === 'scallop') {
      const n = 9 + (code(f, k * 3) % 5);
      for (let j = 0; j < n; j++) {
        const xa = -w / 2 + (j / n) * w,
          xb = xa + w / n,
          arc = [];
        for (let i = 0; i <= 10; i++) {
          const x = xa + ((xb - xa) * i) / 10;
          arc.push(P(x, frontB(x) - 0.05 * Math.sin((i / 10) * Math.PI)));
        }
        els.push(L_(arc, d0 + (j / n) * 0.1, d0 + (j / n) * 0.1 + 0.05, hsl(c.cream), 2.6));
        els.push(L_(arc, d0 + (j / n) * 0.1, d0 + (j / n) * 0.1 + 0.05, hsl(c.line, 0.6), 0.8));
        const xm = (xa + xb) / 2;
        els.push(
          D_(xm, front(xm) + 0.012, 0.018, d0 + (j / n) * 0.1, d0 + (j / n) * 0.1 + 0.06, hsl(c.cream)),
        );
      }
    } else if (style === 'stripes') {
      const n = 7 + (code(f, k * 9) % 5);
      for (let j = 0; j < n; j++) {
        const x = -w / 2 + ((j + 0.5) / n) * w,
          dw = (w / n) * 0.18,
          q = [];
        q.push(
          P(x - dw, front(x - dw)),
          P(x - dw, frontB(x - dw)),
          P(x + dw, frontB(x + dw)),
          P(x + dw, front(x + dw)),
        );
        els.push(F_(q, d0 + (j / n) * 0.08, d0 + (j / n) * 0.08 + 0.05, hsl(c.accent, 0.55)));
      }
    } else if (style === 'dots') {
      const cols = 5 + (code(f, k) % 3),
        rows = 2;
      for (let r = 0; r < rows; r++)
        for (let j = 0; j < cols; j++) {
          const x = -w / 2 + ((j + 0.5 + (r % 2) * 0.5) / cols) * w;
          if (x > w / 2 - 0.04) continue;
          const y = front(x) + (r + 1) * (h / (rows + 1));
          els.push(
            D_(
              x,
              y,
              0.022,
              d0 + (r * cols + j) * 0.006,
              d0 + (r * cols + j) * 0.006 + 0.05,
              hsl(r % 2 ? c.cream : c.accent),
            ),
          );
        }
    } else if (style === 'ruffle') {
      for (let r = 1; r <= 2; r++) {
        const pts = [];
        for (let i = 0; i <= 60; i++) {
          const x = -w / 2 + (i / 60) * w;
          pts.push(P(x, front(x) + (r * h) / 3 + 0.018 * Math.sin(i * 1.3)));
        }
        els.push(L_(pts, d0 + r * 0.03, d1, hsl(c.cream), 3.2));
        els.push(L_(pts, d0 + r * 0.03, d1, hsl(c.line, 0.5), 0.8));
      }
    }
    topInfo = { yT, w, ry, t: d1 };
    yB = yT + ry * 0.2;
    w *= 0.72;
  }
  // decorations on the top tier
  const { yT, w: tw, ry } = topInfo,
    decoT = Math.min(0.82, topInfo.t + 0.02);
  const deco = ['berries', 'strawberries', 'flowers', 'stars', 'sprinkles'][code(f, 17) % 5];
  const spots = [];
  const nd = 5 + (code(f, 23) % 4);
  for (let j = 0; j < nd; j++) {
    const a = Math.PI * (0.12 + (0.76 * j) / (nd - 1));
    spots.push(P((-tw / 2) * 0.86 * Math.cos(a), yT + ry * 0.86 * Math.sin(a)));
  }
  spots.forEach((p, j) => {
    const t0 = decoT + j * 0.012;
    if (deco === 'berries') {
      for (const [dx, dy] of [
        [0, 0],
        [0.025, -0.015],
        [-0.022, -0.012],
      ])
        els.push(
          D_(p.x + dx, p.y + dy - 0.02, 0.022, t0, t0 + 0.05, hsl(j % 2 ? [300, 40, 38] : [350, 70, 45])),
        );
    } else if (deco === 'strawberries') {
      const s = 0.05,
        b = [];
      for (let i = 0; i <= 16; i++) {
        const a = (i / 16) * TAU;
        b.push(
          P(p.x + s * 0.8 * Math.sin(a), p.y - 0.03 - s * (0.55 * Math.cos(a) - 0.3 * Math.cos(2 * a) * 0.4)),
        );
      }
      els.push(F_(b, t0, t0 + 0.05, hsl([355, 75, 52])));
      els.push(D_(p.x, p.y - 0.075, 0.012, t0 + 0.03, t0 + 0.06, hsl([110, 45, 40])));
    } else if (deco === 'flowers') {
      for (let i = 0; i < 5; i++) {
        const a = (i * TAU) / 5;
        els.push(
          D_(
            p.x + 0.022 * Math.cos(a),
            p.y - 0.025 + 0.022 * Math.sin(a),
            0.016,
            t0,
            t0 + 0.05,
            hsl(c.accent),
          ),
        );
      }
      els.push(D_(p.x, p.y - 0.025, 0.012, t0 + 0.02, t0 + 0.06, hsl([45, 90, 62])));
    } else if (deco === 'stars') {
      const s = [];
      for (let i = 0; i <= 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5,
          r = i % 2 ? 0.016 : 0.04;
        s.push(P(p.x + r * Math.cos(a), p.y - 0.03 + r * Math.sin(a)));
      }
      els.push(F_(s, t0, t0 + 0.05, hsl([45, 90, 60])));
    } else {
      for (let i = 0; i < 4; i++) {
        const a = R() * Math.PI,
          x = p.x + (R() - 0.5) * 0.08,
          y = p.y - 0.02 + (R() - 0.5) * 0.03;
        els.push(
          L_(
            [
              P(x - 0.014 * Math.cos(a), y - 0.014 * Math.sin(a)),
              P(x + 0.014 * Math.cos(a), y + 0.014 * Math.sin(a)),
            ],
            t0,
            t0 + 0.04,
            hsl(
              [
                [350, 70, 60],
                [200, 60, 55],
                [50, 85, 55],
                [140, 45, 50],
              ][i],
            ),
            2.2,
          ),
        );
      }
    }
  });
  // candles: the number from the message, or a little group
  const num = cakeNumber(text || ''),
    cT = 0.86;
  if (num) {
    const digits = String(num).split(''),
      size = digits.length > 2 ? 0.38 : 0.54,
      gap = size * 0.62,
      x0 = (-(digits.length - 1) * gap) / 2;
    digits.forEach((dg, i) => {
      const x = x0 + i * gap,
        y = yT - size * 0.12,
        flame = { x, y: y - size * 0.76, s: 0.06 };
      // the wick and the flame are placed on the real top of the digit when it is drawn (see paint)
      els.push({
        k: 'text',
        x,
        y,
        size,
        txt: dg,
        col: hsl(c.candle),
        stroke: hsl(c.line),
        t0: cT + i * 0.03,
        t1: cT + i * 0.03 + 0.06,
        flame,
      });
      flames.push(flame);
    });
  } else {
    const n = 3 + (code(f, 31) % 5);
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.15 + (0.7 * i) / Math.max(1, n - 1)),
        x = (-tw / 2) * 0.62 * Math.cos(a),
        yb = yT + ry * 0.5 * Math.sin(a) - 0.01,
        hgt = 0.26 + 0.05 * (i % 2),
        cw = 0.026;
      const body = [P(x - cw, yb), P(x - cw, yb - hgt), P(x + cw, yb - hgt), P(x + cw, yb)];
      els.push(F_(body, cT + i * 0.012, cT + i * 0.012 + 0.04, hsl(celestial ? [0, 0, 85] : [0, 0, 99])));
      for (let s = 0; s < 4; s++) {
        const y1 = yb - (hgt * (s + 0.2)) / 4;
        els.push(
          L_(
            [P(x - cw, y1), P(x + cw, y1 - hgt * 0.12)],
            cT + i * 0.012 + 0.02,
            cT + i * 0.012 + 0.05,
            hsl(c.candle),
            1.8,
          ),
        );
      }
      els.push(L_(body.concat([body[0]]), cT + i * 0.012, cT + i * 0.012 + 0.04, hsl(c.line, 0.6), 0.9));
      els.push(L_([P(x, yb - hgt), P(x, yb - hgt - 0.03)], cT + 0.06, cT + 0.08, hsl([30, 20, 25]), 1.2));
      flames.push({ x, y: yb - hgt - 0.03, s: 0.045 });
    }
  }
  return { els, flames };
}
/* flames that flicker; blown = how far they have gone out (0..1) */
function drawFlames(ctx, flames, time, alpha, blown) {
  if (!flames || !flames.length || alpha <= 0) return;
  const S = ctx.canvas.width,
    c = S / 2,
    u = S * 0.47;
  flames.forEach((fl, i) => {
    const x = c + fl.x * u,
      y = c + fl.y * u,
      s = fl.s * u * (1 - blown),
      fl2 = Math.sin(time * 13 + i * 2.1) * 0.12 + Math.sin(time * 7.3 + i) * 0.08;
    if (s <= 0.5) return;
    ctx.save();
    ctx.globalAlpha = alpha * (1 - blown);
    const g = ctx.createRadialGradient(x, y - s * 0.4, 0, x, y - s * 0.4, s * 2.6);
    g.addColorStop(0, 'rgba(255,214,120,.55)');
    g.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y - s * 0.4, s * 2.6, 0, TAU);
    ctx.fill();
    ctx.translate(x, y);
    ctx.rotate(fl2 * 0.25);
    ctx.scale(1, 1 + fl2);
    const gr = ctx.createLinearGradient(0, 0, 0, -s * 1.6);
    gr.addColorStop(0, '#ff8a2a');
    gr.addColorStop(0.5, '#ffc94a');
    gr.addColorStop(1, '#fff3c4');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(s * 0.7, -s * 0.2, s * 0.45, -s * 1.1, 0, -s * 1.7);
    ctx.bezierCurveTo(-s * 0.45, -s * 1.1, -s * 0.7, -s * 0.2, 0, 0);
    ctx.fill();
    ctx.restore();
  });
}
/* little curls of smoke after the candles are blown out */
function drawSmoke(ctx, flames, since) {
  if (since < 0 || since > 2.6) return;
  const S = ctx.canvas.width,
    c = S / 2,
    u = S * 0.47;
  flames.forEach((fl, i) => {
    for (let k = 0; k < 5; k++) {
      const t = since - k * 0.14;
      if (t < 0) continue;
      const x = c + fl.x * u + Math.sin(t * 3 + i + k) * u * 0.03,
        y = c + fl.y * u - t * u * 0.16,
        r = u * (0.01 + t * 0.018);
      ctx.globalAlpha = Math.max(0, 0.35 * (1 - t / 2.4));
      ctx.fillStyle = celestial ? '#c9c3d6' : '#a99b8a';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
  });
  ctx.globalAlpha = 1;
}

/* ================= HEARTS — six kinds, the message picks one ================= */
const HEART_KINDS = ['garden', 'lace', 'petals', 'hearts', 'glass', 'ribbon'];
const HEART_NAMES = {
  garden: 'Garden heart',
  lace: 'Lace heart',
  petals: 'Heart of petals',
  hearts: 'Heart of hearts',
  glass: 'Stained-glass heart',
  ribbon: 'Ribbon heart',
};
/* point on the heart outline (t 0..2π), k = scale toward the middle */
const HC = P(0, 0.04);
function heartAt(t, k = 1) {
  const x = 16 * Math.sin(t) ** 3,
    y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
  const s = 0.0575;
  return P(HC.x + x * s * k, HC.y + (y * s + 0.1) * k);
}
function heartPath(k = 1, n = 160) {
  const o = [];
  for (let i = 0; i <= n; i++) o.push(heartAt((i / n) * TAU, k));
  return o;
}
function miniHeart(cx, cy, r, rot = 0) {
  const o = [];
  for (let i = 0; i <= 24; i++) {
    const t = (i / 24) * TAU,
      x = (16 * Math.sin(t) ** 3) / 17,
      y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17;
    const ca = Math.cos(rot),
      sa = Math.sin(rot);
    o.push(P(cx + r * (x * ca - y * sa), cy + r * (x * sa + y * ca)));
  }
  return o;
}
function buildHeartKind(kind, f, R, c) {
  const els = [],
    H = heartPath(1);
  if (kind === 'garden') return buildHeart(f, R, c);
  if (kind === 'lace') {
    els.push(L_(H, 0, 0.25, hsl(c.outline), 2.2));
    const loops = 22 + (code(f, 5) % 14);
    for (let j = 0; j < loops; j++) {
      const t = ((j + 0.5) / loops) * TAU,
        p = heartAt(t, 1),
        q = heartAt(t, 0.9),
        m = P((p.x + q.x) / 2, (p.y + q.y) / 2);
      const r = 0.045 + 0.02 * ((code(f, j) % 3) / 2);
      els.push(
        L_(
          circle(r, 18, m.x, m.y),
          0.15 + (j / loops) * 0.35,
          0.2 + (j / loops) * 0.35,
          hsl(c.outline, 0.95),
          1.6,
        ),
      );
      els.push(D_(p.x, p.y, 0.012, 0.2 + (j / loops) * 0.35, 0.25 + (j / loops) * 0.35, hsl(c.bloom)));
    }
    for (const k of [0.74, 0.54]) {
      els.push(
        L_(heartPath(k), 0.45 + (1 - k) * 0.3, 0.65 + (1 - k) * 0.3, hsl(c.outline, 0.75), 1.4, {
          dash: true,
        }),
      );
    }
    const rings = [0.62, 0.38];
    rings.forEach((k, ri) => {
      const n = 14 - ri * 5;
      for (let j = 0; j < n; j++) {
        const p = heartAt(((j + 0.5) / n) * TAU, k);
        els.push(D_(p.x, p.y, 0.013, 0.6 + ri * 0.1 + j * 0.006, 0.66 + ri * 0.1 + j * 0.006, hsl(c.bloom)));
      }
    });
    blossom(els, HC.x, HC.y + 0.1, 0.09, -Math.PI / 2, 0.82, c);
    return els;
  }
  if (kind === 'petals') {
    const pts = [],
      step = 0.13 - 0.025 * ((code(f, 7) % 3) / 2);
    for (let y = 0.92; y > -0.72; y -= step * 0.8)
      for (let x = -0.95; x <= 0.95; x += step) {
        const q = P(x + ((Math.round(y / step) % 2) * step) / 2 + (R() - 0.5) * 0.02, y);
        if (inside(q, heartPath(0.94, 80))) pts.push(q);
      }
    const cols = [c.bloom, c.bloomIn, c.leaf];
    pts.forEach((p, i) => {
      const a = Math.atan2(p.y - HC.y, p.x - HC.x) + (R() - 0.5) * 0.6,
        L = step * 1.15,
        t0 = 0.08 + 0.7 * (1 - (p.y + 0.72) / 1.64);
      const pts2 = petal(P(p.x - Math.cos(a) * L * 0.5, p.y - Math.sin(a) * L * 0.5), a, 0, L, L * 0.42, {
        k: 0.8,
        n: 10,
      });
      els.push(F_(pts2, t0, t0 + 0.06, hsl(cols[(code(f, i) + i) % 3], 0.85)));
      els.push(L_(pts2, t0, t0 + 0.06, hsl(c.outline, 0.6), 0.8));
    });
    els.push(L_(H, 0.85, 1, hsl(c.outline), 2));
    return els;
  }
  if (kind === 'hearts') {
    els.push(L_(H, 0, 0.2, hsl(c.outline, 0.6), 1.2, { dash: true }));
    const step = 0.15 - 0.03 * ((code(f, 9) % 3) / 2),
      cols = [c.bloom, c.outline, c.bloomIn],
      cells = [],
      HP = heartPath(0.92, 80);
    for (let y = -0.8; y < 0.95; y += step * 0.86)
      for (let x = -0.98; x <= 0.98; x += step) {
        const q = P(
          x + ((Math.round((y + 0.8) / (step * 0.86)) % 2) * step) / 2 + (R() - 0.5) * 0.03,
          y + (R() - 0.5) * 0.03,
        );
        if (inside(q, HP)) cells.push(q);
      }
    cells.sort((a, b) => b.y - a.y);
    const N = cells.length;
    for (let k = 0; k < N; k++) {
      const p = cells[k],
        r = Math.hypot(p.x - HC.x, p.y - HC.y);
      const s = step * (0.62 + 0.25 * ((code(f, k) % 3) / 2)),
        t0 = 0.1 + (0.75 * k) / N;
      const mh = miniHeart(p.x, p.y, s, (R() - 0.5) * 0.6);
      els.push(F_(mh, t0, t0 + 0.05, hsl(cols[k % 3], 0.9)));
      els.push(L_(mh, t0, t0 + 0.05, hsl(c.outline, 0.5), 0.7));
    }
    return els;
  }
  if (kind === 'glass') {
    const rings = [1, 0.72, 0.44, 0.2],
      segs = 8 + (code(f, 13) % 5),
      t0s = [];
    const hueBase = c.bloom[0],
      cells = [];
    for (let r = 0; r < rings.length - 1; r++)
      for (let j = 0; j < segs; j++) {
        const ta = (j / segs) * TAU,
          tb = ((j + 1) / segs) * TAU,
          poly = [];
        for (let i = 0; i <= 8; i++) poly.push(heartAt(ta + ((tb - ta) * i) / 8, rings[r]));
        for (let i = 8; i >= 0; i--) poly.push(heartAt(ta + ((tb - ta) * i) / 8, rings[r + 1]));
        const h = (hueBase + [-18, 0, 14, 28, -30][code(f, r * segs + j) % 5] + 360) % 360;
        cells.push({
          poly,
          col: [h, Math.min(68, c.bloom[1]), celestial ? 52 : [76, 82, 70][(r + j) % 3]],
          t: 0.1 + r * 0.22 + (j / segs) * 0.15,
        });
      }
    const core = heartPath(0.2, 40);
    cells.push({ poly: core, col: c.bloomIn, t: 0.75 });
    for (const cl of cells) {
      els.push(F_(cl.poly, cl.t, cl.t + 0.08, hsl(cl.col, 0.85)));
      els.push(L_(cl.poly, cl.t, cl.t + 0.08, hsl([30, 20, celestial ? 80 : 22], 0.9), 1.6));
    }
    els.push(L_(H, 0.85, 1, hsl([30, 20, celestial ? 80 : 22]), 3));
    return els;
  }
  // ribbon: a wide band traced around the heart, finished with a bow
  const wR = 0.08 + 0.04 * ((code(f, 19) % 3) / 2),
    outer = [],
    inner = [];
  for (let i = 0; i <= 120; i++) {
    const t = 0.18 + (i / 120) * (TAU - 0.36);
    outer.push(heartAt(t, 1));
    inner.push(heartAt(t, 1 - wR * 1.6));
  }
  const band = outer.concat(inner.slice().reverse());
  els.push(F_(band, 0.05, 0.6, hsl(c.bloom, 0.9)));
  els.push(L_(outer, 0, 0.6, hsl(c.outline), 1.6));
  els.push(L_(inner, 0, 0.6, hsl(c.outline), 1.2));
  for (let k = 0; k < 12; k++) {
    const t = 0.3 + (k / 12) * (TAU - 0.6),
      a = heartAt(t, 1),
      b = heartAt(t + 0.12, 1 - wR * 1.6);
    els.push(L_([a, b], 0.3 + k * 0.02, 0.36 + k * 0.02, hsl(c.bloomIn, 0.6), 1));
  }
  const top = heartAt(0, 1 - wR * 0.8),
    bw = 0.16 + 0.05 * ((code(f, 21) % 3) / 2);
  for (const s of [-1, 1]) {
    const loop = [];
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * TAU;
      loop.push(P(top.x + s * bw * (0.55 + 0.45 * Math.cos(a)), top.y - 0.02 + bw * 0.45 * Math.sin(a)));
    }
    els.push(F_(loop, 0.65, 0.75, hsl(c.bloom)));
    els.push(L_(loop, 0.62, 0.75, hsl(c.outline), 1.4));
    const tail = [
      P(top.x, top.y),
      P(top.x + s * 0.08, top.y + 0.2),
      P(top.x + s * 0.05, top.y + 0.26),
      P(top.x + s * 0.12, top.y + 0.24),
    ];
    els.push(L_(tail, 0.75, 0.85, hsl(c.outline), 2.4));
  }
  els.push(D_(top.x, top.y, 0.035, 0.78, 0.86, hsl(c.outline)));
  return els;
}

/* ================= the AI layer: key words, colours, energy ================= */
let AI = null; // {keywords:[...], palette:['#hex','#hex'], energy:1..5} — comes with the chosen draft

function hexHsl(hex) {
  const n = parseInt(hex.replace('#', ''), 16),
    r = ((n >> 16) & 255) / 255,
    g = ((n >> 8) & 255) / 255,
    b = (n & 255) / 255;
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    l = (mx + mn) / 2;
  let h = 0,
    s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s * 100, l * 100];
}
const hueDist = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};
/* the colour variant closest to the AI palette (otherwise the text decides, as before) */
function pickVariant(list, key, f) {
  if (!AI || !AI.palette || !AI.palette.length) return list[f.letterSum % list.length];
  const want = hexHsl(AI.palette[0]);
  let best = list[0],
    bd = 1e9;
  for (const v of list) {
    const c = v[key];
    const d = hueDist(c[0], want[0]) + (c[1] < 15 ? 40 : 0) + Math.abs(c[2] - want[2]) * 0.3;
    if (d < bd) {
      bd = d;
      best = v;
    }
  }
  return best;
}

/* ================= choose the shape from the text ================= */
function chooseShape(text) {
  const f = features(text),
    R = rng(hash(text + '|' + occ));
  const aiAccent = AI && AI.palette && AI.palette[0] ? AI.palette[0] : null;
  if (occ === 'xmas') {
    const pool =
      mood === 'festive'
        ? SNOW_COLORS.filter(x => /gold/.test(x.name))
        : SNOW_COLORS.filter(x => !/gold/.test(x.name));
    const t = SNOWS[Math.floor(f.h / 7) % SNOWS.length],
      v = pool[f.letterSum % pool.length],
      c = snowCol(v);
    return {
      els: t.build(f, R, c),
      accent: aiAccent || hsl(c.line),
      label: t.name + ' · ' + v.name,
      alt: `A ${v.name} snowflake, ${t.name.toLowerCase()}`,
    };
  }
  if (occ === 'thanks') {
    const kind = HEART_KINDS[Math.floor(f.h / 8) % HEART_KINDS.length],
      v = pickVariant(HEART_COLORS, 'bloom', f),
      c = heartCol(v);
    return {
      els: buildHeartKind(kind, f, R, c),
      accent: aiAccent || hsl(c.bloom[2] > 70 ? [c.bloom[0], c.bloom[1], 55] : c.bloom),
      label: HEART_NAMES[kind] + ' · ' + v.name,
      alt: `A ${HEART_NAMES[kind].toLowerCase()} in ${v.name}`,
    };
  }
  if (occ === 'birthday') {
    const v = pickVariant(CAKE_COLORS, 'body', f),
      c = cakeCol(v),
      cake = buildCake(f, R, c, text);
    return {
      els: cake.els,
      flames: cake.flames,
      accent: aiAccent || hsl([c.accent[0], c.accent[1], Math.min(55, c.accent[2])]),
      label: 'Cake · ' + v.name,
      alt: `A ${v.name} birthday cake` + (cakeNumber(text) ? ` with candles shaped as ${cakeNumber(text)}` : ' with candles'),
    };
  }
  const t = FLOWERS[f.h % FLOWERS.length],
    v = pickVariant(t.variants, 'petal', f),
    c = colors(v);
  const acc = c.petal[2] > 80 ? c.inner : c.petal;
  return {
    els: t.build(f, R, c),
    accent:
      aiAccent ||
      hsl(celestial ? [acc[0], acc[1], Math.max(62, acc[2])] : [acc[0], acc[1], Math.min(55, acc[2])]),
    label: t.name + ' · ' + v.name,
    alt: `A ${v.name} ${t.name.toLowerCase()}`,
  };
}

/* what a screen reader says about the drawing */
function describeShape(sc, to) {
  return (to ? `Card for ${to}: ` : '') + sc.alt + ', drawn while a piano melody plays.';
}
