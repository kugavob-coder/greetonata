// Server functions, tested with a fake PayPal, a fake Groq and an in-memory KV store.
// Run: npm test   (Node 18 or newer, no packages needed)
import test from 'node:test';
import assert from 'node:assert/strict';

const fn = p => import(new URL('../functions/' + p, import.meta.url));
const { onRequestPost: drafts } = await fn('api/drafts.js');
const { onRequestPost: order } = await fn('api/order.js');
const { onRequestPost: capture } = await fn('api/capture.js');
const { onRequestPost: claim } = await fn('api/claim.js');
const { onRequestGet: getCard } = await fn('api/card/[id].js');
const { cleanCardAI, nameCase } = await fn('api/_shared.js');

function memoryKV() {
  const m = new Map();
  return {
    m,
    put: async (k, v) => void m.set(k, v),
    get: async (k, type) => (m.has(k) ? (type === 'json' ? JSON.parse(m.get(k)) : m.get(k)) : null),
    delete: async k => void m.delete(k),
  };
}
let ip = 0;
const post = (body, from = `10.0.0.${++ip}`) =>
  new Request('https://greetonata.test/api', {
    method: 'POST',
    headers: { 'CF-Connecting-IP': from, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
const get = (from = `10.1.0.${++ip}`) => new Request('https://greetonata.test/api', { headers: { 'CF-Connecting-IP': from } });

/* a fake PayPal (and Groq) behind fetch */
function fakeServices({ payoutStatus = 'SUCCESS' } = {}) {
  const calls = [];
  let created = null;
  globalThis.fetch = async (url, opt = {}) => {
    calls.push(url);
    if (url.includes('groq.com/openai/v1/models')) return Response.json({ data: [{ id: 'llama-3.3-70b-versatile' }] });
    if (url.includes('groq.com')) {
      const drafts = ['Warm', 'Playful', 'Festive'].map(t => ({
        tone: t,
        text: 'Dear Ana,\n\nHappy birthday to my sister, who loves the sea.\n\nWith love,\nMarko',
        keywords: ['sister', 'sea', 'dragons'],
        palette: ['#3a7ca5', 'not-a-colour'],
        energy: 9,
      }));
      return Response.json({ choices: [{ message: { content: JSON.stringify({ drafts }) } }] });
    }
    if (url.endsWith('/v1/oauth2/token')) return Response.json({ access_token: 'T' });
    if (url.endsWith('/v2/checkout/orders')) {
      created = JSON.parse(opt.body);
      return Response.json({ id: 'ORDER-1' }, { status: 201 });
    }
    if (url.includes('/capture')) {
      const value = created.purchase_units[0].amount.value;
      return Response.json(
        { status: 'COMPLETED', purchase_units: [{ payments: { captures: [{ id: 'CAP-1', amount: { value } }] } }] },
        { status: 201 },
      );
    }
    if (url.endsWith('/v1/payments/payouts'))
      return Response.json({ batch_header: { payout_batch_id: 'BATCH-1', batch_status: 'PENDING' } }, { status: 201 });
    if (url.includes('/v1/payments/payouts/BATCH-1'))
      return Response.json({ items: [{ transaction_status: payoutStatus }] });
    throw new Error('unexpected fetch ' + url);
  };
  return { calls, created: () => created };
}

const card = {
  occasion: 'birthday',
  to: 'ana',
  from: 'marko',
  text: 'Dear Ana,\n\nHappy birthday to my sister, who loves the sea.\n\nWith love,\nMarko',
  mood: 'warm',
  style: 'classic',
  ai: { keywords: ['sister', 'unicorn'], palette: ['#3a7ca5'], energy: 2 },
};

test('drafts: three drafts, and the AI layer is cleaned', async () => {
  fakeServices();
  const res = await drafts({ request: post({ occasion: 'birthday', to: 'Ana', from: 'Marko' }), env: { GROQ_API_KEY: 'k' } });
  assert.equal(res.status, 200);
  const { drafts: list } = await res.json();
  assert.deepEqual(list.map(d => d.tone), ['Warm', 'Playful', 'Festive']);
  assert.deepEqual(list[0].ai, { keywords: ['sister', 'sea'], palette: ['#3a7ca5'], energy: 5 });
});

test('drafts: missing names are refused', async () => {
  fakeServices();
  const res = await drafts({ request: post({ occasion: 'birthday', to: '' }), env: { GROQ_API_KEY: 'k' } });
  assert.equal(res.status, 400);
});

test('rate limit: the 11th request in ten minutes from one address waits', async () => {
  fakeServices();
  let last;
  for (let i = 0; i < 11; i++)
    last = await drafts({ request: post({ occasion: 'birthday', to: 'A', from: 'B' }, '192.0.2.7'), env: { GROQ_API_KEY: 'k' } });
  assert.equal(last.status, 429);
});

test('pay, save, open, claim the gift once, and follow its status', async () => {
  const svc = fakeServices({ payoutStatus: 'UNCLAIMED' });
  const env = { CARDS: memoryKV(), PAYPAL_CLIENT_ID: 'id', PAYPAL_SECRET: 'secret' };

  let res = await order({ request: post({ gift: 20, card }), env });
  assert.equal(res.status, 200);
  assert.equal(svc.created().purchase_units[0].amount.value, '22.99');

  res = await capture({ request: post({ orderID: 'ORDER-1' }), env });
  const paid = await res.json();
  assert.equal(paid.paid, '22.99');
  assert.match(paid.id, /^[A-Za-z0-9]{10}$/);

  res = await getCard({ request: get(), params: { id: paid.id }, env });
  const saved = await res.json();
  assert.equal(saved.to, 'Ana', 'names start with a capital letter');
  assert.deepEqual(saved.ai.keywords, ['sister'], 'only key words that are in the text');
  assert.equal(saved.giftStatus, null);

  res = await claim({ request: post({ id: paid.id, email: 'Ana@Example.com' }), env });
  assert.equal(res.status, 200);
  res = await claim({ request: post({ id: paid.id, email: 'someone@else.com' }), env });
  assert.equal(res.status, 409, 'a gift can be claimed only once');

  res = await getCard({ request: get(), params: { id: paid.id }, env });
  assert.equal((await res.json()).giftStatus, 'UNCLAIMED', 'the status comes from PayPal');
});

test('a payment cannot be captured twice', async () => {
  fakeServices();
  const env = { CARDS: memoryKV(), PAYPAL_CLIENT_ID: 'id', PAYPAL_SECRET: 'secret' };
  await order({ request: post({ gift: 0, card }), env });
  assert.equal((await capture({ request: post({ orderID: 'ORDER-1' }), env })).status, 200);
  assert.equal((await capture({ request: post({ orderID: 'ORDER-1' }), env })).status, 410);
});

test('helpers: names and AI layer', () => {
  assert.equal(nameCase('mrs. novak'), 'Mrs. Novak');
  assert.deepEqual(cleanCardAI({ keywords: ['<b>', 'sea'], palette: ['red', '#ABCDEF'], energy: 0 }, "the sea"), {
    keywords: ['sea'],
    palette: ['#ABCDEF'],
    energy: 3, // missing or out of range: the middle
  });
});

test('card link: preview tags, and the right seal colour and name before the page script runs', async () => {
  const { onRequestGet: cardLink } = await fn('c/[id].js');
  // a tiny stand-in for Cloudflare's HTMLRewriter that records what each selector would get
  const seen = {};
  globalThis.HTMLRewriter = class {
    on(sel, h) {
      const el = {
        setAttribute: (k, v) => ((seen[sel] ??= {})[k] = v),
        setInnerContent: v => ((seen[sel] ??= {}).html = v),
      };
      h.element(el);
      return this;
    }
    transform(r) {
      return r;
    }
  };
  const env = { CARDS: memoryKV(), ASSETS: { fetch: async () => new Response('<html></html>') } };
  await env.CARDS.put('card:abc123', JSON.stringify({ occasion: 'xmas', style: 'celestial', to: 'Mel<b>', from: 'Bo' }));
  await cardLink({ request: new Request('https://greetonata.test/c/abc123'), params: { id: 'abc123' }, env });
  assert.equal(seen.body['data-occ'], 'xmas');
  assert.equal(seen.body.class, 'celestial');
  assert.equal(seen['#hello'].html, 'A card for <b>Melb</b>', 'names cannot carry HTML');
  assert.equal(seen['meta[property="og:image"]'].content, 'https://greetonata.test/og/xmas.jpg');
  delete globalThis.HTMLRewriter;
});
