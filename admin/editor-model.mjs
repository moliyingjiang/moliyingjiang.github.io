export const KIND_NAMES = { news: '动态与足迹', awards: '荣誉与资格', publications: '论文记录', projects: '研究项目' };
export const PAGE_NAMES = {
  'index.html': '首页 · English', 'zh/index.html': '首页 · 中文',
  'milestones.html': '完整时间线 · English', 'zh/milestones.html': '完整时间线 · 中文',
  'awards.html': '荣誉与资格 · English', 'zh/awards.html': '荣誉与资格 · 中文',
  'research.html': '研究与论文 · English', 'zh/research.html': '研究与论文 · 中文',
  'projects.html': '研究项目 · English', 'zh/projects.html': '研究项目 · 中文',
  'graduate-record.html': '硕士档案 · English', 'graduate-cv.html': '硕士档案 · 中文',
  'cv.html': '简历索引 · English', 'zh/cv.html': '简历索引 · 中文',
  'undergraduate-record.html': '本科档案 · English', 'undergraduate-cv.html': '本科档案 · 中文'
};
export function previewPath(kind, language = 'en') {
  const page = { news: 'index.html', awards: 'awards.html', publications: 'research.html', projects: 'projects.html' }[kind];
  return (language === 'zh' ? 'zh/' : '') + page;
}
export function recordAnchor(kind, record) {
  if (!record) return '';
  return kind === 'awards' ? record.id : ({ news: 'news-', publications: 'publication-', projects: 'project-' }[kind] || '') + record.id;
}
export function findSource(item, portfolio) {
  if (!item) return null;
  if (['awards', 'publications', 'projects'].includes(item.sourceType)) {
    const record = portfolio[item.sourceType].find(record => record.id === item.sourceId);
    if (record) return { kind: item.sourceType, record };
  }
  if (item.award) {
    const record = portfolio.awards.find(record => record.id === item.award);
    if (record) return { kind: 'awards', record, referenceOnly: true };
  }
  const paperId = item.id === 'road-paper' ? 'road-crack' : item.id;
  const record = portfolio.publications.find(record => record.id === paperId);
  return record ? { kind: 'publications', record } : null;
}
export function destination(kind, record) {
  const stage = record?.stage === 'graduate' ? '硕士阶段' : record?.stage === 'continuation' || record?.followUp ? '本科项目后续' : '本科阶段';
  const page = { news: '首页动态、完整时间线', awards: '荣誉与资格页', publications: '研究与论文页', projects: '研究项目页' }[kind];
  return page + (record ? ' · ' + stage : '');
}
export function changeCount(base, news, portfolio) {
  let original;
  try { original = JSON.parse(base); } catch { return null; }
  if (!Array.isArray(original) || original.length !== 2) return null;
  const flatten = (n, p) => new Map([
    ...[...n.events, ...n.grouped].map(record => ['news/' + record.id, JSON.stringify(record)]),
    ...['awards', 'publications', 'projects'].flatMap(kind => p[kind].map(record => [kind + '/' + record.id, JSON.stringify(record)])),
    ['totals', JSON.stringify(p.totals)]
  ]);
  const before = flatten(...original), after = flatten(news, portfolio);
  return [...new Set([...before.keys(), ...after.keys()])].filter(id => before.get(id) !== after.get(id)).length;
}
