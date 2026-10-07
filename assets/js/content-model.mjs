export const DATA_PATHS = ['assets/data/news.json', 'assets/data/portfolio.json', 'assets/data/profile.json'];
export const PAGE_PATHS = ['index.html', 'zh/index.html', 'milestones.html', 'zh/milestones.html', 'awards.html', 'zh/awards.html', 'research.html', 'zh/research.html', 'projects.html', 'zh/projects.html', 'practice.html', 'zh/practice.html', 'graduate-record.html', 'graduate-cv.html', 'cv.html', 'zh/cv.html', 'undergraduate-record.html', 'undergraduate-cv.html'];
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
export const DATE_TYPES = { submitted: ['投稿', 'Submitted'], reviewing: ['进入审稿', 'Review started'], published: ['发表', 'Published'], accepted: ['接收', 'Accepted'], authorship: ['作者确认通知', 'Authorship notification'] };
export const NEWS_CATEGORIES = { education: '入学与毕业', research: '科研与论文', competition: '竞赛获奖', innovation: '大创立项与结题', honor: '校级荣誉与奖学金', software: '软件著作权', qualification: '资格与语言成绩', service: '团队与服务经历', other: '其他具体事件' };
export const PUBLICATION_EVENTS = new Set(['submitted', 'authorship', 'reviewing', 'accepted', 'published']);
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
      if (kind === 'news' && news.events.includes(record)) {
        if (record.cumulative) errors.push(name + '：动态只能记录一次具体事件；累计汇总请在荣誉栏目维护。');
        if (record.category && !NEWS_CATEGORIES[record.category]) errors.push(name + '：请选择有效的事件分类。');
        if (record.award && !portfolio.awards.some(item => item.id === record.award && !item.cumulative)) errors.push(name + '：动态只能引用具体荣誉，不能引用累计汇总。');
      }
      if (kind === 'awards') {
        if (!TYPES[record.type] || !SECTIONS[record.section]) errors.push(name + '：请选择荣誉类别。');
        if (!Number.isInteger(record.quantity) || record.quantity < 1 || record.quantity > 999) errors.push(name + '：数量应为 1–999 的整数。');
      }
      if (kind === 'publications' && (!STATUSES[record.status] || !ROLES[record.role] || !DATE_TYPES[record.dateType])) errors.push(name + '：论文状态、作者身份或日期类型不完整。');
      if (kind === 'publications' && DATE_TYPES[record.dateType] && STATUSES[record.status] && (record.dateType === 'authorship' ? !['submitted', 'reviewing'].includes(record.status) : record.dateType !== record.status)) errors.push(name + '：日期含义须对应本次论文状态；接收、发表各使用自己的事件日期。');
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
export function canLinkNews(kind, record) {
  return !record.cumulative && (kind !== 'projects' || validDate((record.period || '').split(/[—–]/)[0].trim()));
}
export function sourceEvent(kind, record) {
  if (kind === 'publications') return ['accepted', 'published'].includes(record.status) ? record.status : record.dateType === 'authorship' ? 'authorship' : record.status === 'reviewing' ? 'reviewing' : record.dateType;
  return kind === 'awards' ? 'award' : 'started';
}
export function newsCategory(item, portfolio) {
  if (NEWS_CATEGORIES[item.category]) return item.category;
  if (item.sourceType === 'projects' && portfolio?.projects?.find(record => record.id === item.sourceId)?.practice) return 'service';
  if (item.sourceType === 'publications' || item.sourceType === 'projects') return 'research';
  const award = portfolio?.awards?.find(record => record.id === (item.sourceType === 'awards' ? item.sourceId : item.award));
  if (award) return award.type.includes('innovation') ? 'innovation' : award.type.includes('award') ? 'competition' : award.type === 'software' ? 'software' : award.type === 'qualification' ? 'qualification' : 'honor';
  if (['enrol', 'masters', 'graduation'].includes(item.id)) return 'education';
  if (['team', 'lab', 'academy'].includes(item.id)) return 'service';
  if (['meter-start', 'eye-start', 'grasp-start', 'palm-start'].includes(item.id)) return 'research';
  if (item.id === 'palm-completion') return 'innovation';
  return 'other';
}
export function linkedNews(kind, record) {
  const stage = record.stage === 'graduate' ? 'graduate' : record.followUp ? 'continuation' : 'undergraduate';
  const date = record.date || (record.period || '').split(/[—–]/)[0].trim();
  const event = sourceEvent(kind, record);
  const item = { id: 'update-' + record.id + (kind === 'publications' ? '-' + event : ''), date, stage, cumulative: false, award: kind === 'awards' ? record.id : '', sourceType: kind, sourceId: record.id, sourceEvent: event, en: {}, zh: {} };
  for (const lang of ['en', 'zh']) {
    const text = record[lang];
    item[lang] = { title: text.title, text: kind === 'awards' ? [text.result, text.rank ? [text.rankLabel, text.rank].filter(Boolean).join(' ') : ''].filter(Boolean).join(' · ') : kind === 'publications' ? [text.journal, DATE_TYPES[event]?.[lang === 'zh' ? 0 : 1] || STATUSES[record.status][lang === 'zh' ? 0 : 1], ROLES[record.role][lang === 'zh' ? 0 : 1], text.summary].filter(Boolean).join(' · ') : text.text };
  }
  item.category = newsCategory(item, { awards: kind === 'awards' ? [record] : [], projects: kind === 'projects' ? [record] : [] });
  item.sourceSnapshot = clone({ date: item.date, stage: item.stage, en: item.en, zh: item.zh });
  return item;
}
function inferPublicationEvent(item, record) {
  if (PUBLICATION_EVENTS.has(item.sourceEvent)) return item.sourceEvent;
  const text = [item.zh?.title, item.zh?.text, item.en?.title, item.en?.text].join(' ');
  if (/作者确认|作者通知|authorship|author confirmation/i.test(text)) return 'authorship';
  if (/已发表|发表论文|published|publication of/i.test(text)) return 'published';
  if (/已接收|获接收|录用|accepted/i.test(text)) return 'accepted';
  if (/审稿中|进入审稿|under review|review started/i.test(text)) return 'reviewing';
  if (/投稿|submitted|submission/i.test(text)) return 'submitted';
  return item.date === record.date ? sourceEvent('publications', record) : null;
}
export function findLinkedNews(news, kind, record) {
  const records = [...news.events, ...news.grouped];
  const event = sourceEvent(kind, record);
  const exact = records.find(item => !item.detachedSource && !item.referenceOnly && !item.historical && item.sourceType === kind && item.sourceId === record.id && (kind !== 'publications' || inferPublicationEvent(item, record) === event));
  if (exact) return exact;
  if (kind === 'publications') {
    const legacyId = record.id === 'road-crack' ? 'road-paper' : record.id;
    return records.find(item => !item.detachedSource && !item.referenceOnly && !item.historical && item.id === legacyId && inferPublicationEvent(item, record) === event);
  }
  if (kind === 'awards' && !record.cumulative) {
    const candidates = records.filter(item => !item.detachedSource && !item.referenceOnly && !item.historical && item.award === record.id && !item.cumulative && item.date === record.date);
    if (candidates.length === 1) return candidates[0];
  }
  return undefined;
}
export function syncLinkedNews(news, kind, record, { overwrite = false } = {}) {
  if (!canLinkNews(kind, record)) return null;
  const next = linkedNews(kind, record), old = findLinkedNews(news, kind, record);
  if (old) {
    // Award/project forms retain undergraduate ownership without redefining a historical follow-up phase.
    if (kind !== 'publications' && old.stage === 'continuation' && record.stage === 'undergraduate') next.stage = 'continuation';
    next.sourceSnapshot.stage = next.stage;
    for (const field of ['date', 'stage']) {
      const baseline = old.sourceSnapshot?.[field];
      // Legacy snapshots did not track these fields; preserve their historical values conservatively.
      if (baseline === undefined || old[field] !== baseline) next[field] = old[field];
    }
    if (!overwrite) for (const lang of ['en', 'zh']) for (const field of ['title', 'text']) {
      // A news event may be written more concisely than its source. Only replace untouched generated fields.
      const baseline = old.sourceSnapshot?.[lang]?.[field];
      if (baseline === undefined || old[lang]?.[field] !== baseline) next[lang][field] = old[lang]?.[field] || '';
    }
    if (old.category) next.category = old.category;
    for (const bucket of ['events', 'grouped']) {
      const index = news[bucket].indexOf(old);
      if (index >= 0) { news[bucket][index] = { ...old, ...next, id: old.id }; return news[bucket][index]; }
    }
  }
  news.events.push(next);
  return next;
}
export function detachLinkedNews(news, kind, sourceId) {
  for (const item of [...news.events, ...news.grouped]) {
    const legacyPublication = kind === 'publications' && (item.id === sourceId || sourceId === 'road-crack' && item.id === 'road-paper');
    if (item.sourceType === kind && item.sourceId === sourceId || kind === 'awards' && item.award === sourceId || legacyPublication) {
      item.detachedSource = { kind, id: sourceId, event: item.sourceEvent || '' };
      delete item.sourceType; delete item.sourceId; delete item.sourceEvent; delete item.sourceSnapshot;
      if (kind === 'awards') item.award = '';
    }
  }
}
export function upgradeLinkedNews(news, portfolio) {
  for (const record of portfolio.publications) {
    if (['accepted', 'published'].includes(record.status) || record.status === 'reviewing' && record.dateType !== 'authorship') record.dateType = record.status;
  }
  const events = [...news.events], archived = [];
  for (const item of news.grouped) {
    if (!item.cumulative) {
      if (!events.some(record => record.id === item.id)) events.push(item);
    } else archived.push(item);
  }
  news.events = events.filter(item => {
    if (item.cumulative) { archived.push(item); return false; }
    return true;
  });
  news.grouped = archived;
  for (const item of news.events) {
    if (item.detachedSource) continue;
    const summary = portfolio.awards.find(record => record.id === (item.sourceType === 'awards' ? item.sourceId : item.award) && record.cumulative);
    if (summary || Object.keys(SECTIONS).includes(item.award) || item.award === 'graduate') {
      item.detachedSource = { kind: 'awards', id: item.sourceId || item.award, event: item.sourceEvent || '', reason: 'summary-reference' };
      item.award = ''; delete item.sourceType; delete item.sourceId; delete item.sourceEvent; delete item.sourceSnapshot;
      continue;
    }
    if (item.referenceOnly || item.historical) continue;
    const legacyId = item.id === 'road-paper' ? 'road-crack' : item.id;
    const kind = item.sourceType || (item.award ? 'awards' : portfolio.publications.some(record => record.id === legacyId) ? 'publications' : null);
    const sourceId = item.sourceId || (kind === 'awards' ? item.award : legacyId);
    const record = kind && portfolio[kind]?.find(record => record.id === sourceId);
    if (!record && item.sourceType && item.sourceId) { detachLinkedNews(news, item.sourceType, item.sourceId); continue; }
    if (!record || !canLinkNews(kind, record)) continue;
    const event = kind === 'publications' ? inferPublicationEvent(item, record) : sourceEvent(kind, record);
    if (!event) continue;
    item.sourceType = kind; item.sourceId = sourceId; item.sourceEvent = event;
    if (kind !== 'publications' || event === sourceEvent(kind, record)) {
      const generated = linkedNews(kind, record);
      if (kind !== 'publications' && item.stage === 'continuation' && record.stage === 'undergraduate') generated.stage = 'continuation';
      if (!item.sourceSnapshot) item.sourceSnapshot = clone({ date: generated.date, stage: generated.stage, en: generated.en, zh: generated.zh });
      else {
        if (item.sourceSnapshot.date === undefined) item.sourceSnapshot.date = generated.date;
        if (item.sourceSnapshot.stage === undefined) item.sourceSnapshot.stage = generated.stage;
      }
    }
  }
  return news;
}
