// /c/<id> — the private link; serves the recipient page, which then loads the card by its id
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  url.pathname = '/card';
  return env.ASSETS.fetch(new Request(url, request));
}
