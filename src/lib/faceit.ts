import 'server-only';
export interface FaceitPlayerInfo { id: string; nickname: string; avatar: string; country: string; elo: number; level: number; gameId: string }
const cache = new Map<string, { data: FaceitPlayerInfo; expires: number }>();
const inFlight = new Map<string, Promise<FaceitPlayerInfo | null>>();
export class FaceitError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
function remember(data: FaceitPlayerInfo) {
  for (const key of ['id:' + data.id, 'nickname:' + data.nickname.toLowerCase()]) {
    if (cache.size >= 500) cache.delete(cache.keys().next().value!);
    cache.set(key, { data, expires: Date.now() + 900000 });
  }
}
export function normalizeFaceitNickname(input: string): string {
  let name = input.trim();
  if (/^(?:https?:\/\/)?(?:www\.)?faceit\.com\//i.test(name)) {
    const url = new URL(/^https?:\/\//i.test(name) ? name : 'https://' + name);
    const parts = url.pathname.split('/').filter(Boolean), index = parts.indexOf('players');
    if (!['faceit.com', 'www.faceit.com'].includes(url.hostname.toLowerCase()) || index < 0 || !parts[index + 1]) throw new Error('Enter a FACEIT nickname or player profile URL.');
    name = decodeURIComponent(parts[index + 1]);
  }
  name = name.replace(/^@/, '');
  if (!name || name.length > 40 || /[\s/?#]/.test(name)) throw new Error('Enter a FACEIT nickname or player profile URL.');
  return name;
}
async function requestFaceit(path: string) {
  const token = process.env.FACEIT_API_KEY;
  if (!token || token.startsWith('your-')) throw new FaceitError('FACEIT verification is not configured. Please contact OG Gaming.', 503);
  let response: Response;
  try { response = await fetch('https://open.faceit.com/data/v4' + path, { headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' }, signal: AbortSignal.timeout(8000), cache: 'no-store' }); }
  catch { throw new FaceitError('FACEIT could not be reached. Please try again.', 503); }
  if (response.status === 404) return null;
  if ([401, 403].includes(response.status)) throw new FaceitError('FACEIT verification credentials need attention. Please contact OG Gaming.', 503);
  if (response.status === 429) throw new FaceitError('FACEIT is receiving too many requests. Please try again shortly.', 429);
  if (!response.ok) throw new FaceitError('FACEIT verification is temporarily unavailable. Please try again.', 503);
  return response.json();
}
interface FaceitResponse { player_id: string; nickname: string; avatar?: string; country?: string; games?: { cs2?: { skill_level: number; faceit_elo: number } } }
function playerInfo(json: FaceitResponse, name: string): FaceitPlayerInfo {
  const game = json.games?.cs2;
  if (!game || !Number.isInteger(game.skill_level) || game.skill_level < 1 || game.skill_level > 10 || !Number.isInteger(game.faceit_elo) || game.faceit_elo < 0) throw new Error(name + ' does not have a verified CS2 profile on FACEIT.');
  if (!json.player_id || !json.nickname) throw new Error('FACEIT returned an incomplete profile for ' + name + '.');
  return { id: json.player_id, nickname: json.nickname, avatar: json.avatar || '', country: json.country || '', elo: game.faceit_elo, level: game.skill_level, gameId: 'cs2' };
}
export async function verifyFaceitPlayer(input: string): Promise<FaceitPlayerInfo> {
  const nickname = normalizeFaceitNickname(input), key = 'nickname:' + nickname.toLowerCase();
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data;
  if (inFlight.has(key)) return (await inFlight.get(key))!;
  const task = resolveNickname(nickname);
  inFlight.set(key, task);
  try { return await task; } finally { inFlight.delete(key); }
}
async function resolveNickname(nickname: string) {
  let json = await requestFaceit('/players?nickname=' + encodeURIComponent(nickname));
  if (!json) {
    const search = await requestFaceit('/search/players?nickname=' + encodeURIComponent(nickname) + '&game=cs2&limit=50');
    const exact = search?.items?.find((p: { nickname: string }) => p.nickname?.toLowerCase() === nickname.toLowerCase());
    if (exact?.player_id) json = await requestFaceit('/players/' + encodeURIComponent(exact.player_id));
  }
  if (!json) throw new Error('FACEIT player "' + nickname + '" was not found. Check the nickname or paste their FACEIT profile URL.');
  const data = playerInfo(json, nickname);
  remember(data);
  return data;
}
export async function getFaceitPlayerByNickname(input: string): Promise<FaceitPlayerInfo | null> {
  try { return await verifyFaceitPlayer(input); } catch { return null; }
}
export async function getFaceitPlayerById(id: string, fresh = false): Promise<FaceitPlayerInfo | null> {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) return null;
  const key = 'id:' + id;
  const cached = cache.get(key);
  if (!fresh && cached && cached.expires > Date.now()) return cached.data;
  if (inFlight.has(key)) return inFlight.get(key)!;
  const task = (async () => {
    try {
      const json = await requestFaceit('/players/' + encodeURIComponent(id));
      const data = json ? playerInfo(json, json.nickname || id) : null;
      if (!data || data.id !== id) return null;
      remember(data); return data;
    } catch { return null; }
  })();
  inFlight.set(key, task);
  try { return await task; } finally { inFlight.delete(key); }
}
