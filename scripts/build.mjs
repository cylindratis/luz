import { cp, mkdir, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

await mkdir('dist', { recursive: true });
for (const file of await readdir('src')) await cp(resolve('src', file), resolve('dist', file), { recursive: true });
const result = spawnSync(process.execPath, ['node_modules/@tailwindcss/cli/dist/index.mjs', '-i', 'src/tailwind.css', '-o', 'dist/ui.css', '--minify'], { stdio: 'inherit' });
if (result.status) process.exit(result.status);
console.log('Site estático gerado em dist/');
