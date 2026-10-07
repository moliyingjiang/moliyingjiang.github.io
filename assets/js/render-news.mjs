import { esc as escape, newsCategory } from './content-model.mjs?v=20261007-events';

export function renderNewsPages(pages, data, portfolio, profile) {
// A dated news item describes one occurrence. Summary figures belong on Awards.
const records = data.events.filter(record => !record.cumulative && !(record.sourceType === 'awards' && portfolio?.awards.find(item => item.id === record.sourceId)?.cumulative)).map((record, order) => ({ ...record, order }));
const byDate = (a, b) => a.date.replace('≈', '').localeCompare(b.date.replace('≈', ''), 'en') || a.order - b.order;
const changes = {};

for (const lang of ['en', 'zh']) {
  const zh = lang === 'zh';
  const prefix = zh ? '/zh' : '';
  const approximate = zh ? '暂估日期' : 'Approximate date';
  const mark = (slot, fallback) => '<!-- profile:' + slot + ' -->' + escape(fallback) + '<!-- /profile:' + slot + ' -->';
  const stageInfo = stage => {
    const school = stage === 'graduate' ? zh ? '广西师范大学' : 'Guangxi Normal University' : zh ? '太原学院' : 'Taiyuan University';
    const period = stage === 'graduate' ? '2026.08.30 — ' + (zh ? '至今' : 'present') : '2021.10 — 2025.07';
    return mark(stage + '-school', school) + ' · ' + mark(stage + '-period', period);
  };
  const categories = {
    education: ['教育', 'Education'], research: ['论文与研究', 'Research'], competition: ['竞赛', 'Competition'],
    innovation: ['立项与结题', 'Innovation'], honor: ['荣誉', 'Honor'], software: ['软件著作权', 'Software'],
    qualification: ['资格与语言', 'Qualification'], service: ['团队经历', 'Experience'], other: ['动态', 'News']
  };
  const date = record => '<div class="news-date"><time' + (record.date.startsWith('≈') ? ' class="estimated-date" title="≈"' : '') + '>' + escape(record.date) + '</time><small class="news-kind">' + escape((categories[newsCategory(record, portfolio)] || categories.other)[zh ? 0 : 1]) + '</small></div>';
  const target = record => {
    if (record.award && (!portfolio || portfolio.awards.some(item => item.id === record.award))) return [prefix + '/awards.html#' + record.award, zh ? '荣誉记录 →' : 'Award record →'];
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
    return '<article class="news-row" id="news-' + record.id + '">' + date(record) + '<div class="news-entry"><p class="news-title">' + title + '</p><p class="news-summary">' + escape(content.text) + '</p></div></article>';
  };
  const timelineRow = record => {
    const content = record[lang];
    const detail = target(record);
    const link = detail ? ' <a href="' + escape(detail[0]) + '">' + detail[1] + '</a>' : '';
    return '<li id="news-' + record.id + '">' + date(record) + '<div><h2>' + escape(content.title) + '</h2><p>' + escape(content.text) + link + '</p></div></li>';
  };
  const stage = name => records.filter(record => record.stage === name).sort(byDate);
  const withYears = list => {
    let year = '';
    return list.map(record => {
      const next = record.date.replace('≈', '').slice(0, 4);
      const heading = next !== year ? '<li class="news-year-label" role="presentation"><span>' + escape(next) + '</span></li>' : '';
      year = next;
      return heading + timelineRow(record);
    }).join('\n');
  };
  const boundary = (zh ? '本科结束 · ' : 'Undergraduate study completed · ') + mark('undergraduate-completion', '2025.07');
  const stageHeader = (label, school) => '<div class="news-stage"><strong>' + label + '</strong><span>' + school + '</span></div>';
  const followup = stage('continuation').reverse();
  const homeContent = '<div class="news-stage-group">' + stageHeader(zh ? '硕士阶段' : "Master’s", stageInfo('graduate')) + stage('graduate').reverse().map(homeRow).join('\n') + '</div>\n<div class="news-stage-group">' + stageHeader(zh ? '本科阶段' : 'Undergraduate', stageInfo('undergraduate')) + (followup.length ? '<p class="news-followup-heading">' + (zh ? '本科项目后续' : 'Undergraduate project follow-up') + '</p>' + followup.map(homeRow).join('\n') : '') + '\n<div class="phase">' + boundary + '</div>\n' + stage('undergraduate').reverse().map(homeRow).join('\n') + '</div>';
  const homeSection = '<section class="news-section" id="news"><div class="news-heading"><h2>' + (zh ? '动态与足迹' : 'News &amp; milestones') + '</h2><a href="' + prefix + '/milestones.html">' + (zh ? '完整时间线 →' : 'Full timeline →') + '</a><span class="news-date-symbol" title="' + approximate + '" aria-label="' + approximate + '">≈</span></div><div class="news-window" tabindex="0" role="region" aria-label="' + (zh ? '可手动滚动的学术动态' : 'Manually scrollable academic milestones') + '">' + homeContent + '</div></section>';
  const sections = [
    ['undergraduate', (zh ? '本科 · ' : 'UNDERGRADUATE · ') + stageInfo('undergraduate')],
    ['continuation', zh ? '本科项目后续成果' : 'UNDERGRADUATE RESEARCH FOLLOW-UP'],
    ['graduate', (zh ? '硕士 · ' : 'GRADUATE · ') + stageInfo('graduate')]
  ];
  const timeline = sections.map(([name, label]) => (name === 'graduate' ? '<div class="phase-break"><span>' + (zh ? '硕士阶段开始 · 2026.08.30' : 'GRADUATE STUDY BEGINS · 2026.08.30') + '</span></div>' : '') + '<section id="stage-' + name + '" class="milestone-section' + (name === 'graduate' ? ' graduate-phase' : '') + '"><p class="phase-label">' + label + '</p><ol class="milestone-list">\n' + withYears(stage(name)) + '\n</ol></section>' + (name === 'undergraduate' ? '<div class="phase-break"><span>' + boundary + '</span></div>' : '')).join('\n');
  const timelineMain = '<main id="main-content" class="page-shell study-timeline"><div class="timeline-date-key"><span class="date-legend" title="' + approximate + '" aria-label="' + approximate + '">≈</span></div><p class="eyebrow">' + (zh ? '动态与足迹' : 'NEWS &amp; MILESTONES') + '</p><h1>' + (zh ? '学习与研究足迹' : 'Academic timeline') + '</h1><p class="page-lead">' + (zh ? '学习、研究、竞赛与荣誉，按阶段与时间记录。' : 'Education, research, competitions, and honors, recorded by stage and date.') + '</p><nav class="section-index" aria-label="' + (zh ? '学习阶段' : 'Study stages') + '"><a href="#stage-undergraduate">' + (zh ? '本科阶段' : 'Undergraduate') + '</a><a href="#stage-continuation">' + (zh ? '本科项目后续' : 'Undergraduate follow-up') + '</a><a href="#stage-graduate">' + (zh ? '硕士阶段' : 'Master’s') + '</a></nav>\n' + timeline + '</main>';
  for (const [file, pattern, replacement] of [
    [(zh ? 'zh/' : '') + 'index.html', /<section class="news-section"[^>]*>[\s\S]*?<\/section>/, homeSection],
    [(zh ? 'zh/' : '') + 'milestones.html', /<main[\s\S]*?<\/main>/, timelineMain]
  ]) {
    const old = pages[file];
    if (!pattern.test(old)) throw new Error('Missing replacement target: ' + file);
    const next = old.replace(pattern, () => replacement);
    changes[file] = next;
  }
}

return changes;
}
