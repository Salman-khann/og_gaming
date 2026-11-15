// Synthetic credentials for the loopback-only browser test Auth server.
export const fixtureAccount = '11111111-1111-4111-8111-111111111112';
export const fixtureUser = { id:fixtureAccount, aud:'authenticated', role:'authenticated', email:'admin@example.test', app_metadata:{provider:'email'}, user_metadata:{}, created_at:'2026-01-01T00:00:00Z' };
export const fixtureSignature = Buffer.from('browser-fixture-signature').toString('base64url');
export function fixtureCookie() {
  const now=Math.floor(Date.now()/1000);
  const token=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:fixtureAccount,aud:'authenticated',role:'authenticated',iss:'http://127.0.0.1:54321/auth/v1',exp:now+3600,iat:now})).toString('base64url'),fixtureSignature].join('.');
  return 'base64-'+Buffer.from(JSON.stringify({access_token:token,refresh_token:'browser-fixture-refresh',expires_at:now+3600,expires_in:3600,token_type:'bearer',user:fixtureUser})).toString('base64url');
}
