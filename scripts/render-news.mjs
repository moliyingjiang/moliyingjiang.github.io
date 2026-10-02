import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderNewsPages } from '../assets/js/render-news.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const names = ['index.html', 'zh/index.html', 'milestones.html', 'zh/milestones.html'];
const pages = Object.fromEntries(names.map(file => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
const data = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/news.json'), 'utf8'));
const portfolio = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/portfolio.json'), 'utf8'));
const changes = Object.entries(renderNewsPages(pages, data, portfolio)).filter(([file, next]) => next !== pages[file]);
if (process.argv.includes('--check')) {
  console.log(changes.length ? 'News pages need regeneration: ' + changes.map(([file]) => file).join(', ') : 'All four news pages match the shared bilingual records.');
  process.exitCode = changes.length ? 1 : 0;
} else if (changes.length) {
  console.log('*** Begin Patch');
  for (const [file, next] of changes) console.log('*** Update File: ' + path.join(root, file) + '\n@@\n-' + pages[file].trimEnd().split('\n').join('\n-') + '\n+' + next.trimEnd().split('\n').join('\n+'));
  console.log('*** End Patch');
}
