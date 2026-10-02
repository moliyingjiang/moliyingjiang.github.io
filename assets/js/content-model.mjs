export const DATA_PATHS = ['assets/data/news.json', 'assets/data/portfolio.json'];
export const PAGE_PATHS = ['index.html', 'zh/index.html', 'milestones.html', 'zh/milestones.html', 'awards.html', 'zh/awards.html', 'research.html', 'zh/research.html', 'projects.html', 'zh/projects.html', 'graduate-record.html', 'graduate-cv.html', 'cv.html', 'zh/cv.html', 'undergraduate-record.html', 'undergraduate-cv.html'];
export const EDITABLE_PATHS = [...DATA_PATHS, ...PAGE_PATHS];
export const TYPES = {
  'national-award': ['国家级竞赛奖', 'national', 'nationalAwards'],
  'national-innovation': ['国家级大创', 'innovation', 'nationalInnovation'],
  'provincial-award': ['省级竞赛奖', 'provincial', 'provincialAwards'],
  'provincial-innovation': ['省级大创', 'innovation', 'provincialInnovation'],
  'university-honor': ['校级荣誉', 'university', null],
  scholarship: ['奖学金', 'university', 'scholarships'],
  software: ['软件著作权', 'software', 'software'],
  qualification: ['资格证书', 'software', null],
  other: ['其他成果', 'innovation', null]
};
export const SECTIONS = {
  national: { en: 'National distinctions', zh: '国家级荣誉' },
  innovation: { en: 'National & provincial innovation honors', zh: '国家级与省级大创荣誉' },
  provincial: { en: 'Provincial & regional distinctions', zh: '省级与赛区荣誉' },
  university: { en: 'University honors & scholarships', zh: '校级荣誉与奖学金' },
  software: { en: 'Registered software & qualifications', zh: '软件著作权与资格认证' }
};
export const STATUSES = { submitted: ['已投稿', 'Submitted'], reviewing: ['审稿中', 'Under review'], accepted: ['已接收', 'Accepted'], published: ['已发表', 'Published'] };
export const ROLES = { first: ['第一作者', 'First author'], second: ['第二作者', 'Second author'], coauthor: ['共同作者', 'Co-author'], cofirst: ['共同第一作者', 'Co-first author'], corresponding: ['通讯作者', 'Corresponding author'] };
export const DATE_TYPES = { submitted: ['投稿', 'Submitted'], published: ['发表', 'Published'], accepted: ['接收', 'Accepted'], authorship: ['作者确认通知', 'Authorship notification'] };
export const clone = value => structuredClone(value);
export const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
export const safeUrl = value => !value || (/^\/(?!\/)/.test(value) && !/[\\\x00-\x20]/.test(value)) || (() => { try { return new URL(value).protocol === 'https:' && !/[\\\x00-\x20]/.test(value); } catch { return false; } })();
export const byDate = (a, b) => String(b.date || b.period || '').replace('≈', '').localeCompare(String(a.date || a.period || '').replace('≈', ''), 'en');
export const totalsEmpty = () => Object.fromEntries(['nationalAwards', 'nationalInnovation', 'provincialAwards', 'provincialInnovation', 'scholarships', 'software'].map(key => [key, 0]));
export function newId(prefix) { return prefix + '-' + Date.now().toString(36) + '-' + crypto.randomUUID().slice(0, 6); }
export function today() { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date()).replaceAll('-', '.'); }
export function validDate(value) {
  if (!/^≈?\d{4}\.(0[1-9]|1[0-2])(?:\.(0[1-9]|[12]\d|3[01]))?(?:\s*[—–]\s*(?:\d{2}|\d{4}\.\d{2}(?:\.\d{2})?))?$/.test(value)) return false;
  const match = value.match(/^≈?(\d{4})\.(\d{2})\.(\d{2})/);
  if (!match) return true;
  const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
  return date.getUTCMonth() === +match[2] - 1 && date.getUTCDate() === +match[3];
}
export function validateContent(news, portfolio) {
  const errors = [];
  if (!news || !Array.isArray(news.events) || !Array.isArray(news.grouped) || portfolio?.schemaVersion !== 1) return ['数据格式或版本不匹配。'];
  const recordSets = { news: [...news.events, ...news.grouped], awards: portfolio.awards, publications: portfolio.publications, projects: portfolio.projects };
  for (const [kind, records] of Object.entries(recordSets)) {
    if (!Array.isArray(records) || records.length > 2000) { errors.push(kind + '：记录列表无效。'); continue; }
    const ids = new Set();
    for (const record of records) {
      const name = record.zh?.title || record.id || kind;
      if (!/^[a-z][a-z0-9-]{0,90}$/.test(record.id || '') || ids.has(record.id)) errors.push(name + '：记录编号重复或无效。');
      ids.add(record.id);
      if (!(kind === 'news' ? ['undergraduate', 'graduate', 'continuation'] : ['undergraduate', 'graduate']).includes(record.stage)) errors.push(name + '：请选择本科或硕士阶段。');
      if (kind !== 'projects' && !validDate(record.date || '')) errors.push(name + '：日期须为 YYYY.MM 或 YYYY.MM.DD，可加 ≈。');
      for (const lang of ['zh', 'en']) {
        if (!record[lang]?.title?.trim()) errors.push(name + '：请填写' + (lang === 'zh' ? '中文' : '英文') + '标题。');
        for (const value of Object.values(record[lang] || {})) if (typeof value !== 'string' || value.length > 12000) errors.push(name + '：文字字段过长或格式无效。');
        if (kind === 'projects' && !safeUrl(record[lang]?.moreUrl)) errors.push(name + '：附加链接须以 https:// 或 / 开头。');
      }
      if (kind === 'news' && record.award && ![...portfolio.awards.map(item => item.id), ...Object.keys(SECTIONS), 'graduate'].includes(record.award)) errors.push(name + '：关联的荣誉记录不存在。');
      if (kind === 'awards') {
        if (!TYPES[record.type] || !SECTIONS[record.section]) errors.push(name + '：请选择荣誉类别。');
        if (!Number.isInteger(record.quantity) || record.quantity < 1 || record.quantity > 999) errors.push(name + '：数量应为 1–999 的整数。');
      }
      if (kind === 'publications' && (!STATUSES[record.status] || !ROLES[record.role] || !DATE_TYPES[record.dateType])) errors.push(name + '：论文状态、作者身份或日期类型不完整。');
      for (const key of ['github', 'gitee', 'url', 'metricsSource']) if (!safeUrl(record[key])) errors.push(name + '：' + key + ' 链接须使用 https://。');
    }
  }
  for (const stage of ['undergraduate', 'graduate']) for (const key of Object.keys(totalsEmpty())) {
    const value = portfolio.totals?.[stage]?.[key];
    if (!Number.isInteger(value) || value < 0 || value > 9999) errors.push('荣誉汇总数字无效：' + stage + '/' + key);
  }
  return [...new Set(errors)];
}
export function adjustAwardTotals(portfolio, oldRecord, newRecord) {
  for (const [record, direction] of [[oldRecord, -1], [newRecord, 1]]) {
    const key = record && TYPES[record.type]?.[2];
    if (record?.counted && key) portfolio.totals[record.stage][key] = Math.max(0, portfolio.totals[record.stage][key] + direction * record.quantity);
  }
}
export function linkedNews(kind, record) {
  const stage = record.stage === 'graduate' ? 'graduate' : record.followUp ? 'continuation' : 'undergraduate';
  const date = record.date || (record.period || '').split(/[—–]/)[0].trim();
  const item = { id: 'update-' + record.id, date, stage, cumulative: Boolean(record.cumulative), award: kind === 'awards' ? record.id : '', sourceType: kind, sourceId: record.id, en: {}, zh: {} };
  for (const lang of ['en', 'zh']) {
    const text = record[lang];
    item[lang] = { title: text.title, text: kind === 'awards' ? [text.result, text.rank ? text.rankLabel + ' ' + text.rank : ''].filter(Boolean).join(' · ') : kind === 'publications' ? [text.journal, STATUSES[record.status][lang === 'zh' ? 0 : 1], ROLES[record.role][lang === 'zh' ? 0 : 1], text.summary].filter(Boolean).join(' · ') : text.text };
  }
  return item;
}
export function findLinkedNews(news, kind, record) {
  const records = [...news.events, ...news.grouped];
  const exact = records.find(item => item.sourceType === kind && item.sourceId === record.id);
  if (exact) return exact;
  if (kind === 'publications') {
    const legacyId = record.id === 'road-crack' ? 'road-paper' : record.id;
    return records.find(item => item.id === legacyId);
  }
  if (kind === 'awards' && !record.cumulative) {
    const candidates = records.filter(item => item.award === record.id && !item.cumulative && item.date === record.date);
    if (candidates.length === 1) return candidates[0];
  }
  return undefined;
}
export function syncLinkedNews(news, kind, record) {
  const next = linkedNews(kind, record), old = findLinkedNews(news, kind, record);
  if (old) {
    // Award/project forms retain undergraduate ownership without redefining a historical follow-up phase.
    if (kind !== 'publications' && old.stage === 'continuation' && record.stage === 'undergraduate') next.stage = 'continuation';
    for (const bucket of ['events', 'grouped']) {
      const index = news[bucket].indexOf(old);
      if (index >= 0) { news[bucket][index] = { ...old, ...next, id: old.id }; return; }
    }
  }
  news.events.push(next);
}
