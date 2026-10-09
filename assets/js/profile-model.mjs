import { esc, safeUrl, validDate } from './content-model.mjs?v=20261009-trim';

export const PROFILE_PATH = 'assets/data/profile.json';
export const PROFILE_GROUPS = {
  identity: ['姓名与个人介绍', '首页、浏览器标题、全站署名'],
  graduate: ['硕士资料', '学校、导师、研究方向与简历'],
  undergraduate: ['本科资料', '学校、导师、研究方向与简历'],
  links: ['头像与学术链接', '肖像、ORCID、Scholar 与代码主页']
};
const stageFields = ['school', 'degree', 'period', 'advisor', 'researchTitle', 'researchSummary', 'cvSummary', 'cvUrl'];

export function parseEducationPeriod(value) {
  const match = String(value || '').trim().match(/^(≈?\d{4}\.\d{2}(?:\.\d{2})?)\s*(?:—|–|-|至|to)\s*(.+)$/i);
  if (!match || !validDate(match[1])) return null;
  const start = match[1], end = match[2].trim(), ongoing = /^(?:至今|present|ongoing|now)$/i.test(end);
  if (!ongoing && (!/^≈?\d{4}\.\d{2}(?:\.\d{2})?$/.test(end) || !validDate(end) || end.replace('≈', '') < start.replace('≈', ''))) return null;
  return { start, end, ongoing };
}

export function syncEducationNews(news, previousProfile, nextProfile) {
  for (const [id, stage, endpoint] of [['enrol', 'undergraduate', 'start'], ['graduation', 'undergraduate', 'end'], ['masters', 'graduate', 'start']]) {
    const before = parseEducationPeriod(previousProfile.stages[stage].en.period);
    const after = parseEducationPeriod(nextProfile.stages[stage].en.period);
    if (!before || !after || before[endpoint] === after[endpoint]) continue;
    const record = news.events.find(item => item.id === id);
    if (record && !(endpoint === 'end' && after.ongoing)) record.date = after[endpoint];
  }
  return news;
}

export function validateProfile(profile) {
  if (profile?.schemaVersion !== 1 || !profile.links || !profile.stages) return ['个人资料格式或版本不匹配。'];
  const errors = [], text = (value, label, required = true) => {
    if (typeof value !== 'string' || value.length > 12000 || required && !value.trim()) errors.push(label + '：文字不能为空或格式无效。');
  };
  for (const lang of ['en', 'zh']) {
    const localized = profile[lang];
    for (const key of ['name', 'role', 'affiliation', 'description', 'footer']) text(localized?.[key], lang + '/' + key);
    if (!Array.isArray(localized?.bio) || !localized.bio.length || localized.bio.length > 12) errors.push(lang + '：请填写个人介绍。');
    else for (const paragraph of localized.bio) text(paragraph, lang + '/bio');
    for (const stage of ['graduate', 'undergraduate']) {
      const item = profile.stages[stage]?.[lang];
      for (const key of stageFields) {
        text(item?.[key], stage + '/' + lang + '/' + key, key !== 'cvUrl' && key !== 'advisor');
        if (key.endsWith('Url') && !safeUrl(item?.[key])) errors.push(stage + '/' + lang + '/' + key + '：请使用 https:// 或站内绝对路径。');
      }
      const period = parseEducationPeriod(item?.period);
      if (!period || stage === 'undergraduate' && period.ongoing) errors.push(stage + '/' + lang + '：阶段时间须为 YYYY.MM — YYYY.MM，硕士可用“至今”或 present，结束日期不能早于开始日期。');
    }
  }
  for (const stage of ['graduate', 'undergraduate']) {
    const en = parseEducationPeriod(profile.stages[stage]?.en?.period), zh = parseEducationPeriod(profile.stages[stage]?.zh?.period);
    if (en && zh && (en.start !== zh.start || en.ongoing !== zh.ongoing || !en.ongoing && en.end !== zh.end)) errors.push(stage + '：中英文阶段起止日期须一致。');
  }
  for (const key of ['orcid', 'scholar', 'github', 'gitee']) {
    text(profile.links[key], key, false);
    if (!safeUrl(profile.links[key])) errors.push(key + '：请使用 https:// 或站内绝对路径。');
  }
  text(profile.avatar, '头像');
  if (!safeUrl(profile.avatar)) errors.push('头像：请使用 https:// 或站内绝对路径。');
  return [...new Set(errors)];
}

export function profileFromForm(profile, entries) {
  const next = structuredClone(profile);
  for (const [path, value] of entries) {
    const keys = path.split('.');
    let target = next;
    for (const key of keys.slice(0, -1)) {
      if (!Object.hasOwn(target, key) || typeof target[key] !== 'object' || !target[key]) throw Error('未知的个人资料字段。');
      target = target[key];
    }
    const key = keys.at(-1);
    if (!Object.hasOwn(target, key) || typeof target[key] !== 'string' && key !== 'bio') throw Error('未知的个人资料字段。');
    target[key] = key === 'bio' ? String(value).split(/\n\s*\n/).map(item => item.trim()).filter(Boolean) : String(value).trim();
  }
  // Dates are facts shared by both languages, not independently translated prose.
  for (const stage of ['graduate', 'undergraduate']) {
    const changed = ['zh', 'en'].filter(lang => next.stages[stage][lang].period !== profile.stages[stage][lang].period);
    if (changed.length !== 1) continue;
    const period = parseEducationPeriod(next.stages[stage][changed[0]].period);
    if (!period) continue;
    const other = changed[0] === 'zh' ? 'en' : 'zh';
    next.stages[stage][other].period = period.start + ' — ' + (period.ongoing ? other === 'zh' ? '至今' : 'present' : period.end);
  }
  const errors = validateProfile(next);
  if (errors.length) throw Error(errors.join('\n'));
  return next;
}

// Older drafts contain only news and portfolio; retain their conflict baseline while
// supplying the profile that was current when the old draft was opened.
export function upgradeDraftBase(base, profile) {
  try {
    const original = JSON.parse(base);
    return Array.isArray(original) && original.length === 2 ? JSON.stringify([...original, profile]) : base;
  } catch { return base; }
}

const anchor = (href, label, attributes = '') => href ? '<a href="' + esc(href) + '"' + attributes + '>' + esc(label) + '</a>' : '';
export function renderProfileSlot(slot, lang, profile) {
  const localized = profile[lang], zh = lang === 'zh';
  if (['name', 'role', 'affiliation', 'description', 'footer'].includes(slot)) return esc(localized[slot]);
  if (slot === 'bio') return localized.bio.map(paragraph => '<p>' + esc(paragraph) + '</p>').join('');
  if (slot === 'portrait') return '<figure class="profile"><img data-profile-avatar src="' + esc(profile.avatar) + '" alt="' + esc(localized.name) + '" width="160" height="205" decoding="async"><figcaption>' + esc(localized.name) + '</figcaption></figure>';
  if (slot === 'academic-links') return anchor(profile.links.orcid, 'ORCID', ' rel="me" data-profile-link="orcid"') + anchor(profile.links.scholar, 'Google Scholar', ' data-profile-link="scholar"') + anchor(zh ? '/zh/cv.html' : '/cv.html', zh ? '简历' : 'CV');
  if (slot === 'repository-links') return anchor(profile.links.gitee, zh ? 'Gitee · 国内' : 'Gitee · China', ' data-profile-link="gitee"') + anchor(profile.links.github, zh ? 'GitHub · 国际' : 'GitHub · International', ' data-profile-link="github"');
  if (slot === 'education') return '<h2>' + (zh ? '教育经历' : 'Education') + '</h2>' + ['graduate', 'undergraduate'].map(stage => {
    const item = profile.stages[stage][lang];
    return '<div class="education-row"><time>' + esc(item.period) + '</time><div><h3>' + esc(item.school) + '</h3><p>' + esc(item.degree) + '</p></div></div>';
  }).join('');
  const stageMatch = /^(graduate|undergraduate)-(.+)$/.exec(slot);
  if (stageMatch) {
    const stage = stageMatch[1], key = stageMatch[2], item = profile.stages[stage][lang];
    const names = { 'research-title': 'researchTitle', 'research-summary': 'researchSummary', 'cv-summary': 'cvSummary' };
    if (key === 'enrollment') return esc(parseEducationPeriod(item.period).start);
    if (key === 'completion') return esc(parseEducationPeriod(item.period).end);
    if ([...stageFields, ...Object.keys(names)].includes(key)) return esc(item[names[key] || key]);
    if (key === 'cv-links') return anchor(item.cvUrl, zh ? '简历 PDF ↗' : 'CV · PDF ↗');
    if (key === 'pdf-link') return anchor(item.cvUrl, stage === 'undergraduate' ? zh ? '本科简历 PDF ↗' : 'Undergraduate CV · PDF ↗' : zh ? '硕士简历 PDF ↗' : 'Graduate CV · PDF ↗');
    if (key === 'cv') { const links = renderProfileSlot(stage + '-cv-links', lang, profile); return '<p class="number">' + (stage === 'graduate' ? zh ? '硕士' : 'GRADUATE' : zh ? '本科' : 'UNDERGRADUATE') + ' · ' + esc(item.period) + '</p><h2>' + esc(item.school) + '<br>' + esc(item.degree) + '</h2><p>' + esc(item.cvSummary) + '</p>' + (item.advisor ? '<p>' + (zh ? '导师：' : stage === 'graduate' ? 'Advisor: ' : 'Advisors: ') + esc(item.advisor) + '</p>' : '') + (links ? '<div>' + links + '</div>' : ''); }
  }
  throw Error('未知的个人资料展示位置：' + slot);
}
export function profileSlot(slot, lang, profile) {
  return '<!-- profile:' + slot + ' -->' + renderProfileSlot(slot, lang, profile) + '<!-- /profile:' + slot + ' -->';
}

const titles = {
  'index.html': ['Personal Academic Homepage', '个人学术主页'],
  'milestones.html': ['News & milestones', '动态与足迹'],
  'research.html': ['Research & publications', '研究与论文'],
  'projects.html': ['Research projects', '研究项目'],
  'practice.html': ['Experience & service', '实践经历'],
  'awards.html': ['Awards & distinctions', '竞赛与荣誉'],
  'cv.html': ['Curriculum vitae', '教育背景与简历'],
  'graduate-record.html': ['Curriculum vitae', '教育背景与简历'],
  'graduate-cv.html': ['Curriculum vitae', '教育背景与简历'],
  'undergraduate-record.html': ['Curriculum vitae', '教育背景与简历'],
  'undergraduate-cv.html': ['Curriculum vitae', '教育背景与简历']
};
const linkDefaults = {
  'https://orcid.org/0009-0007-5488-3557': 'orcid',
  'https://scholar.google.com/citations?user=emqGrgMAAAAJ': 'scholar',
  'https://github.com/moliyingjiang': 'github', 'https://gitee.com/YJ-MoLi': 'gitee'
};
export function applyProfile(template, lang, profile, path = 'index.html') {
  const errors = validateProfile(profile);
  if (errors.length) throw Error(errors.join('\n'));
  const localized = profile[lang], page = path.replace(/^zh\//, ''), title = localized.name + ' | ' + (titles[page]?.[lang === 'zh' ? 1 : 0] || 'Academic record');
  let next = template.replace(/<!-- profile:([a-z-]+) -->[\s\S]*?<!-- \/profile:\1 -->/g, (_, slot) => profileSlot(slot, lang, profile));
  next = next.replace(/<title>[\s\S]*?<\/title>/, () => '<title>' + esc(title) + '</title>');
  next = next.replace(/<meta\s+[^>]*(?:name="description"|property="og:(?:title|description|site_name)")[^>]*>/g, tag => {
    const value = tag.includes('og:title') ? title : tag.includes('og:site_name') ? localized.name : localized.description;
    return tag.replace(/content="[^"]*"/, () => 'content="' + esc(value) + '"');
  });
  next = next.replace(/(<a\b[^>]*class="(?:brand|wordmark)"[^>]*>)[\s\S]*?(<\/a>)/g, (_, open, close) => open + profileSlot('name', lang, profile) + close);
  next = next.replace(/<img\b[^>]*(?:data-profile-avatar|src="\/assets\/images\/profile\.png")[^>]*>/g, tag => {
    let result = tag.replace(/src="[^"]*"/, () => 'src="' + esc(profile.avatar) + '"').replace(/alt="[^"]*"/, () => 'alt="' + esc(localized.name) + '"');
    if (!result.includes('data-profile-avatar')) result = result.replace('<img', '<img data-profile-avatar');
    return result;
  });
  next = next.replace(/<a\b([^>]*)>[\s\S]*?<\/a>/g, (tag, attributes) => {
    const href = /href="([^"]*)"/.exec(attributes)?.[1], key = /data-profile-link="(\w+)"/.exec(attributes)?.[1] || linkDefaults[href];
    if (!key) return tag;
    if (!profile.links[key]) return '';
    const updated = tag.replace(/href="[^"]*"/, () => 'href="' + esc(profile.links[key]) + '"');
    return attributes.includes('data-profile-link') ? updated : updated.replace('<a', '<a data-profile-link="' + key + '"');
  });
  next = next.replace(/<div class="study-stage-heading"><h2>(Master’s|Undergraduate|硕士|本科) · [\s\S]*?<\/h2><p>[\s\S]*?<\/p><\/div>/g, (_, label) => {
    const stage = ['Master’s', '硕士'].includes(label) ? 'graduate' : 'undergraduate';
    return '<div class="study-stage-heading"><h2>' + label + ' · ' + profileSlot(stage + '-school', lang, profile) + '</h2><p>' + profileSlot(stage + '-period', lang, profile) + '</p></div>';
  });
  next = next.replace(/<div class="phase-break"><span>(GRADUATE[^<]*|硕士阶段[^<]*)<\/span><\/div>/g, () => '<div class="phase-break"><span>' + (lang === 'zh' ? '硕士阶段 · ' : 'GRADUATE STAGE · ') + profileSlot('graduate-enrollment', lang, profile) + '</span></div>');
  // Migration of visible legacy signatures only: account handles and CV files stay intact.
  next = next.replace(/>([^<]*YJ-MoLi[^<]*)</g, (_, text) => '>' + text.replaceAll('YJ-MoLi', profileSlot('name', lang, profile)) + '<');
  return next;
}
