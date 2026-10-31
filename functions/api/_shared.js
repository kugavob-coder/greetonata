// Shared helpers for the server functions.
// Not a route: Cloudflare Pages ignores files whose names start with "_".

export const PAYPAL_API = 'https://api-m.sandbox.paypal.com';
export const CARD_PRICE = 2.99;
export const GIFTS = [0, 10, 20, 50];
export const OCCASIONS = ['birthday', 'celebration', 'xmas', 'thanks'];
export const MOODS = ['warm', 'playful', 'festive'];

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

export async function paypalToken(env) {
  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_SECRET}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`PayPal token ${res.status}`);
  return (await res.json()).access_token;
}

export const money = n => n.toFixed(2);

// the AI layer saved with a card: key words, two colours, energy 1–5
export function cleanCardAI(ai, text) {
  const words = new Set(
    String(text)
      .toLowerCase()
      .match(/[a-z0-9']+/g) || [],
  );
  const a = ai && typeof ai === 'object' ? ai : {};
  const keywords = (Array.isArray(a.keywords) ? a.keywords : [])
    .map(k =>
      String(k)
        .toLowerCase()
        .replace(/[^a-z0-9' ]/g, '')
        .trim(),
    )
    .filter(k => k && k.length <= 24 && k.split(' ').every(w => words.has(w)))
    .slice(0, 4);
  const palette = (Array.isArray(a.palette) ? a.palette : [])
    .map(String)
    .filter(c => /^#[0-9a-f]{6}$/i.test(c))
    .slice(0, 2);
  const energy = Math.max(1, Math.min(5, Math.round(Number(a.energy) || 3)));
  return { keywords, palette, energy };
}

// "fiona" → "Fiona" (only lowercase first letters change)
export const nameCase = s => s.replace(/(^|[\s\-'.])(\p{Ll})/gu, (m, a, b) => a + b.toUpperCase());

// random, hard to guess id for the private link
export function newId(length = 10) {
  const abc = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, b => abc[b % abc.length]).join('');
}

/* ---------- a light guard against too many requests from one address ----------
   Kept in memory, so it is per Cloudflare location and resets now and then. It stops a
   script from burning through the free AI quota or flooding orders; it is not a billing system. */
const hits = new Map();
export function rateLimited(request, name, limit, windowSeconds) {
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'local';
  const key = `${name}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) || []).filter(t => t > now - windowSeconds * 1000);
  const limited = recent.length >= limit;
  if (!limited) recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return limited;
}
export const tooMany = () =>
  json({ error: 'Too many requests. Please wait a few minutes and try again.' }, 429);

/* ---------- where the gift is: PayPal Payouts status ---------- */
// statuses after which nothing changes any more
export const FINAL_STATUSES = ['SUCCESS', 'RETURNED', 'FAILED', 'REFUNDED', 'REVERSED', 'BLOCKED', 'DENIED'];
export async function payoutStatus(env, batchId) {
  const token = await paypalToken(env);
  const res = await fetch(`${PAYPAL_API}/v1/payments/payouts/${encodeURIComponent(batchId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.items?.[0]?.transaction_status || data?.batch_header?.batch_status || null;
}
