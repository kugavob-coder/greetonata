// /c/<id> — the private link. Serves the recipient page and fills in the link preview
// (title, description, picture) that messaging apps show when the link is shared.
const OCCASIONS = ['birthday', 'celebration', 'xmas', 'thanks'];
// names go into HTML attributes, so characters that could break them are left out
const safe = s =>
  String(s)
    .replace(/[&"'<>]/g, '')
    .trim();

export async function onRequestGet({ request, env, params }) {
  const url = new URL(request.url);
  const page = await env.ASSETS.fetch(new Request(new URL('/card', url), request));

  const id = String(params.id || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 20);
  const card = id && env.CARDS ? await env.CARDS.get(`card:${id}`, 'json') : null;
  if (!card) return page;

  const occ = OCCASIONS.includes(card.occasion) ? card.occasion : 'birthday';
  const title = `A card for ${safe(card.to)}`;
  const desc = `${safe(card.from)} sent you a card that plays music. Tap to open.`;
  const image = `${url.origin}/og/${occ}.jpg`;
  const set = value => ({ element: el => el.setAttribute('content', value) });

  return new HTMLRewriter()
    .on('title', { element: el => el.setInnerContent(`${title} — Greetonata`) })
    .on('meta[name="description"]', set(desc))
    .on('meta[property="og:title"]', set(title))
    .on('meta[property="og:description"]', set(desc))
    .on('meta[property="og:image"]', set(image))
    .transform(page);
}
