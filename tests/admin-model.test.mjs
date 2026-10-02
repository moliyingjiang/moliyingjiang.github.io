import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { clone } from '../assets/js/content-model.mjs';
import { previewPath, recordAnchor, findSource, destination, changeCount } from '../admin/editor-model.mjs';
const news = JSON.parse(fs.readFileSync('assets/data/news.json'));
const portfolio = JSON.parse(fs.readFileSync('assets/data/portfolio.json'));

test('preview follows the edited category rather than always opening the homepage', () => {
  assert.equal(previewPath('awards'), 'awards.html');
  assert.equal(previewPath('publications', 'zh'), 'zh/research.html');
  assert.equal(previewPath('projects'), 'projects.html');
  assert.equal(recordAnchor('news', { id: 'ielts' }), 'news-ielts');
  assert.equal(recordAnchor('awards', { id: 'ielts' }), 'ielts');
  assert.match(destination('news', { stage: 'graduate' }), /首页动态、完整时间线 · 硕士/);
  assert.match(destination('awards', { stage: 'graduate' }), /荣誉与资格页 · 硕士/);
});

test('source navigation distinguishes a linked record from a shared award reference', () => {
  const paper = portfolio.publications[0];
  assert.equal(findSource({ sourceType: 'publications', sourceId: paper.id }, portfolio).record.id, paper.id);
  const award = portfolio.awards[0];
  assert.equal(findSource({ award: award.id }, portfolio).referenceOnly, true);
  assert.equal(findSource({ sourceType: 'awards', sourceId: award.id, award: award.id }, portfolio).referenceOnly, undefined);
  assert.equal(findSource({ id: 'unlinked-news' }, portfolio), null);
});

test('draft counter notices additions, deletions and changed content without recounting unchanged records', () => {
  const base = JSON.stringify([news, portfolio]), n = clone(news), p = clone(portfolio);
  assert.equal(changeCount(base, n, p), 0);
  n.events[0].zh.title += ' changed';
  p.awards.pop();
  p.projects.push({ ...p.projects[0], id: 'new-project' });
  assert.equal(changeCount(base, n, p), 3);
  assert.equal(changeCount('invalid', n, p), null);
});
