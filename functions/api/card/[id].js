// GET /api/card/<id> — the card for the recipient page (no payment details)
import { json } from '../_paypal.js';

export async function onRequestGet({ params, env }) {
  const id = String(params.id || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 20);
  const card = id && env.CARDS ? await env.CARDS.get(`card:${id}`, 'json') : null;
  if (!card) return json({ error: 'This card could not be found.' }, 404);
  const { occasion, to, from, text, mood, style, gift } = card;
  return json({ occasion, to, from, text, mood, style, gift, giftClaimed: !!card.giftClaim });
}
