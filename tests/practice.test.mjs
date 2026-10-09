import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PAGE_PATHS } from '../assets/js/content-model.mjs';
import { renderSite } from '../assets/js/site-renderer.mjs';
import { previewPath, recordAnchor } from '../admin/editor-model.mjs';
test('practice is separate from projects, bilingual and editable in preview', () => {
  const read = path => fs.readFileSync(path, 'utf8');
  const portfolio = JSON.parse(read('assets/data/portfolio.json'));
  const output = renderSite(Object.fromEntries(PAGE_PATHS.map(path => [path, read(path)])), JSON.parse(read('assets/data/news.json')), portfolio, JSON.parse(read('assets/data/profile.json')));
  for (const prefix of ['', 'zh/']) {
    assert.ok(!output[prefix + 'projects.html'].includes('id="project-robocup"'));
    for (const id of ['robocup', 'lab', 'academy', 'masters-class-monitor']) assert.ok(output[prefix + 'practice.html'].includes('id="practice-' + id + '"'));
    assert.ok(output[prefix + 'practice.html'].includes('id="undergraduate-practice"'));
    assert.ok(output[prefix + 'practice.html'].includes('id="graduate-practice"'));
  }
  const record = portfolio.projects.find(item => item.id === 'masters-class-monitor');
  assert.equal(previewPath('projects', 'zh', record), 'zh/practice.html');
  assert.equal(recordAnchor('projects', record), 'practice-masters-class-monitor');
  record.zh.text = '更新班长实践说明';
  const updated = renderSite(output, JSON.parse(read('assets/data/news.json')), portfolio, JSON.parse(read('assets/data/profile.json')));
  assert.ok(updated['zh/practice.html'].includes('更新班长实践说明'));
  assert.ok(updated['zh/practice.html'].includes('更新班长实践说明'));
  assert.deepEqual(renderSite(updated, JSON.parse(read('assets/data/news.json')), portfolio, JSON.parse(read('assets/data/profile.json'))), updated);
});
