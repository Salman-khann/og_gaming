import { NotificationLog } from '@/types';

export interface SendAlertParams {
  channel?: 'telegram' | 'email';
  eventType: string;
  recipient?: string;
  message: string;
  payload?: Record<string, unknown>;
}

export async function sendTelegramAlert(message: string): Promise<{ success: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!token || !chatId) {
    console.log('[Telegram Alert Simulated - Missing Tokens]', message);
    return { success: true };
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[Telegram Alert Error]', err);
      return { success: false, error: err };
    }

    return { success: true };
  } catch (error) {
    console.error('[Telegram Exception]', error);
    return { success: false, error: String(error) };
  }
}

export async function sendEmailAlert(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || 'OG Gaming <notifications@oggaming.com>';

  if (!apiKey) {
    console.log('[Email Alert Simulated - Missing API Key]', params);
    return { success: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[Resend Error]', err);
      return { success: false, error: err };
    }

    return { success: true };
  } catch (error) {
    console.error('[Resend Exception]', error);
    return { success: false, error: String(error) };
  }
}

export async function notifyAdminNewBooking(bookingDetails: {
  userName: string;
  cabinName: string;
  startTime: string;
  endTime: string;
  playerCount: number;
}) {
  const telegramMessage = `
🚨 <b>NEW CABIN BOOKING REQUEST</b>
<b>Player:</b> ${bookingDetails.userName}
<b>Cabin:</b> ${bookingDetails.cabinName}
<b>Slot:</b> ${bookingDetails.startTime} - ${bookingDetails.endTime}
<b>PCs:</b> ${bookingDetails.playerCount}
<i>Review and approve in the Admin Dashboard!</i>
`.trim();

  await sendTelegramAlert(telegramMessage);
}

export async function notifyAdminTournamentRegistration(regDetails: {
  teamName: string;
  tournamentTitle: string;
  captainNickname: string;
  avgLevel: number;
}) {
  const telegramMessage = `
🏆 <b>NEW TOURNAMENT REGISTRATION</b>
<b>Tournament:</b> ${regDetails.tournamentTitle}
<b>Team:</b> ${regDetails.teamName}
<b>Captain:</b> ${regDetails.captainNickname}
<b>Avg Level:</b> Level ${regDetails.avgLevel}
`.trim();

  await sendTelegramAlert(telegramMessage);
}
