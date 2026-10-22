// Only known YouTube video URLs can become embedded frames.
export function youtubeEmbed(value: string): string | null {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  const parts = url.pathname.split('/').filter(Boolean);
  let id: string | null = null;
  if (['youtu.be', 'www.youtu.be'].includes(url.hostname) && parts.length === 1) id = parts[0];
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(url.hostname)) {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else if (['embed', 'shorts', 'live'].includes(parts[0]) && parts.length === 2) id = parts[1];
  }
  return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? 'https://www.youtube-nocookie.com/embed/' + id : null;
}
