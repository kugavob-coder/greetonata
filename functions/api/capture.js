// POST /api/capture — captures the approved PayPal (sandbox) payment, then saves the card
// under a new private id and returns that id for the link.
import { PAYPAL_API, json, paypalToken, newId } from './_paypal.js';

export async function onRequestPost({ request, env }) {
  if (!env.CARDS) return json({ error: 'The shop is not configured.' }, 500);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  const orderId = String(body.orderID || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 40);
  if (!orderId) return json({ error: 'Missing order.' }, 400);

  const pending = await env.CARDS.get(`pending:${orderId}`, 'json');
  if (!pending) return json({ error: 'This payment has expired. Please make the card again.' }, 410);

  try {
    const token = await paypalToken(env);
    const res = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    const capture = data?.purchase_units?.[0]?.payments?.captures?.[0];
    if (!res.ok || data.status !== 'COMPLETED' || !capture) {
      console.log('PayPal capture failed', res.status, JSON.stringify(data).slice(0, 300));
      const declined = (data?.details || []).some(d => d.issue === 'INSTRUMENT_DECLINED');
      return json({ error: declined ? 'The payment was declined. Please try another way to pay.' : 'The payment could not be completed.', declined }, 402);
    }
    if (capture.amount?.value !== pending.total) {
      console.log('PayPal amount mismatch', capture.amount?.value, pending.total);
      return json({ error: 'The payment amount does not match.' }, 400);
    }

    const id = newId();
    const card = {
      occasion: pending.occasion, to: pending.to, from: pending.from, text: pending.text,
      mood: pending.mood, style: pending.style, gift: pending.gift,
      paid: pending.total, orderId, captureId: capture.id, created: new Date().toISOString(),
    };
    await env.CARDS.put(`card:${id}`, JSON.stringify(card));
    await env.CARDS.delete(`pending:${orderId}`);
    return json({ id });
  } catch (e) {
    console.log('PayPal capture error', String(e));
    return json({ error: 'The payment could not be completed.' }, 502);
  }
}
