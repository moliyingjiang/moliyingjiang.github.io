export const KIND_NAMES = { profile: '个人资料', news: '动态与足迹', awards: '荣誉与资格', publications: '论文记录', projects: '研究项目' };
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
  const page = { profile: 'index.html', news: 'index.html', awards: 'awards.html', publications: 'research.html', projects: 'projects.html' }[kind];
  return (language === 'zh' ? 'zh/' : '') + page;
}
export function recordAnchor(kind, record) {
  if (!record || kind === 'profile') return '';
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
    if (record && !record.cumulative) return { kind: 'awards', record, referenceOnly: true };
  }
  if (item.detachedSource) return null;
  const paperId = item.id === 'road-paper' ? 'road-crack' : item.id;
  const record = portfolio.publications.find(record => record.id === paperId);
  return record ? { kind: 'publications', record } : null;
}
export function newsState(item, portfolio) {
  if (item.cumulative) return 'archived';
  if (findSource(item, portfolio)) return 'linked';
  if (item.detachedSource) return 'detached';
  return 'independent';
}
export function upgradeContentBase(base, currentProfile) {
  try {
    const data = JSON.parse(base);
    if (!Array.isArray(data) || ![2, 3].includes(data.length)) return base;
    upgradeLinkedNews(data[0], data[1]);
    if (data.length === 2) data.push(currentProfile);
    return JSON.stringify(data);
  } catch { return base; }
}
export function destination(kind, record) {
  if (kind === 'profile') return '首页、研究介绍、简历与全站个人资料';
  const stage = record?.stage === 'graduate' ? '硕士阶段' : record?.stage === 'continuation' || record?.followUp ? '本科项目后续' : '本科阶段';
  const page = { news: '首页动态、完整时间线', awards: '荣誉与资格页', publications: '研究与论文页', projects: '研究项目页' }[kind];
  return page + (record ? ' · ' + stage : '');
}
export function changeCount(base, news, portfolio, profile) {
  let original;
  try { original = JSON.parse(base); } catch { return null; }
  if (!Array.isArray(original) || ![2, 3].includes(original.length)) return null;
  const flatten = (n, p, profileData) => new Map([
    ...[...n.events, ...n.grouped].map(record => ['news/' + record.id, JSON.stringify(record)]),
    ...['awards', 'publications', 'projects'].flatMap(kind => p[kind].map(record => [kind + '/' + record.id, JSON.stringify(record)])),
    ['totals', JSON.stringify(p.totals)],
    ...(profileData ? [['profile', JSON.stringify(profileData)]] : [])
  ]);
  const before = flatten(...original), after = flatten(news, portfolio, profile);
  return [...new Set([...before.keys(), ...after.keys()])].filter(id => before.get(id) !== after.get(id)).length;
}
import { upgradeLinkedNews } from '../assets/js/content-model.mjs?v=20261007-events';
export function createConfirmation(dialog, messageElement) {
  let pending = false;
  return async message => {
    if (pending) return false;
    pending = true;
    const trigger = dialog.ownerDocument?.activeElement;
    try {
      return await new Promise((resolve, reject) => {
        const cleanup = () => { dialog.removeEventListener('close', closed); dialog.removeEventListener('cancel', cancelled); };
        const closed = () => { cleanup(); trigger?.focus?.({ preventScroll: true }); resolve(dialog.returnValue === 'confirm'); };
        const cancelled = event => { event.preventDefault(); dialog.close('cancel'); };
        messageElement.textContent = message;
        dialog.returnValue = 'cancel';
        dialog.addEventListener('close', closed);
        dialog.addEventListener('cancel', cancelled);
        try { dialog.showModal(); dialog.querySelector('[value="cancel"]')?.focus(); }
        catch (error) { cleanup(); reject(error); }
      });
    } finally { pending = false; }
  };
}
