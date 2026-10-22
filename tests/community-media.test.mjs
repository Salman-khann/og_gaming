import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync(new URL('../src/lib/community-media.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { youtubeEmbed } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const id = 'aB_123456-7';
for (const url of [
  'https://www.youtube.com/watch?v=' + id,
  'https://youtu.be/' + id + '?si=share',
  'https://m.youtube.com/watch?v=' + id,
  'https://youtube.com/shorts/' + id,
  'https://www.youtube.com/live/' + id,
  'https://www.youtube-nocookie.com/embed/' + id,
]) assert.equal(youtubeEmbed(url), 'https://www.youtube-nocookie.com/embed/' + id, url);
for (const url of ['', 'invalid', 'javascript:alert(1)', 'https://youtube.com/', 'https://youtube.com/watch?v=bad',
  'https://youtube.com.evil.test/watch?v=' + id, 'https://evil.test/embed/' + id,
  'http://youtube.com/watch?v=' + id, 'https://user:pass@youtube.com/watch?v=' + id,
  'https://youtu.be/' + id + '/extra', 'https://youtube.com:444/embed/' + id,
]) assert.equal(youtubeEmbed(url), null, url);
console.log('Community video URLs passed: watch, share, mobile, Shorts, live, embeds and invalid/foreign URLs.');
