// POST /api/claim — the recipient claims the gift inside the envelope.
// Sends the gift with PayPal Payouts (sandbox) to the email they give, once per card.
import { PAYPAL_API, json, paypalToken, money } from './_paypal.js';

export async function onRequestPost({ request, env }) {
  if (!env.CARDS) return json({ error: 'The shop is not configured.' }, 500);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  const id = String(body.id || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 20);
  const email = String(body.email || '').trim().toLowerCase().slice(0, 120);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Please enter a valid email address.' }, 400);

  const key = `card:${id}`;
  const card = id ? await env.CARDS.get(key, 'json') : null;
  if (!card) return json({ error: 'This card could not be found.' }, 404);
  if (!card.gift) return json({ error: 'There is no gift in this card.' }, 400);
  if (card.giftClaim) return json({ error: 'This gift has already been claimed.', claimed: true }, 409);

  // mark it first, so a second tap cannot send it twice
  card.giftClaim = { status: 'SENDING', at: new Date().toISOString() };
  await env.CARDS.put(key, JSON.stringify(card));

  try {
    const token = await paypalToken(env);
    const res = await fetch(`${PAYPAL_API}/v1/payments/payouts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // the same batch id for the same card: PayPal refuses to pay it twice
        sender_batch_header: {
          sender_batch_id: `greetonata-${id}`,
          email_subject: `${card.from} sent you a gift with a Greetonata card`,
          email_message: 'A little gift from inside your musical card.',
        },
        items: [{
          recipient_type: 'EMAIL',
          receiver: email,
          amount: { value: money(card.gift), currency: 'USD' },
          note: `A gift from ${card.from}, inside your Greetonata card.`,
          sender_item_id: id,
        }],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.log('PayPal payout failed', res.status, JSON.stringify(data).slice(0, 300));
      delete card.giftClaim;
      await env.CARDS.put(key, JSON.stringify(card));
      return json({ error: 'The gift could not be sent right now. Please try again.' }, 502);
    }
    card.giftClaim = { status: data.batch_header?.batch_status || 'PENDING', batchId: data.batch_header?.payout_batch_id, at: new Date().toISOString() };
    await env.CARDS.put(key, JSON.stringify(card));
    return json({ ok: true, amount: money(card.gift) });
  } catch (e) {
    console.log('PayPal payout error', String(e));
    delete card.giftClaim;
    await env.CARDS.put(key, JSON.stringify(card));
    return json({ error: 'The gift could not be sent right now. Please try again.' }, 502);
  }
}
