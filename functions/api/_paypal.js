// Shared helpers for the PayPal sandbox calls (not a route: Pages ignores files starting with "_").

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

// random, hard to guess id for the private link
export function newId(length = 10) {
  const abc = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, b => abc[b % abc.length]).join('');
}
