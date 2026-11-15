import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { verifiedUser } from '@/lib/auth-session';
import { Navbar } from '@/components/Navbar';
import { ArenaWorkspace } from '@/components/ArenaWorkspace';
import { Suspense } from 'react';
import { connection } from 'next/server';
export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <>
          <Navbar />
          <main className="wrap arena-main">
            <p role="status">Checking administrator access…</p>
          </main>
        </>
      }
    >
      <AdminContent />
    </Suspense>
  );
}
async function AdminContent() {
  await connection();
  let role: string | undefined;
  try {
    const db = await createClient();
    const user = await verifiedUser(db);
    if (user) {
      const { data, error } = await db.from('profiles').select('role').eq('id', user.id).single();
      if (error) throw error;
      role = data?.role;
    }
  } catch {
    return (
      <>
        <Navbar />
        <main className="wrap arena-main">
          <p className="error-message">
            Administration is temporarily unavailable. Please try again shortly.
          </p>
        </main>
      </>
    );
  }
  if (!role) redirect('/login');
  if (role !== 'admin')
    return (
      <>
        <Navbar />
        <main className="wrap arena-main">
          <h1>Access denied.</h1>
          <p className="muted mt-6">An administrator account is required.</p>
        </main>
      </>
    );
  return (
    <>
      <Navbar />
      <ArenaWorkspace admin />
    </>
  );
}
