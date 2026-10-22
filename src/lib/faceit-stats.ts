export function statNumber(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  if (String(value).trim() === '') return null;
  const number = Number(String(value).replace('%', '').trim());
  return Number.isFinite(number) && number >= 0 ? number : null;
}
