// GET /api/card/<id> — the card for the recipient page (no payment details).
// If the gift has been claimed, it also asks PayPal where the payout is now.
import { json, payoutStatus, FINAL_STATUSES, rateLimited, tooMany } from '../_shared.js';

export async function onRequestGet({ request, params, env }) {
  if (rateLimited(request, 'card', 60, 60)) return tooMany();
  const id = String(params.id || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 20);
  const key = `card:${id}`;
  const card = id && env.CARDS ? await env.CARDS.get(key, 'json') : null;
  if (!card) return json({ error: 'This card could not be found.' }, 404);

  const claim = card.giftClaim || null;
  if (claim && claim.batchId && !FINAL_STATUSES.includes(claim.status)) {
    try {
      const now = await payoutStatus(env, claim.batchId);
      if (now && now !== claim.status) {
        claim.status = now;
        claim.checked = new Date().toISOString();
        await env.CARDS.put(key, JSON.stringify(card)); // saved only when it changes
      }
    } catch (e) {
      console.log('PayPal payout status failed', String(e));
    }
  }

  const { occasion, to, from, text, mood, style, gift, ai } = card;
  return json({
    occasion,
    to,
    from,
    text,
    mood,
    style,
    gift,
    ai: ai || null,
    giftStatus: claim ? claim.status : null,
  });
}
