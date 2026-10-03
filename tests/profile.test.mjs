import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EDITABLE_PATHS, PAGE_PATHS } from '../assets/js/content-model.mjs';
import { renderSite } from '../assets/js/site-renderer.mjs';
import { applyProfile, profileSlot, profileFromForm, validateProfile, upgradeDraftBase, PROFILE_PATH } from '../assets/js/profile-model.mjs';
import { changeCount, previewPath } from '../admin/editor-model.mjs';
import { GitHub } from '../admin/github.mjs';
const profile = JSON.parse(fs.readFileSync(PROFILE_PATH));
const news = JSON.parse(fs.readFileSync('assets/data/news.json'));
const portfolio = JSON.parse(fs.readFileSync('assets/data/portfolio.json'));
const pages = Object.fromEntries(PAGE_PATHS.map(path => [path, fs.readFileSync(path, 'utf8')]));

test('all generated pages remain stable and later identity edits replace the original names', () => {
  const first = renderSite(pages, news, portfolio, profile);
  assert.deepEqual(renderSite(first, news, portfolio, profile), first);
  const next = structuredClone(profile);
  next.en.name = 'New Public Name'; next.zh.name = '新的公开署名';
  const output = renderSite(first, news, portfolio, next);
  for (const path of PAGE_PATHS) {
    const zh = path.startsWith('zh/') || path.endsWith('-cv.html');
    assert.ok(output[path].includes(zh ? next.zh.name : next.en.name), path);
    assert.ok(!output[path].includes(profile.en.name), path);
    assert.ok(!output[path].includes(profile.zh.name), path);
    assert.ok(output[path].includes('id="main-content"'), path);
  }
  assert.deepEqual(renderSite(output, news, portfolio, next), output);
});

test('advisor, school, research and CV changes propagate to their public destinations', () => {
  const next = structuredClone(profile);
  next.stages.graduate.en.school = 'Updated University';
  next.stages.graduate.en.advisor = 'Updated Advisor';
  next.stages.graduate.en.researchTitle = 'Updated research direction';
  next.stages.undergraduate.en.cvUrl = '/files/updated-cv.pdf';
  const output = renderSite(pages, news, portfolio, next);
  for (const path of ['index.html','research.html','cv.html','graduate-record.html','awards.html','projects.html','milestones.html']) assert.ok(output[path].includes('Updated University'), path);
  for (const path of ['cv.html','graduate-record.html']) assert.ok(output[path].includes('Updated Advisor'), path);
  assert.ok(output['index.html'].includes('Updated research direction'));
  for (const path of ['cv.html','undergraduate-record.html','awards.html']) assert.ok(output[path].includes('/files/updated-cv.pdf'), path);
  assert.deepEqual(renderSite(output, news, portfolio, next), output);
});

test('profile schema is valid and all personal-data changes have a publishing path', () => {
  assert.deepEqual(validateProfile(profile), []);
  assert.ok(EDITABLE_PATHS.includes(PROFILE_PATH));
  assert.equal(previewPath('profile', 'zh'), 'zh/index.html');
  const next = profileFromForm(profile, [['zh.name', '新署名'], ['en.bio', 'First paragraph.\n\nSecond paragraph.'], ['stages.graduate.zh.advisor', '新导师']]);
  assert.equal(next.zh.name, '新署名');
  assert.deepEqual(next.en.bio, ['First paragraph.', 'Second paragraph.']);
  assert.equal(next.stages.graduate.zh.advisor, '新导师');
  assert.notEqual(profile.zh.name, next.zh.name);
  assert.throws(() => profileFromForm(profile, [['__proto__.polluted', 'x']]), /未知/);
});

test('profile slots remain editable on repeated renders without changing account handles', () => {
  const template = '<title>YJ-MoLi</title><meta property="og:title" content="YJ-MoLi"><a class="brand" href="/">YJ-<span>MoLi</span></a><h1>' + profileSlot('name', 'zh', profile) + '</h1>' + profileSlot('bio', 'zh', profile) + profileSlot('education', 'zh', profile) + '<a href="https://gitee.com/YJ-MoLi">Gitee</a><img src="/assets/images/profile.png" alt="YJ-MoLi"><footer>YJ-MoLi</footer>';
  const first = applyProfile(template, 'zh', profile);
  assert.deepEqual(applyProfile(first, 'zh', profile), first);
  assert.ok(first.includes('href="https://gitee.com/YJ-MoLi"'));
  const next = structuredClone(profile); next.zh.name = '测试公开名'; next.zh.bio = ['A < B & C']; next.avatar = '/assets/images/another.png';
  const second = applyProfile(first, 'zh', next);
  assert.ok(second.includes('测试公开名'));
  assert.ok(!second.includes('许源知'));
  assert.ok(second.includes('A &lt; B &amp; C'));
  assert.ok(second.includes('src="/assets/images/another.png"'));
  assert.ok(second.includes('alt="测试公开名"'));
  assert.ok(second.includes('https://gitee.com/YJ-MoLi'));
});

test('profile URLs reject scripts and regular text never becomes markup', () => {
  for (const value of ['javascript:alert(1)', '//evil.test', '/\\evil.test', 'data:text/html,x']) {
    const next = structuredClone(profile); next.links.scholar = value;
    assert.ok(validateProfile(next).length);
    assert.throws(() => applyProfile('<title>x</title>', 'en', next));
  }
  const next = structuredClone(profile); next.en.name = '<script>alert(1)</script>';
  const result = applyProfile('<title>x</title><h1><!-- profile:name -->old<!-- /profile:name --></h1>', 'en', next);
  assert.ok(result.includes('&lt;script&gt;'));
  assert.ok(!result.includes('<script>'));
});

test('legacy drafts gain profile data without changing the original remote conflict baseline', () => {
  const legacy = JSON.stringify([news, portfolio]);
  const upgraded = upgradeDraftBase(legacy, profile);
  assert.deepEqual(JSON.parse(upgraded), [news, portfolio, profile]);
  assert.equal(upgradeDraftBase(upgraded, profile), upgraded);
  assert.equal(changeCount(upgraded, news, portfolio, profile), 0);
  const next = structuredClone(profile); next.zh.name = '新名字';
  assert.equal(changeCount(upgraded, news, portfolio, next), 1);
  assert.equal(upgradeDraftBase('invalid', profile), 'invalid');
});

test('profile is committed atomically with matching generated pages', async () => {
  const calls = [], replies = [{object:{sha:'old'}}, {sha:'tree'}, {sha:'new'}, {}];
  const client = new GitHub('test', async (url, options) => { calls.push({url,...options}); return {ok:true,json:async()=>replies.shift()}; });
  await client.publish({head:'old',tree:'old-tree',files:{}}, {[PROFILE_PATH]: JSON.stringify(profile), 'index.html':'updated name'});
  const changes = JSON.parse(calls[1].body).tree;
  assert.deepEqual(changes.map(file => file.path).sort(), [PROFILE_PATH, 'index.html'].sort());
  assert.equal(JSON.parse(calls[3].body).force, false);
});
