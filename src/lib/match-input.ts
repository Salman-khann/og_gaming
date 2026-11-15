export function normalizePhone(value: unknown) {
  if (typeof value !== 'string') throw new Error('Enter your phone number.');
  let phone = value.replace(/[\s()-]/g, '');
  if (/^03\d{9}$/.test(phone)) phone = '+92' + phone.slice(1);
  if (/^00\d+$/.test(phone)) phone = '+' + phone.slice(2);
  if (!/^\+[1-9]\d{7,14}$/.test(phone))
    throw new Error('Enter a valid number, e.g. 03001234567 or +923001234567.');
  return phone;
}
export function futureMatchTime(value: unknown, now = Date.now()) {
  if (typeof value !== 'string' || !value || !/(Z|[+-]\d{2}:\d{2})$/.test(value))
    throw new Error('Select the match date and time.');
  const time = new Date(value).getTime();
  if (!Number.isFinite(time) || time <= now)
    throw new Error('Choose a future match date and time.');
  return new Date(time).toISOString();
}
