import { connection } from 'next/server';
import { publicCacheHeaders } from '@/lib/public-cache';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api';
export async function GET(request: Request) {
  await connection();
  try {
    const db = await createClient();
    const { data, error } = await db
      .from('site_content')
      .select('id,kind,title,url,image_url')
      .eq('published', true)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return Response.json({ content: data }, { headers: publicCacheHeaders(request) });
  } catch (error) {
    return apiError(error);
  }
}
