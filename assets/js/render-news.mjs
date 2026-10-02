export function renderNewsPages(pages, data, portfolio) {
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const records = [...data.events, ...data.grouped].map((record, order) => ({ ...record, order }));
const byDate = (a, b) => a.date.replace('≈', '').localeCompare(b.date.replace('≈', ''), 'en') || a.order - b.order;
const changes = {};

for (const lang of ['en', 'zh']) {
  const zh = lang === 'zh';
  const prefix = zh ? '/zh' : '';
  const approximate = zh ? '暂估日期' : 'Approximate date';
  const cumulative = record => record.stage === 'graduate' ? zh ? '硕士累计' : 'Graduate total' : zh ? '本科累计' : 'Undergraduate total';
  const date = record => '<div class="news-date"><time' + (record.date.startsWith('≈') ? ' class="estimated-date" title="' + approximate + '"' : '') + '>' + escape(record.date) + '</time>' + (record.cumulative ? '<small class="news-cumulative">' + cumulative(record) + '</small>' : record.stage === 'continuation' ? '<small class="news-cumulative">' + (zh ? '本科项目后续' : 'Undergraduate follow-up') + '</small>' : '') + '</div>';
  const target = record => {
    if (record.award) return [prefix + '/awards.html#' + record.award, zh ? '荣誉记录 →' : 'Award record →'];
    const legacy = { sustainability: 'sustainability', measurement: 'measurement', 'road-paper': 'road-crack' };
    const paperId = record.sourceType === 'publications' ? record.sourceId : legacy[record.id];
    if (paperId && (!portfolio || portfolio.publications.some(item => item.id === paperId))) return [prefix + '/research.html#publication-' + paperId, zh ? '论文记录 →' : 'Publication record →'];
    if (record.sourceType === 'projects' && record.sourceId && (!portfolio || portfolio.projects.some(item => item.id === record.sourceId))) return [prefix + '/projects.html#project-' + record.sourceId, zh ? '项目记录 →' : 'Project record →'];
    return null;
  };
  const homeRow = record => {
    const content = record[lang];
    const link = target(record);
    const title = link ? '<a href="' + escape(link[0]) + '">' + escape(content.title) + '</a>' : '<strong>' + escape(content.title) + '</strong>';
    return '<article class="news-row" id="news-' + record.id + '">' + date(record) + '<p>' + title + '<br>' + escape(content.text) + '</p></article>';
  };
  const timelineRow = record => {
    const content = record[lang];
    const detail = target(record);
    const link = detail ? ' <a href="' + escape(detail[0]) + '">' + detail[1] + '</a>' : '';
    return '<li id="news-' + record.id + '">' + date(record) + '<div><h2>' + escape(content.title) + '</h2><p>' + escape(content.text) + link + '</p></div></li>';
  };
  const stage = name => records.filter(record => record.stage === name).sort(byDate);
  const boundary = zh ? '本科结束 · 2025.07' : 'Undergraduate study completed · 2025.07';
  const stageHeader = (label, school) => '<div class="news-stage"><strong>' + label + '</strong><span>' + school + '</span></div>';
  const homeContent = '<div class="news-stage-group">' + stageHeader(zh ? '硕士阶段' : "Master’s", zh ? '广西师范大学 · 2026.08 — 至今' : 'Guangxi Normal University · 2026.08 — present') + stage('graduate').reverse().map(homeRow).join('\n') + '</div>\n<div class="news-stage-group">' + stageHeader(zh ? '本科阶段' : 'Undergraduate', zh ? '太原学院 · 2021.10 — 2025.07' : 'Taiyuan University · 2021.10 — 2025.07') + stage('continuation').reverse().map(homeRow).join('\n') + '\n<div class="phase">' + boundary + '</div>\n' + stage('undergraduate').reverse().map(homeRow).join('\n') + '</div>';
  const homeSection = '<section class="news-section" id="news"><div class="news-heading"><h2>' + (zh ? '动态与足迹' : 'News &amp; milestones') + '</h2><a href="' + prefix + '/milestones.html">' + (zh ? '完整时间线 →' : 'Full timeline →') + '</a><span class="news-date-symbol" title="' + approximate + '" aria-label="' + approximate + '">≈</span></div><div class="news-window" tabindex="0" role="region" aria-label="' + (zh ? '可手动滚动的学术动态' : 'Manually scrollable academic milestones') + '">' + homeContent + '</div></section>';
  const sections = [
    ['undergraduate', zh ? '本科 · 太原学院 · 2021.10 — 2025.07' : 'UNDERGRADUATE · TAIYUAN UNIVERSITY · 2021.10 — 2025.07'],
    ['continuation', zh ? '本科项目后续成果' : 'UNDERGRADUATE RESEARCH FOLLOW-UP'],
    ['graduate', zh ? '硕士 · 广西师范大学 · 2026.08 — 至今' : 'GRADUATE · GUANGXI NORMAL UNIVERSITY · 2026.08 — PRESENT']
  ];
  const timeline = sections.map(([name, label]) => (name === 'graduate' ? '<div class="phase-break"><span>' + (zh ? '硕士阶段开始 · 2026.08.30' : 'GRADUATE STUDY BEGINS · 2026.08.30') + '</span></div>' : '') + '<section id="stage-' + name + '" class="milestone-section' + (name === 'graduate' ? ' graduate-phase' : '') + '"><p class="phase-label">' + label + '</p><ol class="milestone-list">\n' + stage(name).map(timelineRow).join('\n') + '\n</ol></section>' + (name === 'undergraduate' ? '<div class="phase-break"><span>' + boundary + '</span></div>' : '')).join('\n');
  const timelineMain = '<main class="page-shell study-timeline"><div class="timeline-date-key"><span class="date-legend" title="' + approximate + '" aria-label="' + approximate + '">≈</span></div><p class="eyebrow">' + (zh ? '动态与足迹' : 'NEWS &amp; MILESTONES') + '</p><h1>' + (zh ? '学习与研究足迹' : 'Academic timeline') + '</h1><p class="page-lead">' + (zh ? '自 2021 年 10 月以来的学习、研究、竞赛与荣誉。' : 'Education, research, competitions, and honors since October 2021.') + '</p><nav class="section-index" aria-label="' + (zh ? '学习阶段' : 'Study stages') + '"><a href="#stage-undergraduate">' + (zh ? '本科阶段' : 'Undergraduate') + '</a><a href="#stage-continuation">' + (zh ? '本科项目后续' : 'Undergraduate follow-up') + '</a><a href="#stage-graduate">' + (zh ? '硕士阶段' : 'Master’s') + '</a></nav>\n' + timeline + '</main>';
  for (const [file, pattern, replacement] of [
    [(zh ? 'zh/' : '') + 'index.html', /<section class="news-section"[^>]*>[\s\S]*?<\/section>/, homeSection],
    [(zh ? 'zh/' : '') + 'milestones.html', /<main[\s\S]*?<\/main>/, timelineMain]
  ]) {
    const old = pages[file];
    if (!pattern.test(old)) throw new Error('Missing replacement target: ' + file);
    const next = old.replace(pattern, () => replacement).replace(/site-shell\.css\?v=[^"]+/g, 'site-shell.css?v=20261001-stages');
    changes[file] = next;
  }
}

return changes;
}
