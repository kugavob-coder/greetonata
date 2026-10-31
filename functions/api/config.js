// GET /api/config — the public PayPal client id for the PayPal button (the secret never leaves the server)
import { json } from './_shared.js';

export async function onRequestGet({ env }) {
  if (!env.PAYPAL_CLIENT_ID) return json({ error: 'PayPal is not configured.' }, 500);
  return json({ paypalClientId: env.PAYPAL_CLIENT_ID });
}
