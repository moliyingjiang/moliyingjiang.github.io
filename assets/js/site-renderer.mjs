import { esc, byDate, SECTIONS, STATUSES, ROLES, DATE_TYPES, validateContent } from './content-model.mjs?v=20261007-events';
import { renderNewsPages } from './render-news.mjs?v=20261007-events';
import { applyProfile, validateProfile } from './profile-model.mjs?v=20261007-events';

const profileMark = (slot, value) => '<!-- profile:' + slot + ' -->' + esc(value) + '<!-- /profile:' + slot + ' -->';

const time = date => '<time' + (date.startsWith('≈') ? ' class="estimated-date" title="≈"' : '') + '>' + esc(date) + '</time>';
const recordLink = lang => lang === 'zh' ? '/graduate-cv.html' : '/graduate-record.html';
const school = (stage, lang) => lang === 'zh' ? stage === 'graduate' ? '硕士 · 广西师范大学' : '本科 · 太原学院' : stage === 'graduate' ? 'Master’s · Guangxi Normal University' : 'Undergraduate · Taiyuan University';
const stageHeading = (stage, lang) => '<div class="study-stage-heading"><h2>' + (stage === 'graduate' ? lang === 'zh' ? '硕士' : 'Master’s' : lang === 'zh' ? '本科' : 'Undergraduate') + ' · ' + profileMark(stage + '-school', school(stage, lang).split(' · ')[1]) + '</h2><p>' + profileMark(stage + '-period', stage === 'graduate' ? '2026.08.30 — ' + (lang === 'zh' ? '至今' : 'present') : '2021.10 — 2025.07') + '</p></div>';

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
  const main = '<main class="page-shell awards-page"><p class="eyebrow">' + (zh ? '竞赛、荣誉与创新实践' : 'AWARDS &amp; DISTINCTIONS') + '</p><h1>' + (zh ? '竞赛与荣誉' : 'Awards &amp; distinctions') + '</h1><p class="page-lead">' + (zh ? '按本科与硕士阶段记录竞赛、学业荣誉和创新成果。' : 'Competition results, academic honors, and innovation work, organized by undergraduate and graduate stages.') + '</p>' + stageHeading('undergraduate', lang) + overview(data.totals.undergraduate, lang) + '<div class="awards-context"><span class="news-date-symbol" title="≈">≈</span></div><div class="awards-layout"><aside class="awards-directory"><nav aria-label="' + (zh ? '荣誉分类' : 'Award categories') + '"><p>' + (zh ? '本科 · 太原学院' : 'UNDERGRADUATE · TYU') + '</p>' + Object.entries(SECTIONS).map(([key, title]) => '<a href="#' + key + '">' + esc(title[lang]) + '</a>').join('') + '<a class="graduate-link" href="#graduate">' + (zh ? '硕士阶段' : 'Master’s') + '</a></nav></aside><div class="awards-content" id="undergraduate">' + awardSections(data, 'undergraduate', lang) + '<div class="phase-break"><span>' + (zh ? '硕士阶段 · 2026.08.30 起' : 'GRADUATE STAGE · FROM 2026.08.30') + '</span></div><section id="graduate" class="award-stage">' + stageHeading('graduate', lang) + (graduate ? '' : '<p><a href="' + recordLink(lang) + '">' + (zh ? '硕士阶段档案 →' : 'Graduate record →') + '</a></p>') + '</section>' + (graduate ? (Object.values(data.totals.graduate).some(Boolean) ? overview(data.totals.graduate, lang) : '') + awardSections(data, 'graduate', lang) : '') + '<p class="awards-source"><!-- profile:undergraduate-pdf-link --><a href="/files/undergraduate-cv.pdf">' + (zh ? '本科简历 PDF' : 'Undergraduate CV · PDF') + '</a><!-- /profile:undergraduate-pdf-link --></p></div></div></main>';
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
    ['graduate', zh ? '硕士研究' : 'MASTER’S RESEARCH', zh ? '机器学习与环境系统' : 'Machine learning for environmental systems', zh ? '饮用水处理中的预测建模与模型解释。' : 'Predictive modelling and interpretation for drinking-water treatment.'],
    ['undergraduate', zh ? '本科研究与后续成果' : 'UNDERGRADUATE RESEARCH & FOLLOW-UP', zh ? '视觉感知与机器人系统' : 'Visual perception and robotic systems', zh ? '工业仪表读数、智能诊疗与手眼协调。' : 'Industrial meter reading, AI-assisted diagnosis, and hand-eye coordination.']
  ];
  const body = '<section class="home-research" id="research-overview"><div class="news-heading"><h2>' + (zh ? '研究' : 'Research') + '</h2><a href="' + prefix + '/research.html">' + (zh ? '全部研究与论文 →' : 'All research &amp; papers →') + '</a></div><div class="research-brief-grid">' + items.map(([stage, label, title, text]) => {
    const latest = data.publications.filter(item => item.stage === stage).sort(byDate)[0];
    const paper = latest ? '<div class="home-paper"><p class="home-paper-meta">' + esc(latest[lang].journal) + ' · ' + esc(STATUSES[latest.status][zh ? 0 : 1]) + ' · ' + (latest.dateType === 'authorship' ? esc(DATE_TYPES.authorship[zh ? 0 : 1]) + ' ' : '') + esc(latest.date) + '</p><a href="' + prefix + '/research.html#publication-' + latest.id + '">' + esc(latest[lang].title) + ' ↗</a></div>' : '';
    return '<article><p class="brief-stage">' + esc(label) + '</p><h3><a href="' + prefix + '/research.html#' + stage + '-research">' + profileMark(stage + '-research-title', title) + '</a></h3><p>' + profileMark(stage + '-research-summary', text) + '</p><p class="brief-evidence">' + esc(publicationCounts(data, stage, lang)) + '</p>' + paper + '</article>';
  }).join('') + '</div></section>';
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
  const summary = content.text.split(/\n+/).filter(Boolean).map(text => '<p>' + esc(text) + '</p>').join('');
  return '<article id="project-' + record.id + '"><p class="number">' + esc(content.category) + '</p><h3>' + esc(content.title) + '</h3>' + (record.period ? '<p class="project-period">' + esc(record.period) + '</p>' : '') + '<div class="project-summary">' + summary + '</div>' + (links ? '<div class="project-links">' + links + '</div>' : '') + '</article>';
}
function renderProjects(page, data, lang) {
  const zh = lang === 'zh';
  const rows = stage => data.projects.filter(item => item.stage === stage).map(item => projectRow(item, lang)).join('\n');
  const main = '<main class="page-shell projects-page"><p class="eyebrow">' + (zh ? '研究与工程实践' : 'RESEARCH &amp; ENGINEERING') + '</p><h1>' + (zh ? '项目与技术实践' : 'Research &amp; engineering projects') + '</h1><p class="page-lead">' + (zh ? '本科阶段开展视觉诊断、工业检测与机器人系统实践；硕士阶段关注饮用水处理中的机器学习。' : 'Undergraduate work in visual diagnosis, industrial inspection, and robotic systems; graduate work in machine learning for drinking-water treatment.') + '</p><nav class="section-index" aria-label="' + (zh ? '项目阶段' : 'Project stages') + '"><a href="#undergraduate-projects">' + (zh ? '本科项目' : 'Undergraduate projects') + '</a><a href="#graduate-projects">' + (zh ? '硕士项目' : 'Master’s projects') + '</a></nav><section id="undergraduate-projects" class="study-stage">' + stageHeading('undergraduate', lang) + '<div class="project-page-list">' + rows('undergraduate') + '</div><p class="all-projects"><a data-profile-link="gitee" href="https://gitee.com/YJ-MoLi">' + (zh ? 'Gitee 全部仓库（国内） →' : 'All repositories on Gitee →') + '</a><a data-profile-link="github" href="https://github.com/moliyingjiang">' + (zh ? 'GitHub 全部仓库（国际） →' : 'All repositories on GitHub →') + '</a></p></section><div class="phase-break"><span>' + (zh ? '硕士阶段 · 2026.08.30 起' : 'GRADUATE STAGE · FROM 2026.08.30') + '</span></div><section id="graduate-projects" class="study-stage">' + stageHeading('graduate', lang) + '<div class="project-page-list">' + rows('graduate') + '</div><p><a href="' + recordLink(lang) + '">' + (zh ? '硕士阶段档案 →' : 'Graduate record →') + '</a></p></section></main>';
  return replaceMain(page, main);
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
  return lang === 'en' ? next.replace(/(<!-- \/profile:graduate-research-title -->)。/g, '$1. ') : next;
}
function renderUndergraduateRecord(page, data, lang) {
  const zh = lang === 'zh', prefix = zh ? '/zh' : '';
  const publications = data.publications.filter(item => item.stage === 'undergraduate').sort(byDate).map(item => publicationRow(item, lang)).join('\n');
  const undergraduateLink = zh ? '/undergraduate-cv.html' : '/undergraduate-record.html';
  const thesisAwards = data.awards.filter(item => item.stage === 'undergraduate' && ['university-1', 'university-2'].includes(item.id));
  const thesis = thesisAwards.length ? '<section id="undergraduate-thesis" class="record-section"><h2>' + (zh ? '毕业设计与论文荣誉' : 'Graduation projects &amp; thesis honors') + '</h2><div class="timeline">' + thesisAwards.map(item => '<article><div class="award-date">' + time(item.date) + '</div><div><h3>' + esc(item[lang].title) + '</h3><p>' + esc(item[lang].result) + '</p><p><a href="' + prefix + '/awards.html#' + item.id + '">' + (zh ? '荣誉记录 →' : 'Award record →') + '</a></p></div></article>').join('') + '</div></section>' : '';
  const experiences = data.projects.filter(item => item.stage === 'undergraduate').sort(byDate).map(item => '<article id="experience-' + item.id + '">' + (item.period ? '<time>' + esc(item.period) + '</time>' : '<span aria-hidden="true"></span>') + '<div><h3>' + esc(item[lang].title) + '</h3>' + item[lang].text.split(/\n+/).filter(Boolean).map(text => '<p>' + esc(text) + '</p>').join('') + '<p><a href="' + prefix + '/projects.html#project-' + item.id + '">' + (zh ? '项目说明与相关入口 →' : 'Project details &amp; links →') + '</a></p></div></article>').join('\n');
  const education = '<section id="undergraduate-education" class="record-section"><h2>' + (zh ? '教育与科研训练' : 'Education &amp; research training') + '</h2><p>' + profileMark('undergraduate-cv-summary', zh ? '专业排名前 10%（13/137）。机器人、机械臂、计算机视觉与人工智能方向的科研训练和工程实践。' : 'Top 10% in the major (13/137). Research training and engineering practice in robotics, robotic manipulation, computer vision, and artificial intelligence.') + '</p><p>' + (zh ? '主要课程：机器学习、单片机原理与应用、传感器原理及应用、信号与系统、电路与模拟电子技术。' : 'Coursework: machine learning, microcontrollers, sensors, signals and systems, circuits, and analog electronics.') + '</p><p>' + (zh ? '本科科研导师：' : 'Undergraduate research advisors: ') + profileMark('undergraduate-advisor', zh ? '陈志贤老师（北京大学博士后）；张光华副教授（清华大学博士）' : 'Zhixian Chen (postdoctoral research, Peking University); Associate Professor Guanghua Zhang (Ph.D., Tsinghua University)') + '</p><div class="timeline"><article id="experience-lab"><time>2022.03 — 2025.07</time><div><h3>' + (zh ? '太原学院大数据与人工智能创新实验室' : 'Big Data and Artificial Intelligence Innovation Laboratory, Taiyuan University') + '</h3><p>' + (zh ? '作为实验室成员，参与组会、研究汇报及医疗人工智能、视觉算法与多模态应用相关科研训练。' : 'Participated as a laboratory member; participated in group meetings, research presentations, and research training in medical AI, visual algorithms, and multimodal applications.') + '</p></div></article><article id="experience-academy"><time>2022.03 — 2025.07</time><div><h3>' + (zh ? '山西省“1331工程”大数据智能诊疗产业学院' : 'Shanxi “1331 Project” Big Data Intelligent Diagnosis Industry Academy') + '</h3><p>' + (zh ? '担任组长，参与人工智能培训、开发实践与大学生创新创业训练项目。' : 'Served as group leader and participated in AI training, development practice, and undergraduate innovation-training projects.') + '</p></div></article></div></section>';
  const main = '<main class="page-shell record-detail"><p class="eyebrow">' + (zh ? '本科' : 'UNDERGRADUATE') + ' · ' + profileMark('undergraduate-period', '2021.10 — 2025.07') + '</p><h1>' + (zh ? '本科电子简历' : 'Undergraduate record') + '</h1><p class="page-lead">' + profileMark('undergraduate-school', zh ? '太原学院' : 'Taiyuan University') + ' · ' + profileMark('undergraduate-degree', zh ? '本科 · 物联网工程' : 'B.Eng. · Internet of Things Engineering') + '</p><nav class="section-index" aria-label="' + (zh ? '本科档案目录' : 'Undergraduate record sections') + '"><a href="#undergraduate-education">' + (zh ? '教育与训练' : 'Education') + '</a><a href="#undergraduate-publications">' + (zh ? '论文' : 'Publications') + '</a><a href="#undergraduate-experience">' + (zh ? '项目经历' : 'Projects') + '</a><a href="#undergraduate-awards">' + (zh ? '竞赛与荣誉' : 'Awards') + '</a></nav>' + education + '<section id="undergraduate-publications" class="record-section"><h2>' + (zh ? '论文与研究成果' : 'Manuscripts &amp; publications') + '</h2>' + publications + '</section>' + thesis + '<section id="undergraduate-experience" class="dated-experience"><h2>' + (zh ? '研究、项目与团队经历' : 'Research, projects &amp; team experience') + '</h2><div class="timeline">' + experiences + '</div></section><section id="undergraduate-awards" class="award-summary"><h2>' + (zh ? '竞赛与荣誉' : 'Awards &amp; distinctions') + '</h2>' + overview(data.totals.undergraduate, lang) + '<p><a href="' + prefix + '/awards.html">' + (zh ? '完整荣誉与名次记录 →' : 'Full award &amp; ranking record →') + '</a></p></section><p class="all-projects"><!-- profile:undergraduate-pdf-link --><a href="/files/undergraduate-cv.pdf">' + (zh ? '本科简历 PDF ↗' : 'Undergraduate CV · PDF ↗') + '</a><!-- /profile:undergraduate-pdf-link --><a data-profile-record="undergraduate-' + lang + '" href="' + undergraduateLink + '#undergraduate-education">' + (zh ? '返回档案顶部 ↑' : 'Back to education ↑') + '</a></p></main>';
  return replaceMain(page, main);
}
function renderCvOverview(page, data, lang) {
  const prefix = lang === 'zh' ? '/zh' : '';
  let next = page.replace(/<!-- cv-summary:start -->[\s\S]*?<!-- cv-summary:end -->/g, '');
  const summary = '<!-- cv-summary:start --><section class="record-section"><h2>' + (lang === 'zh' ? '阶段成果索引' : 'Research record by stage') + '</h2><div class="research-brief-grid">' + ['graduate', 'undergraduate'].map(stage => '<article><p class="brief-stage">' + esc(school(stage, lang).split(' · ')[0]) + ' · ' + profileMark(stage + '-school', school(stage, lang).split(' · ')[1]) + '</p><p>' + esc(publicationCounts(data, stage, lang)) + '</p><a href="' + prefix + '/research.html#' + stage + '-research">' + (lang === 'zh' ? '论文与研究 →' : 'Manuscripts &amp; research →') + '</a></article>').join('') + '</div></section><!-- cv-summary:end -->';
  return next.replace('</main>', () => summary + '</main>');
}
function replaceMain(page, main) {
  if (!/<main[\s\S]*?<\/main>/.test(page)) throw new Error('Page template missing.');
  return page.replace(/<main[\s\S]*?<\/main>/, () => main.includes('id="main-content"') ? main : main.replace('<main ', '<main id="main-content" '));
}
export function renderSite(pages, news, portfolio, profile) {
  const errors = [...validateContent(news, portfolio), ...(profile ? validateProfile(profile) : [])];
  if (errors.length) throw new Error(errors.join('\n'));
  const out = { ...pages, ...renderNewsPages(pages, news, portfolio, profile) };
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
  if (profile) {
    for (const path of Object.keys(out).filter(path => path.endsWith('.html'))) {
      const lang = path.startsWith('zh/') || ['undergraduate-cv.html', 'graduate-cv.html'].includes(path) ? 'zh' : 'en';
      out[path] = applyProfile(out[path], lang, profile, path);
    }
    out['assets/data/profile.json'] = JSON.stringify(profile, null, 2) + '\n';
  }
  const languageScript = '<script type="module" src="/assets/js/language-routing.mjs?v=20261006"></script>';
  for (const path of Object.keys(out).filter(path => path.endsWith('.html'))) {
    out[path] = out[path].replace(/<script\b[^>]*src="\/assets\/js\/language-routing\.mjs(?:\?[^\"]*)?"[^>]*><\/script>/g, '').replace('</head>', () => languageScript + '</head>').replace(/editorial\.css\?v=[^"]+/g, 'editorial.css?v=20261007-events');
  }
  return out;
}
