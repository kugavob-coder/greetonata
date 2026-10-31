/* Greetonata — the melody and the piano.
   compose(text) writes a short tune for a card: it begins with the recipient's name and ends
   with the sender's (every letter becomes a note), uses hand-written phrases so it always
   sounds like a song, and tells which word lights up at which moment. The piano plays it
   with real recordings (Salamander Grand Piano). */

/* ================= the melody: a real little tune, composed from the message =================
   8 bars in question–answer form (4 + 4), steady meter, hand-written two-bar phrases.
   Notes are scale steps (0 = do, 7 = do above, negative = below) with lengths in beats. */
const MAJ = [0, 2, 4, 5, 7, 9, 11];
const norm = w => w.toLowerCase().replace(/[^a-z0-9']/g, '');
function isKeyword(w) {
  return !!(AI && AI.keywords && AI.keywords.some(k => String(k).split(/\s+/).map(norm).includes(norm(w))));
}
const PHRASES = {
  /* 4/4 — bars: I V | IV V | I V | IV·V I */
  common: {
    beats: 4,
    open: [
      // over I then V
      [
        [0, 1],
        [2, 1],
        [4, 1],
        [7, 1],
        [6, 1.5],
        [4, 0.5],
        [1, 2],
      ],
      [
        [4, 1.5],
        [2, 0.5],
        [0, 1],
        [2, 1],
        [1, 1],
        [4, 1],
        [6, 1],
        [4, 1],
      ],
      [
        [2, 0.5],
        [3, 0.5],
        [4, 1],
        [4, 1],
        [4, 1],
        [3, 0.5],
        [2, 0.5],
        [1, 1],
        [1, 2],
      ],
      [
        [0, 1],
        [4, 1],
        [4, 1],
        [5, 0.5],
        [4, 0.5],
        [3, 1],
        [1, 1],
        [-1, 2],
      ],
      [
        [2, 1],
        [2, 0.5],
        [3, 0.5],
        [4, 2],
        [1, 1],
        [1, 0.5],
        [2, 0.5],
        [3, 2],
      ],
      [
        [4, 1],
        [7, 1],
        [6, 0.5],
        [5, 0.5],
        [4, 1],
        [3, 1],
        [1, 1],
        [4, 2],
      ],
      [
        [0, 1.5],
        [1, 0.5],
        [2, 1.5],
        [0, 0.5],
        [-1, 1],
        [1, 1],
        [4, 2],
      ],
    ],
    cont: [
      // over IV then V, ends open (a question)
      [
        [5, 1],
        [5, 1],
        [3, 1],
        [5, 1],
        [4, 1],
        [3, 0.5],
        [2, 0.5],
        [1, 2],
      ],
      [
        [3, 1.5],
        [5, 0.5],
        [7, 1],
        [5, 1],
        [4, 1],
        [6, 1],
        [4, 2],
      ],
      [
        [5, 0.5],
        [4, 0.5],
        [3, 1],
        [0, 1],
        [3, 1],
        [4, 1],
        [6, 1],
        [1, 2],
      ],
      [
        [7, 1],
        [5, 0.5],
        [3, 0.5],
        [5, 1],
        [3, 1],
        [4, 1],
        [1, 1],
        [4, 2],
      ],
      [
        [3, 1],
        [2, 1],
        [3, 1],
        [5, 1],
        [4, 2],
        [1, 1],
        [6, 1],
      ],
    ],
    close: [
      // over IV·V then I, ends home (the answer)
      [
        [5, 1],
        [3, 1],
        [4, 1],
        [1, 1],
        [0, 4],
      ],
      [
        [3, 0.5],
        [5, 0.5],
        [7, 1],
        [6, 1],
        [4, 1],
        [7, 4],
      ],
      [
        [5, 1],
        [7, 1],
        [6, 0.5],
        [4, 0.5],
        [1, 1],
        [2, 1],
        [1, 1],
        [0, 2],
      ],
      [
        [2, 0.5],
        [3, 0.5],
        [5, 1],
        [4, 0.5],
        [3, 0.5],
        [1, 1],
        [0, 4],
      ],
      [
        [5, 1.5],
        [5, 0.5],
        [4, 1],
        [1, 1],
        [2, 1],
        [0, 3],
      ],
    ],
    chords: ['I', 'V', 'IV', 'V', 'I', 'V', 'IV|V', 'I'],
  },
  /* 3/4 waltz, like a music box — bars: I V | IV V | I V | V I */
  waltz: {
    beats: 3,
    open: [
      [
        [0, 1],
        [2, 1],
        [4, 1],
        [4, 2],
        [1, 1],
      ],
      [
        [4, 2],
        [2, 1],
        [1, 2],
        [-1, 1],
      ],
      [
        [2, 1],
        [4, 1],
        [7, 1],
        [6, 2],
        [4, 1],
      ],
      [
        [0, 2],
        [4, 1],
        [6, 1.5],
        [4, 0.5],
        [1, 1],
      ],
      [
        [4, 1],
        [5, 1],
        [4, 1],
        [1, 2],
        [-1, 1],
      ],
      [
        [7, 2],
        [4, 1],
        [6, 1],
        [8, 1],
        [4, 1],
      ],
    ],
    cont: [
      [
        [5, 2],
        [3, 1],
        [4, 2],
        [1, 1],
      ],
      [
        [3, 1],
        [5, 1],
        [7, 1],
        [6, 2],
        [4, 1],
      ],
      [
        [5, 1],
        [3, 1],
        [0, 1],
        [1, 2],
        [4, 1],
      ],
      [
        [7, 1.5],
        [5, 0.5],
        [3, 1],
        [4, 3],
      ],
      [
        [3, 2],
        [5, 1],
        [4, 1],
        [3, 1],
        [1, 1],
      ],
    ],
    close: [
      [
        [4, 1],
        [6, 1],
        [8, 1],
        [7, 3],
      ],
      [
        [1, 2],
        [-1, 1],
        [0, 3],
      ],
      [
        [4, 2],
        [1, 1],
        [2, 1],
        [0, 2],
      ],
      [
        [6, 1.5],
        [5, 0.5],
        [4, 1],
        [7, 3],
      ],
      [
        [8, 1],
        [6, 1],
        [4, 1],
        [7, 3],
      ],
    ],
    chords: ['I', 'V', 'IV', 'V', 'I', 'V', 'V', 'I'],
  },
};
/* chords as semitones above (or below) the key note: root, third, fifth */
const CHORD3 = { I: [0, 4, 7], IV: [-7, -3, 0], V: [-5, -1, 2] };
const V3 = {
  warm: { meter: 'waltz', bpm: 100, legato: 1.0, swing: 0, keys: [60, 62, 65, 67] },
  playful: { meter: 'common', bpm: 138, legato: 0.62, swing: 0.34, keys: [62, 64, 65, 67] },
  festive: { meter: 'common', bpm: 118, legato: 0.9, swing: 0, keys: [60, 62, 63, 65] },
};

/* the tune begins with their name and ends with yours:
   Each letter of a name becomes a note (a, h, o, v → do; b, i, p, w → re; …), like Bach spelling
   B-A-C-H in notes. The rhythm stays from a hand-written phrase, and notes on strong beats are
   moved to the nearest chord tone, so the name always sounds like part of a song. */
const CHORD_DEG = { I: [0, 2, 4], IV: [3, 5, 0], V: [4, 6, 1] };
const TITLES = /^(mr|mrs|ms|miss|dr|mx|sir|madam)$/i;
function nameLetters(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/\s+/)
    .filter(w => !TITLES.test(w.replace(/\./g, '')))
    .join('')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .split('');
}
function partsOf(text) {
  const lines = text
    .trim()
    .split('\n')
    .map(l => l.trim());
  const to = ((lines[0] || '').match(/^dear\s+(.+?),?$/i) || [])[1] || '';
  const last = lines[lines.length - 1] || '';
  const from = last.length && last.length <= 30 && !/[,.!?]$/.test(last) ? last : '';
  return { to, from };
}
const mod7 = x => ((x % 7) + 7) % 7;
/* letter → scale step; the common letters are spread over all seven notes */
const LETTER = {
  a: 0,
  b: 1,
  c: 2,
  d: 3,
  e: 2,
  f: 3,
  g: 4,
  h: 5,
  i: 4,
  j: 6,
  k: 1,
  l: 2,
  m: 5,
  n: 1,
  o: 5,
  p: 3,
  q: 6,
  r: 3,
  s: 6,
  t: 4,
  u: 1,
  v: 4,
  w: 5,
  x: 6,
  y: 6,
  z: 0,
};
function nearestOf(d, degs, maxStep = 3) {
  for (let k = 0; k <= maxStep; k++) for (const s of [d - k, d + k]) if (degs.includes(mod7(s))) return s;
  return d;
}
/* put name letters on a phrase template */
function nameOnPhrase(tpl, letters, chords, B, role) {
  if (!letters.length) return tpl.map(n => n.slice());
  const out = [];
  let pos = 0,
    prev = tpl[0][0];
  const lastIdx = tpl.length - 1;
  tpl.forEach(([s0, d], i) => {
    const bar = Math.floor(pos / B),
      chord = chords[Math.min(bar, chords.length - 1)];
    const parts = chord.split('|'),
      ch = parts[Math.min(parts.length - 1, Math.floor((pos % B) / (B / parts.length)))];
    let s = s0;
    const useName =
      role === 'open' ? i < letters.length : i < lastIdx && i >= Math.max(0, lastIdx - letters.length);
    if (useName) {
      const L = role === 'open' ? letters[i] : letters[i - (lastIdx - Math.min(letters.length, lastIdx))];
      const base = LETTER[L] ?? 0;
      const cands = [base - 7, base, base + 7].filter(x => x >= -3 && x <= 8);
      s = cands.reduce((a, b) => (Math.abs(b - prev) < Math.abs(a - prev) ? b : a), cands[0]);
      const strong = pos % (B === 3 ? 3 : 2) === 0 || d >= 2;
      if (strong || Math.abs(s - prev) > 2) s = nearestOf(s, CHORD_DEG[ch]);
      if (i >= 2 && s === out[i - 1][0] && s === out[i - 2][0])
        s = nearestOf(
          s + (i % 2 ? 1 : -1),
          CHORD_DEG[ch].concat(strong ? [] : [mod7(s + 1), mod7(s - 1)]),
          2,
        ); // no three same notes in a row
    }
    if (role === 'close' && i === lastIdx) s = Math.abs(prev - 7) < Math.abs(prev) ? 7 : 0; // always end at home
    if (role === 'open' && i === lastIdx) s = nearestOf(s, CHORD_DEG[ch]);
    out.push([s, d]);
    prev = s;
    pos += d;
  });
  return out;
}
function compose(text) {
  const M = V3[mood],
    L = PHRASES[M.meter],
    B = L.beats;
  const energy = AI && AI.energy ? Math.max(1, Math.min(5, AI.energy)) : 3;
  const beat = 60 / (M.bpm * (1 + (energy - 3) * 0.06));
  const { to, from } = partsOf(text);
  const toL = nameLetters(to),
    fromL = nameLetters(from);
  const body = text.split('\n').slice(1, -1).join(' ');
  const h = hash(text),
    hb = hash(body);
  const root = M.keys[hash(to.toLowerCase() || text) % M.keys.length];
  const base = root < 63 ? root + 12 : root;
  let low = base - 24;
  if (low < 45) low += 12;
  const mel = s => base + MAJ[((s % 7) + 7) % 7] + 12 * Math.floor(s / 7);
  // the opening whose rhythm fits the name best (number of notes ≈ number of letters)
  const fit = L.open.map((p, i) => ({
    p,
    i,
    score: Math.abs(p.length - Math.max(3, toL.length)) * 10 + ((i + h) % L.open.length),
  }));
  fit.sort((a, b) => a.score - b.score);
  const openChords = M.meter === 'waltz' ? ['I', 'V'] : ['I', 'V'],
    contChords = ['IV', 'V'],
    closeChords = M.meter === 'waltz' ? ['V', 'I'] : ['IV|V', 'I'];
  const A = nameOnPhrase(fit[0].p, toL, openChords, B, 'open');
  const A2 = nameOnPhrase(
    fit[0].p.map(([s, d]) => [s + 2, d]),
    toL.map(c => Object.keys(LETTER).find(k => LETTER[k] === mod7((LETTER[c] ?? 0) + 2))),
    openChords,
    B,
    'open',
  ); // the name a third higher
  const cont1 = L.cont[hb % L.cont.length],
    cont2 =
      L.cont[
        (hb >>> 5) % L.cont.length === hb % L.cont.length
          ? (hb + 1) % L.cont.length
          : (hb >>> 5) % L.cont.length
      ];
  const closeTpl = L.close
    .slice()
    .sort(
      (a, b) =>
        Math.abs(a.length - 1 - Math.max(2, fromL.length)) -
        Math.abs(b.length - 1 - Math.max(2, fromL.length)),
    )[0];
  const C = nameOnPhrase(closeTpl, fromL, closeChords, B, 'close');
  const long = (body.match(/\S+/g) || []).length > 34;
  const form = long
    ? [
        [A, 'open'],
        [cont1, 'cont'],
        [A2, 'open'],
        [cont2, 'cont'],
        [A, 'open'],
        [C, 'close'],
      ]
    : [
        [A, 'open'],
        [cont1, 'cont'],
        [A, 'open'],
        [C, 'close'],
      ];
  const warp = x => {
    if (!M.swing) return x;
    const b = Math.floor(x),
      f = x - b,
      s0 = 0.5 + M.swing * 0.5;
    return b + (f < 0.5 ? (f / 0.5) * s0 : s0 + ((f - 0.5) / 0.5) * (1 - s0));
  };
  const notes = [],
    bass = [],
    fin = [],
    words = [],
    phraseStart = [];
  let pos = B; // one bar of accompaniment first
  form.forEach(([ph]) => {
    phraseStart.push(notes.length);
    for (const [s, d] of ph) {
      const t0 = warp(pos),
        t1 = warp(pos + d);
      notes.push({
        t: t0 * beat,
        dur: Math.max(0.12, (t1 - t0) * beat * M.legato),
        midi: mel(s),
        vol: pos % B === 0 ? 0.27 : 0.22,
        beats: d,
      });
      pos += d;
    }
  });
  const melodyEnd = pos;
  const plan = ['I'];
  form.forEach(([, role]) =>
    plan.push(...(role === 'open' ? openChords : role === 'cont' ? contChords : closeChords)),
  );
  plan.forEach((c, bar) => {
    const parts = c.split('|'),
      len = B / parts.length;
    parts.forEach((name, pi) => {
      let [r, t, f] = CHORD3[name];
      const start = bar * B + pi * len;
      if (low + r < 43) {
        r += 12;
        t += 12;
        f += 12;
      }
      if (M.meter === 'waltz') {
        bass.push({ t: start * beat, dur: beat * 0.95, midi: low + r, vol: 0.14 });
        for (let k = 1; k < len; k++)
          for (const x of [t, f])
            bass.push({ t: (start + k) * beat, dur: beat * 0.7, midi: low + 12 + x, vol: 0.065 });
      } else
        for (let k = 0; k < len * 2; k++) {
          const x = warp(start + k * 0.5);
          bass.push({
            t: x * beat,
            dur: beat * (mood === 'playful' ? 0.4 : 0.85),
            midi: low + [r, f, t + 12, f][k % 4],
            vol: k === 0 ? 0.13 : 0.08,
          });
        }
    });
  });
  const endT = melodyEnd * beat;
  if (mood === 'festive')
    [0, 2, 4, 7].forEach((s, k) =>
      fin.push({ t: endT + k * beat * 0.25, dur: beat * 0.5, midi: mel(s) + 12, vol: 0.12 }),
    );
  [low, low + 12, low + 16, low + 19].forEach(m =>
    fin.push({ t: (melodyEnd - B) * beat, dur: B * beat * 1.6, midi: m, vol: 0.08 }),
  );
  // words: the greeting sings on the name notes, the signature on the closing notes, the rest in between
  const tokens = text.match(/\S+/g) || [];
  const firstLineWords = (text.trim().split('\n')[0].match(/\S+/g) || []).length;
  const lastLineWords = from ? (from.match(/\S+/g) || []).length : 0;
  const closeStart = phraseStart[phraseStart.length - 1],
    closeN = notes.length - closeStart;
  const bodyFirst = Math.min(notes.length - 1, firstLineWords),
    bodyLast = Math.max(bodyFirst, closeStart - 1);
  const starts = notes.map(n => n.t);
  tokens.forEach((tok, i) => {
    let j;
    if (i < firstLineWords) j = Math.min(i, notes.length - 1);
    else if (lastLineWords && i >= tokens.length - lastLineWords)
      j =
        closeStart +
        Math.min(closeN - 1, Math.max(0, closeN - 1 - lastLineWords) + (i - (tokens.length - lastLineWords)));
    else {
      const k = i - firstLineWords,
        n = tokens.length - firstLineWords - lastLineWords;
      j = Math.round(bodyFirst + (n > 1 ? k / (n - 1) : 0) * (bodyLast - bodyFirst));
    }
    const key = isKeyword(tok.replace(/[^A-Za-z0-9']/g, ''));
    if (key) {
      for (let k = Math.max(bodyFirst, j - 2); k <= Math.min(bodyLast, j + 2); k++)
        if (notes[k].beats >= 1) {
          j = k;
          break;
        }
      notes[j].vol = 0.32;
      notes.push({ t: notes[j].t, dur: notes[j].dur, midi: notes[j].midi - 12, vol: 0.12 });
    }
    words.push({ t: starts[j], word: i, key });
  });
  return {
    notes,
    bass,
    fin,
    words,
    total: endT + B * beat * 0.9,
    info: { to, from, toNotes: A.slice(0, toL.length).map(n => n[0]), fromNotes: C.map(n => n[0]), long },
  };
}

/* ================= piano (Salamander Grand Piano, CC BY 3.0) ================= */
const PIANO_SAMPLES = {
  48: 'C3',
  51: 'Ds3',
  54: 'Fs3',
  57: 'A3',
  60: 'C4',
  63: 'Ds4',
  66: 'Fs4',
  69: 'A4',
  72: 'C5',
  75: 'Ds5',
  78: 'Fs5',
  81: 'A5',
};
let actx = null,
  buffers = null,
  master = null;
function b64(s) {
  const bin = atob(s),
    u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u.buffer;
}
function decode(buf) {
  return new Promise((res, rej) => {
    const p = actx.decodeAudioData(buf, res, rej);
    if (p && p.then) p.then(res, rej);
  });
}
async function loadPiano() {
  if (!actx) {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain();
    master.gain.value = 0.9;
    master.connect(actx.destination);
  }
  if (actx.state === 'suspended') await actx.resume();
  if (buffers) return;
  const list = await Promise.all(
    Object.entries(PIANO_SAMPLES).map(async ([m, n]) => {
      let buf;
      if (window.PIANO_EMBED) buf = b64(window.PIANO_EMBED[n]);
      else {
        const r = await fetch('/piano/' + n + '.mp3');
        if (!r.ok) throw new Error(n);
        buf = await r.arrayBuffer();
      }
      return [Number(m), await decode(buf)];
    }),
  );
  buffers = new Map(list);
}
function key(midi, t, dur, vol) {
  let best = null;
  for (const m of buffers.keys()) if (best === null || Math.abs(m - midi) < Math.abs(best - midi)) best = m;
  const src = actx.createBufferSource();
  src.buffer = buffers.get(best);
  src.playbackRate.value = Math.pow(2, (midi - best) / 12);
  const g = actx.createGain();
  g.gain.setValueAtTime(vol * 2.6, t);
  g.gain.setTargetAtTime(0, t + dur, 0.08);
  src.connect(g);
  g.connect(master);
  src.start(t);
  src.stop(t + dur + 0.7);
  return src;
}
