import 'server-only';
import { randomUUID } from 'node:crypto';
import { after } from 'next/server';
import { createAdminClient } from './supabase/admin';
import { ApiError } from './api-input';

export async function reserveScorecardCleanup(path: string, delaySeconds = 900) {
  const result = await createAdminClient().rpc('queue_scorecard_cleanup', {
    cleanup_path: path,
    delay_seconds: delaySeconds,
  });
  if (result.error) throw new ApiError('Screenshot cleanup protection is unavailable.', 503);
}

export async function drainScorecardCleanup() {
  const db = createAdminClient(8000);
  const claimId = randomUUID();
  const claimed = await db.rpc('claim_scorecard_cleanup', { batch_size: 5, claim_id: claimId });
  if (claimed.error) throw new Error('Unable to claim screenshot cleanup jobs.');
  const jobs = (claimed.data || []) as { id: string; bucket: string; object_path: string }[];
  let completed = 0;
  const results = await Promise.allSettled(
    jobs.map(async (job) => {
      let succeeded = false;
      try {
        if (job.bucket !== 'match-scorecards') throw new Error('Invalid cleanup bucket.');
        const active = await db
          .from('match_scorecards')
          .select('match_id')
          .eq('storage_path', job.object_path)
          .limit(1);
        if (active.error || active.data?.length)
          throw new Error('Screenshot reference check failed.');
        const result = await db.storage.from(job.bucket).remove([job.object_path]);
        succeeded = !result.error;
      } catch {
        // Keep the durable job; expired leases recover crashes and network failures.
      }
      const finished = await db.rpc('finish_scorecard_cleanup', {
        job_id: job.id,
        claim_id: claimId,
        succeeded,
      });
      if (finished.error) throw new Error('Unable to acknowledge screenshot cleanup.');
      if (succeeded) completed++;
    }),
  );
  return {
    completed,
    attempted: jobs.length,
    deferred: results.filter((result) => result.status === 'rejected').length,
  };
}

export function cleanupScorecardsAfterResponse() {
  after(async () => {
    try {
      await drainScorecardCleanup();
    } catch {
      console.error('Screenshot cleanup deferred; durable jobs will be retried.');
    }
  });
}
