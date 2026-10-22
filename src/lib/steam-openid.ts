export const STEAM_ENDPOINT = 'https://steamcommunity.com/openid/login';
const namespace = 'http://specs.openid.net/auth/2.0';

export function steamLoginUrl(callback: string) {
  const url = new URL(STEAM_ENDPOINT);
  for (const [key, value] of Object.entries({ ns: namespace, mode: 'checkid_setup', return_to: callback, realm: new URL(callback).origin + '/', identity: namespace + '/identifier_select', claimed_id: namespace + '/identifier_select' })) url.searchParams.set('openid.' + key, value);
  return url;
}

// Validate the assertion shape before asking Steam to verify its signature.
export function steamAssertion(params: URLSearchParams, callback: string, now = Date.now()) {
  const fail = () => { throw new Error('Steam login could not be verified. Please try again.'); };
  for (const key of params.keys()) if (params.getAll(key).length !== 1) fail();
  if (params.get('openid.ns') !== namespace || params.get('openid.mode') !== 'id_res' || params.get('openid.op_endpoint') !== STEAM_ENDPOINT || params.get('openid.return_to') !== callback) fail();
  const claimed = params.get('openid.claimed_id') || '';
  const id = /^https?:\/\/steamcommunity\.com\/openid\/id\/(7656119\d{10})$/.exec(claimed)?.[1];
  if (!id || params.get('openid.identity') !== claimed) fail();
  const signed = (params.get('openid.signed') || '').split(',');
  for (const key of ['op_endpoint', 'claimed_id', 'identity', 'return_to', 'response_nonce', 'assoc_handle']) if (!signed.includes(key) || !params.get('openid.' + key)) fail();
  if (!params.get('openid.sig')) fail();
  const nonce = params.get('openid.response_nonce') || '';
  const issued = Date.parse(nonce.slice(0, 20));
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z.+$/.test(nonce) || !Number.isFinite(issued) || now - issued > 300000 || issued - now > 60000) fail();
  const body = new URLSearchParams();
  for (const [key, value] of params) if (key.startsWith('openid.')) body.set(key, value);
  body.set('openid.mode', 'check_authentication');
  return { steamId: id!, body };
}

export function steamVerificationIsValid(body: string) {
  return body.split(/\r?\n/).filter(line => line.startsWith('is_valid:')).join('') === 'is_valid:true';
}
