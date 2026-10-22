import { createClient } from '@supabase/supabase-js';
process.loadEnvFile('.env.local');
const id = process.env.FACEIT_CLIENT_ID;
const secret = process.env.FACEIT_CLIENT_SECRET;
if (!id || !secret) { console.error('Add FACEIT_CLIENT_ID and FACEIT_CLIENT_SECRET to .env.local.'); process.exit(1); }
const callback = new URL('/auth/v1/callback', process.env.NEXT_PUBLIC_SUPABASE_URL).toString();
if (process.env.FACEIT_REDIRECT_URI && process.env.FACEIT_REDIRECT_URI !== callback) {
  console.error('FACEIT_REDIRECT_URI must match the Supabase Auth callback: ' + callback);
  console.error('Set the same Redirect URL in the FACEIT Developer Portal. The application callback /auth/callback is handled separately by Supabase.');
  process.exit(1);
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const providers = db.auth.admin.customProviders;
const { data, error } = await providers.listProviders();
if (error) { console.error('Unable to read provider configuration:', error.message); process.exit(1); }
// Login navigates the current tab. FACEIT must redirect that window; false
// targets window.opener, which only exists when login starts in a popup.
const options = { name: 'FACEIT', client_id: id, client_secret: secret, scopes: ['openid', 'profile', 'email'], pkce_enabled: true, email_optional: true, authorization_params: { redirect_popup: 'true' }, enabled: true, issuer: 'https://api.faceit.com/auth', discovery_url: 'https://api.faceit.com/auth/v1/openid_configuration' };
const existing = data.providers.find(p => p.identifier === 'custom:faceit');
const result = existing ? await providers.updateProvider(existing.identifier, options) : await providers.createProvider({ ...options, identifier: 'custom:faceit', provider_type: 'oidc' });
if (result.error) { console.error('Unable to configure FACEIT:', result.error.message); process.exit(1); }
console.log('FACEIT provider enabled. Set the FACEIT app Redirect URL in the Developer Portal to ' + callback);
console.log('This script configures Supabase only; it cannot change the callback registered with FACEIT.');
