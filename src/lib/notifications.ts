import { after } from 'next/server';
import { createAdminClient } from './supabase/admin';
type Notice = { id: string; channel: string; recipient: string; event_type: string; payload: { id?: string; name?: string }; attempts: number; event_key: string };
const configured = () => !!((process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_CHAT_ID) || (process.env.RESEND_API_KEY && process.env.ADMIN_EMAIL && process.env.NOTIFICATION_FROM_EMAIL));
export function dispatchAfterResponse() {
  if (configured()) after(async () => { try { await dispatchNotifications(); } catch { console.error('Notification dispatch will retry on the next worker run.'); } });
}
export async function dispatchNotifications(pass=0,deadline=Date.now()+20000) {
  if (!configured()) return { delivered: 0, configured: false };
  const db = createAdminClient();
  const { data, error } = await db.rpc('claim_notifications');
  if (error) throw new Error('Unable to claim notifications.');
  let delivered = 0;
  const notices=(data||[]) as Notice[];
  for(let index=0;index<notices.length;index+=4) await Promise.all(notices.slice(index,index+4).map(async notice=>{
    if(Date.now()+1000>=deadline) {
      // Leave unprocessed notices available without consuming their retry budget.
      await db.from('notifications_log').update({lease_until:null,attempts:Math.max(0,notice.attempts-1)}).eq('id',notice.id);
      return;
    }
    try {
      let deliveryId:string|null=null;
      const channels: { channel: 'telegram' | 'email'; recipient: string }[] = [];
      if (notice.channel === 'system') {
        if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_CHAT_ID) channels.push({ channel: 'telegram', recipient: process.env.TELEGRAM_ADMIN_CHAT_ID });
        if (process.env.RESEND_API_KEY && process.env.ADMIN_EMAIL && process.env.NOTIFICATION_FROM_EMAIL) channels.push({ channel: 'email', recipient: process.env.ADMIN_EMAIL });
        for (const target of channels) {
          const result = await db.from('notifications_log').upsert({ ...target, event_type: notice.event_type, payload: notice.payload, event_key: notice.event_key + ':' + target.channel }, { onConflict: 'event_key', ignoreDuplicates: true });
          if (result.error) throw new Error('Unable to queue channel delivery.');
        }
      } else {
        const text = 'OG Gaming: ' + notice.event_type + '\n' + (notice.payload.name || 'Arena update') + '\n' + new URL('/admin', process.env.NEXT_PUBLIC_SITE_URL).toString();
        const response = notice.channel === 'telegram'
          ? await fetch('https://api.telegram.org/bot' + process.env.TELEGRAM_BOT_TOKEN + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: notice.recipient, text }), signal: AbortSignal.timeout(Math.max(1,Math.min(5000,deadline-Date.now()))) })
          : await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json', 'Idempotency-Key': notice.event_key }, body: JSON.stringify({ from: process.env.NOTIFICATION_FROM_EMAIL, to: [notice.recipient], subject: 'OG Gaming ' + notice.event_type, text }), signal: AbortSignal.timeout(Math.max(1,Math.min(5000,deadline-Date.now()))) });
        if (!response.ok) throw new Error('Provider returned status ' + response.status);
        const receipt=await response.json();
        if(notice.channel==='telegram'&&!receipt.ok)throw new Error('Telegram did not accept delivery.');
        deliveryId=notice.channel==='telegram'?String(receipt.result?.message_id||''):typeof receipt.id==='string'?receipt.id:null;
        delivered++;
      }
      const updated = await db.from('notifications_log').update({ status: 'sent', sent_at: new Date().toISOString(), lease_until: null, error_message: null,delivery_id:deliveryId }).eq('id', notice.id);
      if (updated.error) throw new Error('Unable to record notification delivery.');
    } catch (error) {
      await db.from('notifications_log').update({ status: 'failed', error_message: error instanceof Error ? error.message : 'Delivery failed', lease_until: null, available_at: new Date(Date.now() + Math.min(3600000, 30000 * 2 ** notice.attempts)).toISOString() }).eq('id', notice.id);
    }
  }));
  // Expand system events and send their channel rows in the same worker run.
  if (pass<1 && Date.now()+1000<deadline && (data || []).some((notice: Notice) => notice.channel === 'system') && (data || []).length) {
    const next = await dispatchNotifications(pass+1,deadline); delivered += next.delivered;
  }
  return { delivered, configured: true };
}
