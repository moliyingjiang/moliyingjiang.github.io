import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EDITABLE_PATHS, PAGE_PATHS } from '../assets/js/content-model.mjs';
import { renderSite } from '../assets/js/site-renderer.mjs';
import { applyProfile, profileSlot, profileFromForm, validateProfile, upgradeDraftBase, PROFILE_PATH, parseEducationPeriod, syncEducationNews } from '../assets/js/profile-model.mjs';
import { changeCount, previewPath, workspaceProfileGroups, workspaceContains } from '../admin/editor-model.mjs';
import { GitHub } from '../admin/github.mjs';
const profile = JSON.parse(fs.readFileSync(PROFILE_PATH));
const news = JSON.parse(fs.readFileSync('assets/data/news.json'));
const portfolio = JSON.parse(fs.readFileSync('assets/data/portfolio.json'));
const pages = Object.fromEntries(PAGE_PATHS.map(path => [path, fs.readFileSync(path, 'utf8')]));

test('education periods accept common separators and reject invalid or reversed endpoints', () => {
  for (const separator of [' — ', ' – ', ' - ', '-', ' to ', '至']) {
    assert.deepEqual(parseEducationPeriod('2021.10' + separator + '2025.06'), {start:'2021.10',end:'2025.06',ongoing:false});
  }
  assert.deepEqual(parseEducationPeriod('2026.08.30 - present'), {start:'2026.08.30',end:'present',ongoing:true});
  for (const value of ['2026 - present','2026.13 — present','2026.02.30 — present','2026.08 — 2025.06','2021.10 — 2025.02.30']) assert.equal(parseEducationPeriod(value), null, value);
});

test('one-language date edits align the counterpart, educational news, and phase boundaries', () => {
  const next = profileFromForm(profile, [['stages.undergraduate.zh.period','2021.09 - 2025.06'],['stages.graduate.zh.period','2027.09.01 - 至今']]);
  assert.equal(next.stages.undergraduate.en.period, '2021.09 — 2025.06');
  assert.equal(next.stages.graduate.en.period, '2027.09.01 — present');
  const n = structuredClone(news), otherBefore = n.events.filter(item => !['enrol','graduation','masters'].includes(item.id));
  syncEducationNews(n,profile,next);
  assert.equal(n.events.find(item => item.id === 'enrol').date,'2021.09');
  assert.equal(n.events.find(item => item.id === 'graduation').date,'2025.06');
  assert.equal(n.events.find(item => item.id === 'masters').date,'2027.09.01');
  assert.deepEqual(n.events.filter(item => !['enrol','graduation','masters'].includes(item.id)),otherBefore);
  const output = renderSite(pages,n,portfolio,next);
  for (const path of ['index.html','zh/index.html','milestones.html','zh/milestones.html']) {
    assert.ok(output[path].includes('<!-- profile:undergraduate-completion -->2025.06<!-- /profile:undergraduate-completion -->'), path);
    assert.ok(output[path].includes('news-masters'), path);
    assert.ok(!output[path].includes('本科结束 · <!-- profile:undergraduate-completion -->2021.09 - 2025.06'));
  }
  assert.ok(output['milestones.html'].includes('<!-- profile:graduate-enrollment -->2027.09.01<!-- /profile:graduate-enrollment -->'));
  assert.deepEqual(renderSite(output,n,portfolio,next), output);
});

test('inconsistent bilingual education dates are rejected rather than published', () => {
  const next=structuredClone(profile); next.stages.undergraduate.en.period='2021.10 — 2025.06';
  assert.ok(validateProfile(next).some(error=>error.includes('中英文阶段起止日期须一致')));
  assert.throws(()=>profileFromForm(profile,[['stages.undergraduate.en.period','2021.10 — 2025.06'],['stages.undergraduate.zh.period','2021.10 — 2025.05']]),/中英文阶段起止日期须一致/);
});

test('edited project responsibilities and periods propagate to bilingual project pages', () => {
  const next = structuredClone(portfolio);
  const project = next.projects.find(item => item.id === 'hand-eye');
  project.period = '2024.03 — 2025.09';
  project.en.text = 'Updated personal contribution: A < B & C.\nA second paragraph.';
  project.zh.text = '更新后的个人工作：A < B & C。\n第二段工作说明。';
  const output = renderSite(pages, news, next, profile);
  for (const path of ['projects.html', 'zh/projects.html']) {
    assert.ok(output[path].includes('2024.03 — 2025.09'), path);
    assert.ok(output[path].includes('A &lt; B &amp; C'), path);
  }
  assert.ok(output['projects.html'].includes('id="project-hand-eye"'));
  assert.ok(!output['zh/projects.html'].includes('/undergraduate-cv.html#experience-hand-eye'));
  assert.ok(output['zh/cv.html'].includes('/files/undergraduate-cv.pdf'));
  assert.deepEqual(renderSite(output, news, next, profile), output);
});

test('palm diagnosis is the research project, coagulant work is a publication, and undergraduate PDF stays in CV', () => {
  const output = renderSite(pages, news, portfolio, profile);
  for (const language of ['research.html', 'zh/research.html']) {
    assert.ok(output[language].includes('project-palm-diagnosis'));
    assert.ok(!output[language].includes('project-coagulant-dosage'));
    assert.ok(output[language].includes('publication-sustainability'));
    assert.ok(!output[language].includes('/files/undergraduate-cv.pdf'));
  }
  for (const language of ['projects.html', 'zh/projects.html']) {
    assert.ok(!output[language].includes('project-palm-diagnosis'));
    assert.ok(!output[language].includes('project-coagulant-dosage'));
    assert.ok(output[language].includes('github.com/moliyingjiang/Open-Eye'));
  }
  for (const language of ['cv.html', 'zh/cv.html']) {
    assert.ok(output[language].includes('/files/undergraduate-cv.pdf'));
    assert.ok(!output[language].includes('/undergraduate-record.html'));
    assert.ok(!output[language].includes('/undergraduate-cv.html'));
  }
  for (const language of ['awards.html', 'zh/awards.html']) assert.ok(!output[language].includes('/files/undergraduate-cv.pdf'));
  assert.equal(previewPath('projects', 'zh', portfolio.projects.find(item => item.id === 'palm-diagnosis')), 'zh/research.html');
});

test('undergraduate and graduate profile edits remain independent', () => {
  const next = profileFromForm(profile, [['stages.graduate.zh.researchSummary', '新的硕士研究方向']]);
  assert.equal(next.stages.graduate.zh.researchSummary, '新的硕士研究方向');
  assert.deepEqual(next.stages.undergraduate, profile.stages.undergraduate);
});

test('graduate status uses the verified 083000 field without claiming an awarded science degree', () => {
  const output = renderSite(pages, news, portfolio, profile);
  assert.ok(output['cv.html'].includes('Environmental Science and Engineering (083000)'));
  assert.ok(output['zh/cv.html'].includes('环境科学与工程（083000）'));
  for (const page of ['index.html', 'milestones.html', 'cv.html']) assert.ok(!output[page].includes('M.Sc.'));
});

test('backend workspaces keep undergraduate, graduate and shared records distinct', () => {
  assert.deepEqual(workspaceProfileGroups('undergraduate'), ['undergraduate']);
  assert.deepEqual(workspaceProfileGroups('graduate'), ['graduate']);
  assert.deepEqual(workspaceProfileGroups('global'), ['identity', 'links']);
  assert.equal(workspaceContains({stage:'continuation'}, 'undergraduate'), true);
  assert.equal(workspaceContains({stage:'graduate'}, 'undergraduate'), false);
  assert.equal(workspaceContains({stage:'undergraduate'}, 'graduate'), false);
  assert.equal(workspaceContains({stage:'graduate'}, 'graduate'), true);
});

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
  for (const path of ['index.html','research.html','cv.html','milestones.html','practice.html']) assert.ok(output[path].includes('Updated University'), path);
  assert.ok(output['cv.html'].includes('Updated Advisor'));
  assert.ok(output['index.html'].includes('Updated research direction'));
  assert.ok(output['cv.html'].includes('/files/updated-cv.pdf'));
  assert.ok(!output['research.html'].includes('/files/updated-cv.pdf'));
  assert.ok(!output['awards.html'].includes('/files/updated-cv.pdf'));
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
