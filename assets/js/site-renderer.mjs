import { esc, byDate, SECTIONS, STATUSES, ROLES, DATE_TYPES, validateContent } from './content-model.mjs';
import { renderNewsPages } from './render-news.mjs';

const time = date => '<time' + (date.startsWith('≈') ? ' class="estimated-date" title="≈"' : '') + '>' + esc(date) + '</time>';
const recordLink = lang => lang === 'zh' ? '/graduate-cv.html' : '/graduate-record.html';
const school = (stage, lang) => lang === 'zh' ? stage === 'graduate' ? '硕士 · 广西师范大学' : '本科 · 太原学院' : stage === 'graduate' ? 'Master’s · Guangxi Normal University' : 'Undergraduate · Taiyuan University';
const stageHeading = (stage, lang) => '<div class="study-stage-heading"><h2>' + school(stage, lang) + '</h2><p>' + (stage === 'graduate' ? '2026.08.30 — ' + (lang === 'zh' ? '至今' : 'present') : '2021.10 — 2025.07') + '</p></div>';

function overview(totals, lang) {
  const zh = lang === 'zh';
  const records = [
    [totals.nationalAwards + totals.nationalInnovation, zh ? '国家级荣誉' : 'National-level distinctions', zh ? '竞赛奖 ' + totals.nationalAwards + ' 项 · 大创立项 ' + totals.nationalInnovation + ' 项' : totals.nationalAwards + ' competition awards · ' + totals.nationalInnovation + ' innovation projects'],
    [totals.provincialAwards + totals.provincialInnovation, zh ? '省级荣誉' : 'Provincial-level distinctions', zh ? '竞赛奖 ' + totals.provincialAwards + ' 项 · 大创立项 ' + totals.provincialInnovation + ' 项' : totals.provincialAwards + ' competition awards · ' + totals.provincialInnovation + ' innovation projects'],
    [totals.scholarships, zh ? '校级奖学金' : 'University scholarships', ''],
    [totals.software, zh ? '软件著作权' : 'Registered software works', '']
  ];
  return '<dl class="awards-overview">' + records.map(([number, label, detail]) => '<div><dt>' + esc(label) + (detail ? '<small>' + esc(detail) + '</small>' : '') + '</dt><dd>' + number + '</dd></div>').join('') + '</dl>';
}
function awardRow(record, lang) {
  const content = record[lang];
  return '<article id="' + record.id + '"><div class="award-date">' + time(record.date) + (record.cumulative ? '<small>' + (lang === 'zh' ? '累计' : 'Cumulative') + '</small>' : '') + '</div><div><h3>' + esc(content.title) + '</h3><p class="award-result">' + esc(content.result) + '</p>' + (content.rank ? '<p class="award-rank"><span>' + esc(content.rankLabel) + '</span><strong>' + esc(content.rank) + '</strong></p>' : '') + '</div></article>';
}
function awardSections(data, stage, lang) {
  return Object.entries(SECTIONS).map(([key, title]) => {
    const records = data.awards.filter(item => item.stage === stage && item.section === key).sort(byDate);
    if (!records.length && stage === 'graduate') return '';
    const id = stage === 'graduate' ? 'graduate-' + key : key;
    return '<section id="' + id + '" class="award-stage"><div class="section-heading"><h2>' + esc(title[lang]) + '</h2></div><div class="timeline">\n' + records.map(item => awardRow(item, lang)).join('\n') + '\n</div></section>';
  }).join('\n');
}
function renderAwards(page, data, lang) {
  const zh = lang === 'zh';
  const graduate = data.awards.some(item => item.stage === 'graduate');
  const main = '<main class="page-shell awards-page"><p class="eyebrow">' + (zh ? '竞赛、荣誉与创新实践' : 'AWARDS &amp; DISTINCTIONS') + '</p><h1>' + (zh ? '竞赛与荣誉' : 'Awards &amp; distinctions') + '</h1><p class="page-lead">' + (zh ? '按本科与硕士阶段记录竞赛、学业荣誉和创新成果。' : 'Competition results, academic honors, and innovation work, organized by undergraduate and graduate stages.') + '</p>' + stageHeading('undergraduate', lang) + overview(data.totals.undergraduate, lang) + '<div class="awards-context"><span class="news-date-symbol" title="≈">≈</span></div><div class="awards-layout"><aside class="awards-directory"><nav aria-label="' + (zh ? '荣誉分类' : 'Award categories') + '"><p>' + (zh ? '本科 · 太原学院' : 'UNDERGRADUATE · TYU') + '</p>' + Object.entries(SECTIONS).map(([key, title]) => '<a href="#' + key + '">' + esc(title[lang]) + '</a>').join('') + '<a class="graduate-link" href="#graduate">' + (zh ? '硕士阶段' : 'Master’s') + '</a></nav></aside><div class="awards-content" id="undergraduate">' + awardSections(data, 'undergraduate', lang) + '<div class="phase-break"><span>' + (zh ? '硕士阶段 · 2026.08.30 起' : 'GRADUATE STAGE · FROM 2026.08.30') + '</span></div><section id="graduate" class="award-stage">' + stageHeading('graduate', lang) + (graduate ? '' : '<p><a href="' + recordLink(lang) + '">' + (zh ? '硕士阶段档案 →' : 'Graduate record →') + '</a></p>') + '</section>' + (graduate ? (Object.values(data.totals.graduate).some(Boolean) ? overview(data.totals.graduate, lang) : '') + awardSections(data, 'graduate', lang) : '') + '<p class="awards-source"><a href="/files/undergraduate-cv.pdf">' + (zh ? '本科简历 PDF' : 'Undergraduate CV · PDF') + '</a></p></div></div></main>';
  return replaceMain(page, main);
}
export function publicationRow(record, lang) {
  const zh = lang === 'zh', content = record[lang], index = zh ? 0 : 1;
  const meta = '<div class="publication-meta"><span class="publication-state" data-status="' + record.status + '">' + STATUSES[record.status][index] + '</span><span>' + ROLES[record.role][index] + '</span>' + (record.followUp ? '<span>' + (zh ? '本科研究后续' : 'Undergraduate research follow-up') + '</span>' : '') + '</div>';
  return '<article class="publication-record" id="publication-' + record.id + '">' + meta + '<h3>' + (record.url ? '<a href="' + esc(record.url) + '">' + esc(content.title) + '</a>' : esc(content.title)) + '</h3><p class="publication-venue"><em>' + esc(content.journal) + '</em> · ' + DATE_TYPES[record.dateType][index] + ': ' + time(record.date) + '</p>' + (content.summary ? '<p>' + esc(content.summary) + '</p>' : '') + (content.metrics ? '<details class="publication-metrics"><summary>' + (zh ? '期刊分区 · JCR' : 'Journal classification · JCR') + '</summary><p class="journal-metrics">' + esc(content.metrics) + (record.metricsSource ? ' · <a href="' + esc(record.metricsSource) + '">' + (zh ? '分区来源' : 'Source') + '</a>' : '') + '</p></details>' : '') + '</article>';
}
function publicationCounts(data, stage, lang) {
  const records = data.publications.filter(item => item.stage === stage);
  return Object.entries(STATUSES).map(([status, label]) => {
    const count = records.filter(item => item.status === status).length;
    if (!count) return '';
    return lang === 'zh' ? count + ' 篇' + label[0] : count + ' ' + label[1].toLowerCase() + (status === 'published' ? count === 1 ? ' article' : ' articles' : count === 1 ? ' manuscript' : ' manuscripts');
  }).filter(Boolean).join(' · ');
}
function renderHomeOverview(page, data, lang) {
  const zh = lang === 'zh', prefix = zh ? '/zh' : '';
  const items = [
    ['graduate', zh ? '硕士 · 环境科学与工程' : 'MASTER’S · ENVIRONMENTAL SCIENCE &amp; ENGINEERING', zh ? '机器学习与环境系统' : 'Machine learning for environmental systems', zh ? '饮用水处理中的预测建模与模型解释。' : 'Predictive modelling and interpretation for drinking-water treatment.'],
    ['undergraduate', zh ? '本科 · 物联网工程' : 'UNDERGRADUATE · INTERNET OF THINGS ENGINEERING', zh ? '视觉感知与机器人系统' : 'Visual perception and robotic systems', zh ? '工业仪表读数、智能诊疗与手眼协调。' : 'Industrial meter reading, AI-assisted diagnosis, and hand-eye coordination.']
  ];
  const body = '<section class="home-research" id="research-overview"><div class="news-heading"><h2>' + (zh ? '研究概览' : 'Research overview') + '</h2><a href="' + prefix + '/research.html">' + (zh ? '研究与论文 →' : 'Research &amp; papers →') + '</a></div><div class="research-brief-grid">' + items.map(([stage, label, title, text]) => '<article><p class="brief-stage">' + label + '</p><h3><a href="' + prefix + '/research.html#' + stage + '-research">' + title + '</a></h3><p>' + text + '</p><p class="brief-evidence">' + esc(publicationCounts(data, stage, lang)) + '</p></article>').join('') + '</div></section>';
  if (page.includes('id="research-overview"')) return page.replace(/<section class="home-research"[\s\S]*?<\/section>/, () => body);
  return page.replace(/<section class="news-section"/, () => body + '<section class="news-section"');
}
function researchStage(page, stage, data, lang) {
  const pattern = new RegExp('<section id="' + stage + '-research"[\\s\\S]*?<\\/section>');
  const section = page.match(pattern)?.[0];
  if (!section) throw new Error('Research template missing: ' + stage);
  const records = data.publications.filter(item => item.stage === stage).sort(byDate).map(item => publicationRow(item, lang)).join('\n');
  const counts = publicationCounts(data, stage, lang);
  const marker = '<!-- publications:start -->\n' + (counts ? '<p class="publication-overview">' + esc(counts) + '</p>\n' : '') + records + '\n<!-- publications:end -->';
  let next;
  if (section.includes('<!-- publications:start -->')) next = section.replace(/<!-- publications:start -->[\s\S]*?<!-- publications:end -->/, () => marker);
  else {
    let first = true;
    next = section.replace(/<article class="publication-record"[^>]*>[\s\S]*?<\/article>/g, () => { if (!first) return ''; first = false; return marker; });
    if (first) throw new Error('Publication template missing: ' + stage);
  }
  return page.replace(section, () => next);
}
function projectRow(record, lang) {
  const content = record[lang];
  const links = [record.gitee ? '<a href="' + esc(record.gitee) + '">Gitee ↗</a>' : '', record.github ? '<a href="' + esc(record.github) + '">GitHub ↗</a>' : '', content.moreUrl ? '<a href="' + esc(content.moreUrl) + '">' + esc(content.moreLabel || (lang === 'zh' ? '了解更多' : 'Details')) + '</a>' : ''].filter(Boolean).join('');
  return '<article id="project-' + record.id + '"><p class="number">' + esc(content.category) + '</p><h2>' + esc(content.title) + '</h2>' + (record.period ? '<p class="project-period">' + esc(record.period) + '</p>' : '') + '<p>' + esc(content.text) + '</p>' + (links ? '<div>' + links + '</div>' : '') + '</article>';
}
function renderProjects(page, data, lang) {
  const rows = stage => data.projects.filter(item => item.stage === stage).map(item => projectRow(item, lang)).join('\n');
  const pattern = /<div class="project-page-list">[\s\S]*?<\/div>(?=<p class="all-projects">)/;
  if (!pattern.test(page)) throw new Error('Undergraduate project template missing.');
  let next = page.replace(pattern, () => '<div class="project-page-list">' + rows('undergraduate') + '</div>');
  const graduate = /<section (?:id="graduate-projects" )?class="study-stage">[\s\S]*?<\/section>/;
  if (!graduate.test(next)) throw new Error('Graduate project template missing.');
  const body = '<section id="graduate-projects" class="study-stage">' + stageHeading('graduate', lang) + '<div class="project-page-list">' + rows('graduate') + '</div><p><a href="' + recordLink(lang) + '">' + (lang === 'zh' ? '硕士阶段档案 →' : 'Graduate record →') + '</a></p></section>';
  return next.replace(graduate, () => body);
}
function renderGraduateRecord(page, data, lang) {
  const publications = data.publications.filter(item => item.stage === 'graduate').sort(byDate).map(item => publicationRow(item, lang)).join('\n');
  const pattern = /<section (?:id="graduate-publications" )?class="record-section">[\s\S]*?<\/section>/g;
  let replaced = false;
  const next = page.replace(pattern, section => {
    if (!section.includes('class="publication-record"') && !section.includes('id="graduate-publications"')) return section;
    replaced = true;
    return '<section id="graduate-publications" class="record-section"><h2>' + (lang === 'zh' ? '论文记录' : 'Manuscripts &amp; publications') + '</h2>' + publications + '</section>';
  });
  if (!replaced) throw new Error('Graduate publication template missing.');
  return next;
}
function renderUndergraduateRecord(page, data, lang) {
  const zh = lang === 'zh', prefix = zh ? '/zh' : '';
  const publications = data.publications.filter(item => item.stage === 'undergraduate').sort(byDate).map(item => publicationRow(item, lang)).join('\n');
  const section = '<section id="undergraduate-publications" class="record-section"><h2>' + (zh ? '论文与研究成果' : 'Manuscripts &amp; publications') + '</h2>' + publications + '</section>';
  let next = page;
  if (next.includes('id="undergraduate-publications"')) next = next.replace(/<section id="undergraduate-publications"[\s\S]*?<\/section>/, () => section);
  else {
    if (zh) {
      next = next.replace(/<article><div><h3>(?:工业仪表自动读数大\/小模型级联方法|基于 YOLOv8 的轻量化道路裂缝检测模型)<\/h3>[\s\S]*?<\/article>/g, '');
      next = next.replace('<h2>论文、毕业设计与科研项目</h2>', '<h2>毕业设计与科研项目</h2>');
    } else next = next.replace(/<p>Co-authored industrial pointer-meter manuscript[\s\S]*?<\/p>/, '');
    next = next.replace('<section class="dated-experience">', () => section + '<section class="dated-experience">');
  }
  const totals = data.totals.undergraduate;
  const honors = '<section class="award-summary"><h2>' + (zh ? '竞赛与荣誉' : 'Awards and distinctions') + '</h2>' + overview(totals, lang) + '<p><a href="' + prefix + '/awards.html">' + (zh ? '完整荣誉记录 →' : 'Full award record →') + '</a></p></section>';
  next = next.replace(/<section class="award-summary">[\s\S]*?<\/section>/, () => honors);
  if (zh) next = next.replace(/<section><h2>代表性竞赛与成果<\/h2>[\s\S]*?<\/section>/, '');
  return next;
}
function renderCvOverview(page, data, lang) {
  const prefix = lang === 'zh' ? '/zh' : '';
  let next = page.replace(/<!-- cv-summary:start -->[\s\S]*?<!-- cv-summary:end -->/g, '');
  const summary = '<!-- cv-summary:start --><section class="record-section"><h2>' + (lang === 'zh' ? '阶段成果索引' : 'Research record by stage') + '</h2><div class="research-brief-grid">' + ['graduate', 'undergraduate'].map(stage => '<article><p class="brief-stage">' + school(stage, lang) + '</p><p>' + esc(publicationCounts(data, stage, lang)) + '</p><a href="' + prefix + '/research.html#' + stage + '-research">' + (lang === 'zh' ? '论文与研究 →' : 'Manuscripts &amp; research →') + '</a></article>').join('') + '</div></section><!-- cv-summary:end -->';
  return next.replace('</main>', () => summary + '</main>');
}
function replaceMain(page, main) {
  if (!/<main[\s\S]*?<\/main>/.test(page)) throw new Error('Page template missing.');
  return page.replace(/<main[\s\S]*?<\/main>/, () => main);
}
export function renderSite(pages, news, portfolio) {
  const errors = validateContent(news, portfolio);
  if (errors.length) throw new Error(errors.join('\n'));
  const out = { ...pages, ...renderNewsPages(pages, news, portfolio) };
  for (const lang of ['en', 'zh']) {
    const prefix = lang === 'zh' ? 'zh/' : '';
    out[prefix + 'awards.html'] = renderAwards(pages[prefix + 'awards.html'], portfolio, lang);
    out[prefix + 'research.html'] = researchStage(researchStage(pages[prefix + 'research.html'], 'graduate', portfolio, lang), 'undergraduate', portfolio, lang);
    out[prefix + 'projects.html'] = renderProjects(pages[prefix + 'projects.html'], portfolio, lang);
    out[prefix + 'index.html'] = renderHomeOverview(out[prefix + 'index.html'], portfolio, lang);
    out[prefix + 'cv.html'] = renderCvOverview(pages[prefix + 'cv.html'], portfolio, lang);
    const undergraduate = lang === 'zh' ? 'undergraduate-cv.html' : 'undergraduate-record.html';
    out[undergraduate] = renderUndergraduateRecord(pages[undergraduate], portfolio, lang);
    const graduate = lang === 'zh' ? 'graduate-cv.html' : 'graduate-record.html';
    out[graduate] = renderGraduateRecord(pages[graduate], portfolio, lang);
  }
  out['assets/data/news.json'] = JSON.stringify(news, null, 2) + '\n';
  out['assets/data/portfolio.json'] = JSON.stringify(portfolio, null, 2) + '\n';
  return out;
}
