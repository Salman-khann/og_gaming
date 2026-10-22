import 'server-only';
const cache = new Map<string, { name: string; expires: number }>();
export function steamNameFromXml(xml: string): string | null {
  const raw = /<steamID>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]*))<\/steamID>/.exec(xml);
  if (!raw) return null;
  const name = (raw[1] ?? raw[2]).replace(/&(?:amp|lt|gt|quot|apos);/g, entity => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" }[entity]!)).trim();
  return name ? name.slice(0, 40) : null;
}
export async function getSteamName(steamId: string) {
  if (!/^7656119\d{10}$/.test(steamId)) return null;
  const cached = cache.get(steamId);
  if (cached && cached.expires > Date.now()) return cached.name;
  try {
    let name: string | null = null;
    if (process.env.STEAM_WEB_API_KEY) {
      const url = new URL('https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/');
      url.searchParams.set('key', process.env.STEAM_WEB_API_KEY); url.searchParams.set('steamids', steamId);
      const response = await fetch(url, { signal: AbortSignal.timeout(6000), cache: 'no-store' });
      if (response.ok) { const data = await response.json(); const player = data.response?.players?.find((p: { steamid: string }) => p.steamid === steamId); if (typeof player?.personaname === 'string') name = player.personaname.trim().slice(0, 40); }
    }
    if (!name) {
      const response = await fetch('https://steamcommunity.com/profiles/' + steamId + '/?xml=1', { signal: AbortSignal.timeout(6000), cache: 'no-store', redirect: 'error' });
      if (response.ok) name = steamNameFromXml(await response.text());
    }
    if (name) { if (cache.size >= 500) cache.delete(cache.keys().next().value!); cache.set(steamId, { name, expires: Date.now() + 900000 }); }
    return name;
  } catch { return null; }
}
