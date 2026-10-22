import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, cpSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseEnv } from 'node:util';
import ts from 'typescript';
import { checkSecurity, inspectText } from './security-check.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const origin = 'https://oggaming.pk';
const issues = checkSecurity();
if (issues.length) throw new Error('Fix security checks before packaging; no archive was created.');
if (!existsSync(join(root, '.next/BUILD_ID'))) throw new Error('Build for https://oggaming.pk first.');
const marker = join(root, '.next/oggaming-build-origin.json');
if (!existsSync(marker) || JSON.parse(readFileSync(marker, 'utf8')).origin !== origin) throw new Error('Use npm run build:namecheap to rebuild for the production domain.');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const stage = join(root, '.deployment', 'oggaming.pk-' + stamp);
const zip = stage + '.zip';
mkdirSync(stage, { recursive: true });
cpSync(join(root, 'public'), join(stage, 'public'), { recursive: true });
for (const directory of ['server', 'static']) cpSync(join(root, '.next', directory), join(stage, '.next', directory), {
  recursive: true, filter: file => !file.endsWith('.map') && !file.endsWith('.nft.json'),
});
for (const name of readdirSync(join(root, '.next'))) {
  if (name === 'BUILD_ID' || name.endsWith('.json') && !name.endsWith('.nft.json') && name !== 'oggaming-build-origin.json') cpSync(join(root, '.next', name), join(stage, '.next', name));
}
cpSync(join(root, 'server.js'), join(stage, 'server.js'));
let config = ts.transpileModule(readFileSync(join(root, 'next.config.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
config += '\nmodule.exports = exports.default;\n';
writeFileSync(join(stage, 'next.config.js'), config);
const original = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const manifest = { name: original.name, version: original.version, private: true, engines: { node: '>=24 <25' }, scripts: { start: 'node server.js' }, dependencies: original.dependencies };
writeFileSync(join(stage, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
delete lock.packages[''].devDependencies;
lock.packages[''].engines = manifest.engines;
writeFileSync(join(stage, 'package-lock.json'), JSON.stringify(lock, null, 2) + '\n');
writeFileSync(join(stage, 'deployment-info.json'), JSON.stringify({ origin, builtAt: new Date().toISOString(), buildId: readFileSync(join(root, '.next/BUILD_ID'), 'utf8').trim() }, null, 2));
cpSync(join(root, 'docs/NAMECHEAP_UPLOAD.md'), join(stage, 'UPLOAD_INSTRUCTIONS.md'));

const env = existsSync(join(root, '.env.local')) ? parseEnv(readFileSync(join(root, '.env.local'), 'utf8')) : {};
const secrets = Object.entries({ ...env, ...process.env }).filter(([name, value]) => !name.startsWith('NEXT_PUBLIC_') && /SECRET|PASSWORD|PRIVATE_KEY|SERVICE_ROLE|API_KEY|BOT_TOKEN|ACCESS_TOKEN/.test(name) && value).map(([, value]) => value);
let count = 0;
function verify(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name), name = relative(stage, file).replaceAll('\\', '/');
    if (entry.isSymbolicLink() || /(?:^|\/)(?:\.env[^/]*|node_modules|\.git|cache|dev|backups)(?:\/|$)/.test(name)) throw new Error('Forbidden package entry: ' + name);
    if (entry.isDirectory()) verify(file);
    else {
      const data = readFileSync(file);
      if (!data.includes(0) && inspectText(data.toString('utf8'), secrets).length) throw new Error('Potential secret in package: ' + name);
      count++;
    }
  }
}
verify(stage);
if (process.platform !== 'win32') throw new Error('The ZIP writer currently requires PowerShell on Windows. The staged folder is ready.');
const result = spawnSync('powershell.exe', ['-NoProfile', '-File', join(root, 'scripts/zip-namecheap.ps1'), '-Source', stage, '-Destination', zip], { encoding: 'utf8', windowsHide: true });
if (result.status !== 0) throw new Error('ZIP creation failed. The staged folder is preserved.');
writeFileSync(join(root, '.deployment/latest.json'), JSON.stringify({ stage, zip, files: count }, null, 2));
console.log('Upload ZIP:', zip);
console.log('Verified files:', count, '(no local environment files, private credentials, node_modules or build cache)');
