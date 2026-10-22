import { createClient } from '@supabase/supabase-js';
process.loadEnvFile('.env.local');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const name = 'match-scorecards';
const list = await db.storage.listBuckets();
if (list.error) throw new Error('Unable to inspect screenshot storage.');
const existing = list.data.find(bucket=>bucket.name===name);
if (existing?.public) throw new Error('The match screenshot bucket must be private.');
if (!existing) {
  const created = await db.storage.createBucket(name,{public:false,fileSizeLimit:5*1024*1024,allowedMimeTypes:['image/png','image/jpeg','image/webp']});
  if (created.error) throw new Error('Unable to create screenshot storage: ' + created.error.message);
}
console.log('Match scorecard storage is ready (private bucket, server-authorized viewing).');
