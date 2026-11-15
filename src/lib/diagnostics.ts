import { randomUUID } from 'node:crypto';

export function reportServerError(error: unknown) {
  const id = randomUUID();
  const details = error instanceof Error ? error : new Error('Unknown server error');
  let message = details.message.slice(0, 1500);
  for (const [name, value] of Object.entries(process.env)) {
    if (
      value &&
      value.length >= 8 &&
      /SECRET|TOKEN|PASSWORD|PRIVATE_KEY|SERVICE_ROLE|API_KEY|DATABASE_URL/.test(name)
    )
      message = message.split(value).join('[redacted]');
  }
  message = message
    .replace(/https?:\/\/\S+/g, '[url]')
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[token]')
    .replace(/\b(?:sb_secret_|sbp_)[\w-]+/g, '[token]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\+?\d[\d\s()-]{7,}\d/g, '[number]');
  const frames = details.stack
    ?.split('\n')
    .slice(1, 4)
    .map((line) => line.replace(/https?:\/\/\S+/g, '[url]'));
  console.error(
    'Arena request failed:',
    JSON.stringify({ id, name: details.name, message: message.slice(0, 500), frames }),
  );
  return id;
}
