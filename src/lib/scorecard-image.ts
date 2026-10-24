export const SCORECARD_BUCKET = 'match-scorecards';
export const SCORECARD_MAX_BYTES = 5 * 1024 * 1024;
export function scorecardImage(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > SCORECARD_MAX_BYTES)
    throw new Error('Choose an image smaller than 5 MB.');
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b))
    return { type: 'image/png', extension: 'png' };
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return { type: 'image/jpeg', extension: 'jpg' };
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  )
    return { type: 'image/webp', extension: 'webp' };
  throw new Error('Upload a PNG, JPG or WebP screenshot.');
}
