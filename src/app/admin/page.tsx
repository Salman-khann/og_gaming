import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Navbar } from '@/components/Navbar';
import { ArenaWorkspace } from '@/components/ArenaWorkspace';
import { Suspense } from 'react';
import { connection } from 'next/server';
export default function AdminPage() {
  return <Suspense fallback={<><Navbar /><main className="wrap arena-main"><p role="status">Checking administrator access…</p></main></>}><AdminContent /></Suspense>;
}
async function AdminContent() {
  await connection();
  let role: string | undefined;
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (user) {
      const { data } = await db.from('profiles').select('role').eq('id', user.id).single();
      role = data?.role;
    }
  } catch { return <><Navbar /><main className="wrap arena-main"><p className="error-message">Administration is unavailable. Configure Supabase and apply the database migrations.</p></main></>; }
  if (!role) redirect('/login');
  if (role !== 'admin') return <><Navbar /><main className="wrap arena-main"><h1>Access denied.</h1><p className="muted mt-6">An administrator account is required.</p></main></>;
  return <><Navbar /><ArenaWorkspace admin /></>;
}
