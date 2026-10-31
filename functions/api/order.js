// POST /api/order — creates a PayPal (sandbox) order for the card and the optional gift,
// and keeps the card waiting in KV until the payment is captured.
import { PAYPAL_API, CARD_PRICE, GIFTS, OCCASIONS, MOODS, json, paypalToken, money, nameCase } from './_paypal.js';

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\r/g, '').trim().slice(0, max);

export async function onRequestPost({ request, env }) {
  if (!env.CARDS || !env.PAYPAL_CLIENT_ID || !env.PAYPAL_SECRET) return json({ error: 'The shop is not configured.' }, 500);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }

  const c = body.card || {};
  const card = {
    occasion: OCCASIONS.includes(c.occasion) ? c.occasion : null,
    to: nameCase(clean(c.to, 40)),
    from: nameCase(clean(c.from, 40)),
    text: clean(c.text, 1200),
    mood: MOODS.includes(c.mood) ? c.mood : 'warm',
    style: c.style === 'celestial' ? 'celestial' : 'classic',
    gift: GIFTS.includes(Number(body.gift)) ? Number(body.gift) : 0,
  };
  if (!card.occasion || !card.to || !card.from || !card.text) return json({ error: 'The card is incomplete.' }, 400);

  const total = CARD_PRICE + card.gift;
  const items = [{ name: 'Greetonata card', quantity: '1', unit_amount: { currency_code: 'USD', value: money(CARD_PRICE) } }];
  if (card.gift) items.push({ name: `Gift for ${card.to}`.slice(0, 120), quantity: '1', unit_amount: { currency_code: 'USD', value: money(card.gift) } });

  try {
    const token = await paypalToken(env);
    const res = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          description: 'Greetonata musical greeting card',
          amount: { currency_code: 'USD', value: money(total), breakdown: { item_total: { currency_code: 'USD', value: money(total) } } },
          items,
        }],
      }),
    });
    const order = await res.json();
    if (!res.ok || !order.id) {
      console.log('PayPal create order failed', res.status, JSON.stringify(order).slice(0, 300));
      return json({ error: 'The payment could not be started.' }, 502);
    }
    // the card waits here for one hour, until the payment is captured
    await env.CARDS.put(`pending:${order.id}`, JSON.stringify({ ...card, total: money(total) }), { expirationTtl: 3600 });
    return json({ id: order.id });
  } catch (e) {
    console.log('PayPal create order error', String(e));
    return json({ error: 'The payment could not be started.' }, 502);
  }
}
