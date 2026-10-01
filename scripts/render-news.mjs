import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'assets/data/news.json'), 'utf8'));
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const records = [...data.events, ...data.grouped].map((record, order) => ({ ...record, order }));
const byDate = (a, b) => a.date.replace('≈', '').localeCompare(b.date.replace('≈', ''), 'en') || a.order - b.order;
const changes = [];

for (const lang of ['en', 'zh']) {
  const zh = lang === 'zh';
  const prefix = zh ? '/zh' : '';
  const approximate = zh ? '暂估日期' : 'Approximate date';
  const cumulative = zh ? '本科累计' : 'Undergraduate total';
  const date = record => '<div class="news-date"><time' + (record.date.startsWith('≈') ? ' class="estimated-date" title="' + approximate + '"' : '') + '>' + escape(record.date) + '</time>' + (record.cumulative ? '<small class="news-cumulative">' + cumulative + '</small>' : '') + '</div>';
  const homeRow = record => {
    const content = record[lang];
    const title = record.award ? '<a href="' + prefix + '/awards.html#' + record.award + '">' + escape(content.title) + '</a>' : '<strong>' + escape(content.title) + '</strong>';
    return '<article class="news-row" id="news-' + record.id + '">' + date(record) + '<p>' + title + '<br>' + escape(content.text) + '</p></article>';
  };
  const timelineRow = record => {
    const content = record[lang];
    const link = record.award ? ' <a href="' + prefix + '/awards.html#' + record.award + '">' + (zh ? '荣誉记录 →' : 'Award record →') + '</a>' : '';
    return '<li id="news-' + record.id + '">' + date(record) + '<div><h2>' + escape(content.title) + '</h2><p>' + escape(content.text) + link + '</p></div></li>';
  };
  const stage = name => records.filter(record => record.stage === name).sort(byDate);
  const boundary = zh ? '本科结束 · 2025.07' : 'Undergraduate study completed · 2025.07';
  const homeContent = stage('graduate').reverse().map(homeRow).join('\n') + '\n' + stage('continuation').reverse().map(homeRow).join('\n') + '\n<div class="phase">' + boundary + '</div>\n' + stage('undergraduate').reverse().map(homeRow).join('\n');
  const homeSection = '<section class="news-section"><div class="news-heading"><h2>' + (zh ? '动态与足迹' : 'News &amp; milestones') + '</h2><a href="' + prefix + '/milestones.html">' + (zh ? '完整时间线 →' : 'Full timeline →') + '</a><span class="news-date-symbol" title="' + approximate + '" aria-label="' + approximate + '">≈</span></div><div class="news-window" tabindex="0" role="region" aria-label="' + (zh ? '可手动滚动的学术动态' : 'Manually scrollable academic milestones') + '">' + homeContent + '</div></section>';
  const sections = [
    ['undergraduate', zh ? '本科 · 太原学院 · 2021.10 — 2025.07' : 'UNDERGRADUATE · TAIYUAN UNIVERSITY · 2021.10 — 2025.07'],
    ['continuation', zh ? '本科项目延续 · 2025.08 — 2025.11' : 'CONTINUATION OF UNDERGRADUATE PROJECTS · 2025.08 — 2025.11'],
    ['graduate', zh ? '硕士 · 广西师范大学 · 2026.08 — 至今' : 'GRADUATE · GUANGXI NORMAL UNIVERSITY · 2026.08 — PRESENT']
  ];
  const timeline = sections.map(([name, label]) => '<section class="milestone-section' + (name === 'graduate' ? ' graduate-phase' : '') + '"><p class="phase-label">' + label + '</p><ol class="milestone-list">\n' + stage(name).map(timelineRow).join('\n') + '\n</ol></section>' + (name === 'undergraduate' ? '<div class="phase-break"><span>' + boundary + '</span></div>' : '')).join('\n');
  const timelineMain = '<main class="page-shell"><div class="timeline-date-key"><span class="date-legend" title="' + approximate + '" aria-label="' + approximate + '">≈</span></div><p class="eyebrow">' + (zh ? '动态与足迹' : 'NEWS &amp; MILESTONES') + '</p><h1>' + (zh ? '学习与研究足迹' : 'Academic timeline') + '</h1><p class="page-lead">' + (zh ? '自 2021 年 10 月以来的学习、研究、竞赛与荣誉。' : 'Education, research, competitions, and honors since October 2021.') + '</p>\n' + timeline + '</main>';
  for (const [file, pattern, replacement] of [
    [(zh ? 'zh/' : '') + 'index.html', /<section class="news-section">[\s\S]*?<\/section>/, homeSection],
    [(zh ? 'zh/' : '') + 'milestones.html', /<main[\s\S]*?<\/main>/, timelineMain]
  ]) {
    const old = fs.readFileSync(path.join(root, file), 'utf8');
    if (!pattern.test(old)) throw new Error('Missing replacement target: ' + file);
    const next = old.replace(pattern, replacement).replaceAll('site-shell.css?v=20261001-final', 'site-shell.css?v=20261001-news');
    if (next !== old) changes.push({ file, old, next });
  }
}
if (process.argv.includes('--check')) {
  if (changes.length) {
    console.error('News pages need regeneration: ' + changes.map(item => item.file).join(', '));
    process.exitCode = 1;
  } else {
    console.log('All four news pages match the shared bilingual records.');
  }
} else if (changes.length) {
  console.log('*** Begin Patch');
  for (const change of changes) {
    console.log('*** Update File: ' + path.join(root, change.file) + '\n@@\n-' + change.old.trimEnd().split('\n').join('\n-') + '\n+' + change.next.trimEnd().split('\n').join('\n+'));
  }
  console.log('*** End Patch');
}
