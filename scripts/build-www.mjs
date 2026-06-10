// Stage the web game into www/ for Capacitor (iOS) packaging.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const www = join(root, 'www');

rmSync(www, { recursive: true, force: true });
mkdirSync(www);
for (const item of ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'icons']) {
  cpSync(join(root, item), join(www, item), { recursive: true });
}
console.log('Staged web assets into www/');
