export const KIND_NAMES = { profile: '个人资料', news: '动态与足迹', awards: '荣誉与资格', publications: '论文记录', projects: '项目与实践' };
export const PAGE_NAMES = {
  'index.html': '首页 · English', 'zh/index.html': '首页 · 中文',
  'milestones.html': '完整时间线 · English', 'zh/milestones.html': '完整时间线 · 中文',
  'awards.html': '荣誉与资格 · English', 'zh/awards.html': '荣誉与资格 · 中文',
  'research.html': '研究与论文 · English', 'zh/research.html': '研究与论文 · 中文',
  'projects.html': '研究项目 · English', 'zh/projects.html': '研究项目 · 中文',
  'practice.html': '实践经历 · English', 'zh/practice.html': '实践经历 · 中文',
  'cv.html': '简历索引 · English', 'zh/cv.html': '简历索引 · 中文',
};
export const workspaceProfileGroups = workspace => workspace === 'global' ? ['identity', 'links'] : [workspace];
export const workspaceContains = (record, workspace) => workspace === 'graduate' ? record.stage === 'graduate' : workspace === 'undergraduate' ? record.stage !== 'graduate' : false;
export function previewPath(kind, language = 'en', record) {
  if (kind === 'projects' && record?.practice) return (language === 'zh' ? 'zh/' : '') + 'practice.html';
  if (kind === 'projects' && record?.researchOnly) return (language === 'zh' ? 'zh/' : '') + 'research.html';
  const page = { profile: 'index.html', news: 'index.html', awards: 'awards.html', publications: 'research.html', projects: 'projects.html' }[kind];
  return (language === 'zh' ? 'zh/' : '') + page;
}
export function recordAnchor(kind, record) {
  if (!record || kind === 'profile') return '';
  if (kind === 'projects' && record.practice) return 'practice-' + record.id;
  return kind === 'awards' ? record.id : ({ news: 'news-', publications: 'publication-', projects: 'project-' }[kind] || '') + record.id;
}
export function findSource(item, portfolio) {
  if (!item) return null;
  if (['awards', 'publications', 'projects'].includes(item.sourceType)) {
    const record = portfolio[item.sourceType].find(record => record.id === item.sourceId);
    if (record) return { kind: item.sourceType, record, ...(item.referenceOnly || item.historical ? { referenceOnly: true } : {}) };
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
export function assertPublicationBaseline(base, remoteContent) {
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  let original;
  try { original = JSON.parse(upgradeContentBase(base, remoteContent.profile)); } catch {}
  const expected = [remoteContent.news, remoteContent.portfolio, remoteContent.profile];
  if (!Array.isArray(original) || original.length !== 3 || JSON.stringify(canonical(original)) !== JSON.stringify(canonical(expected))) throw Error('草稿来源与当前 GitHub 版本不一致。请先导出草稿，再重新连接并合并修改；未覆盖线上内容。');
}
export function createConnectionAttempts() {
  let generation = 0;
  return { begin: () => ++generation, invalidate: () => { generation++; }, isCurrent: attempt => attempt === generation };
}
export function destination(kind, record) {
  if (kind === 'profile') return '首页、研究介绍、简历与全站个人资料';
  const stage = record?.stage === 'graduate' ? '硕士阶段' : record?.stage === 'continuation' || record?.followUp ? kind === 'awards' ? '本科阶段结束后' : '本科项目后续' : '本科阶段';
  const page = { news: '首页动态、完整时间线', awards: '荣誉与资格页', publications: '研究与论文页', projects: record?.practice ? '实践经历页' : record?.researchOnly ? '研究与论文页' : '工程项目页' }[kind];
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
import { upgradeLinkedNews } from '../assets/js/content-model.mjs?v=20261009-trim';
export function createConfirmation(dialog, messageElement) {
  let pending = false;
  return async message => {
    if (pending) return false;
    pending = true;
    try {
      if (!dialog || !messageElement) throw Error('确认窗口尚未加载，请刷新管理页。');
      const trigger = dialog.ownerDocument?.activeElement;
      return await new Promise((resolve, reject) => {
        const cleanup = () => { dialog.removeEventListener('close', closed); dialog.removeEventListener('cancel', cancelled); };
        const closed = () => { cleanup(); try { trigger?.focus?.({ preventScroll: true }); } catch {} resolve(dialog.returnValue === 'confirm'); };
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
