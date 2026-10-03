import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGE_PATHS } from '../assets/js/content-model.mjs';
import { renderSite } from '../assets/js/site-renderer.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = Object.fromEntries(PAGE_PATHS.map(file => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
const news = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/news.json'), 'utf8'));
const portfolio = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/portfolio.json'), 'utf8'));
const profile = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/profile.json'), 'utf8'));
const output = renderSite(pages, news, portfolio, profile);
const requested = process.argv.find(arg => arg.startsWith('--file='))?.slice(7);
const changes = Object.entries(output).filter(([file, next]) => (!requested || file === requested) && fs.readFileSync(path.join(root, file), 'utf8') !== next);
if (process.argv.includes('--check')) {
  console.log(changes.length ? 'Regeneration required: ' + changes.map(([file]) => file).join(', ') : 'All editable pages match their content records.');
  process.exitCode = changes.length ? 1 : 0;
} else if (changes.length) {
  console.log('*** Begin Patch');
  for (const [file, next] of changes) {
    const old = fs.readFileSync(path.join(root, file), 'utf8');
    console.log('*** Update File: ' + path.join(root, file) + '\n@@\n-' + old.trimEnd().split('\n').join('\n-') + '\n+' + next.trimEnd().split('\n').join('\n+'));
  }
  console.log('*** End Patch');
}
