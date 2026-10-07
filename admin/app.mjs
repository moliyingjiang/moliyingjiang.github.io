import { EDITABLE_PATHS, PAGE_PATHS, TYPES, STATUSES, ROLES, DATE_TYPES, NEWS_CATEGORIES, esc, clone, newId, today, validDate, byDate, validateContent, adjustAwardTotals, syncLinkedNews, findLinkedNews, canLinkNews, sourceEvent, newsCategory, detachLinkedNews, upgradeLinkedNews } from '../assets/js/content-model.mjs?v=20261007-practice';
import { renderSite } from '../assets/js/site-renderer.mjs?v=20261007-practice';
import { PROFILE_PATH, PROFILE_GROUPS, validateProfile, profileFromForm, upgradeDraftBase, syncEducationNews } from '../assets/js/profile-model.mjs?v=20261007-practice';
import { GitHub } from './github.mjs?v=20261007-practice';
import { KIND_NAMES, PAGE_NAMES, previewPath, recordAnchor, findSource, destination, changeCount, newsState, upgradeContentBase, createConfirmation, assertPublicationBaseline, createConnectionAttempts } from './editor-model.mjs?v=20261007-practice';

const $ = selector => document.querySelector(selector);
const requestConfirmation = createConfirmation($('#confirm-dialog'), $('#confirm-message'));
const connectionAttempts = createConnectionAttempts();
const confirmAction = async message => {
  try { return await requestConfirmation(message); }
  catch (error) { status(error.message); return false; }
};
const key = 'portfolio-editor-v1';
const labels = { title:'完整名称 / 具体事件标题', text:'这次事件的具体内容', result:'奖项 / 等级 / 成绩', rankLabel:'排名口径（如全国决赛 / 省级评选）', rank:'名次（如 3 / 65）', journal:'期刊', metrics:'分区与年份（如 JCR 2025 · Q1）', summary:'研究说明', category:'研究方向', moreLabel:'附加链接文字', moreUrl:'附加链接' };
const eventStates = { linked: '关联来源', independent: '独立事件', detached: '独立历史 · 已解除关联', archived: '旧版汇总归档' };
let files, news, portfolio, profile, base, client, snapshot, kind = 'profile', editing, bucket;
let dirty = false, draft = false;
const status = message => { $('#status').textContent = message; };
const parse = source => {
  const content = { news: JSON.parse(source['assets/data/news.json']), portfolio: JSON.parse(source['assets/data/portfolio.json']), profile: JSON.parse(source[PROFILE_PATH]) };
  upgradeLinkedNews(content.news, content.portfolio);
  return content;
};
const fingerprint = () => JSON.stringify([news, portfolio, profile]);
const allNews = () => [...news.events, ...news.grouped];
function updateState() {
  const count = changeCount(base, news, portfolio, profile);
  $('#draft-state').textContent = dirty ? '当前表单未保存' : count ? count + ' 项草稿修改' : draft ? '草稿与线上内容一致' : '与线上内容一致';
  $('#draft-state').classList.toggle('pending', dirty || !!count);
  $('#connect').textContent = client ? 'GitHub 已连接' : '连接 GitHub';
  if (profile) { $('.brand a').textContent = profile.zh.name; document.title = '内容管理 · ' + profile.zh.name; }
}
function saveDraft(message = '已保存到本设备草稿，尚未发布。') {
  draft = true;
  try { localStorage.setItem(key, JSON.stringify({ news, portfolio, profile, base })); status(message); }
  catch { status('本设备无法保存草稿，请导出备份后再关闭页面。'); }
  updateState();
}
function assertValid(n, p, pr = profile) {
  const errors = [...validateContent(n, p), ...validateProfile(pr)];
  if (errors.length) throw new Error(errors.join('\n'));
}
function records() { return kind === 'profile' ? Object.keys(PROFILE_GROUPS).map(id => ({id})) : kind === 'news' ? allNews() : portfolio[kind]; }
function list() {
  const count = id => id === 'profile' ? '4' : id === 'news' ? news.events.length : portfolio[id].length;
  $('#nav').innerHTML = Object.entries(KIND_NAMES).map(([id, name]) =>
    '<button type="button" data-kind="' + id + '" class="' + (id === kind ? 'selected' : '') + '" aria-pressed="' + (id === kind) + '">' + name + '<span>' + count(id) + '</span></button>').join('');
  $('.filters').hidden = kind === 'profile';
  $('#event-filters').hidden = kind !== 'news';
  $('#add').hidden = kind === 'profile';
  if (kind === 'profile') {
    $('#list').innerHTML = Object.entries(PROFILE_GROUPS).map(([id, names]) => '<button type="button" data-id="' + id + '" class="' + (editing?.id === id ? 'selected' : '') + '">' + names[0] + '<small>' + names[1] + '</small></button>').join('');
    $('#list-caption').textContent = '个人资料 · 中英文分别维护';
    return;
  }
  const stage = $('#filter').value, query = $('#search').value.trim().toLowerCase(), eventFilter = $('#event-filter').value, categoryFilter = $('#category-filter').value;
  const filtered = records().filter(record =>
    (!stage || (stage === 'undergraduate' ? record.stage !== 'graduate' : record.stage === stage)) &&
    (kind !== 'news' || (eventFilter ? newsState(record, portfolio) === eventFilter : !record.cumulative) && (!categoryFilter || newsCategory(record, portfolio) === categoryFilter)) &&
    [record.zh.title, record.en.title, record.zh.text, record.en.text, record.zh.result, record.en.result, record.zh.rank, record.en.rank].join(' ').toLowerCase().includes(query)
  ).slice().sort(byDate);
  $('#list').innerHTML = filtered.length ? filtered.map(record =>
    '<button type="button" data-id="' + esc(record.id) + '" class="' + (editing?.id === record.id ? 'selected' : '') + '">' + esc(record.zh.title) +
    '<small>' + (record.stage === 'graduate' ? '硕士' : record.stage === 'continuation' || record.followUp ? kind === 'awards' && record.type === 'qualification' || kind === 'news' && newsCategory(record, portfolio) === 'qualification' ? '毕业后 · 入硕前' : '本科研究后续' : '本科') + ' · ' + (kind === 'projects' ? record.practice ? '实践 · ' : '项目 · ' : '') + esc(record.date || record.period || '时间未填写') + '</small>' + (kind === 'news' ? '<span class="record-state">' + esc(NEWS_CATEGORIES[newsCategory(record, portfolio)]) + ' · ' + eventStates[newsState(record, portfolio)] + '</span>' : '') + '</button>'
  ).join('') : '<p class="empty-list">没有匹配的记录，试试其他阶段或关键词。</p>';
  $('#list-caption').textContent = filtered.length + ' 条记录 · 按时间排序';
  $('#add').textContent = '＋ 新增' + ({news:'动态',awards:'荣誉 / 资格',publications:'论文',projects:'项目'})[kind];
}
const field = (name, value, label, area = false, type = 'text') =>
  '<label>' + esc(label) + (area ? '<textarea name="' + name + '">' + esc(value) + '</textarea>' :
    '<input type="' + type + '" name="' + name + '" value="' + esc(value) + '"' + (type === 'number' ? ' min="1" max="999" step="1"' : '') + '>') + '</label>';
const select = (name, value, label, options) =>
  '<label>' + esc(label) + '<select name="' + name + '">' + Object.entries(options).map(([v, l]) =>
    '<option value="' + esc(v) + '" ' + (value === v ? 'selected' : '') + '>' + esc(Array.isArray(l) ? l[0] : l) + '</option>'
  ).join('') + '</select></label>';

function editProfile(id = 'identity') {
  editing = { id }; dirty = false;
  const group = PROFILE_GROUPS[id];
  let html = '<div class="editor-heading"><div><p class="overline">PROFILE & IDENTITY</p><h2>' + group[0] + '</h2></div><span class="record-id">中英文同步发布</span></div><div class="destination"><strong>显示位置：' + group[1] + '</strong><p>姓名、介绍、教育背景与研究方向统一维护。中英文分别填写；保存草稿后预览，再发布到网站。</p></div>';
  if (id === 'links') {
    html += '<div class="profile-avatar-preview"><img src="' + esc(profile.avatar) + '" alt="当前肖像"><div>' + field('avatar', profile.avatar, '肖像图片地址') + '<p class="field-help">填写已有图片的站内地址（如 /assets/images/profile.png）或 HTTPS 链接。</p></div></div><div class="form-grid">' + Object.entries({ orcid:'ORCID', scholar:'Google Scholar', github:'GitHub 主页 · 国际访问', gitee:'Gitee 主页 · 国内访问' }).map(([key, label]) => field('links.' + key, profile.links[key], label)).join('') + '</div>';
  } else {
    html += '<div class="languages">' + ['zh', 'en'].map(lang => {
      const prefix = id === 'identity' ? lang : 'stages.' + id + '.' + lang;
      const item = id === 'identity' ? profile[lang] : profile.stages[id][lang];
      const definitions = id === 'identity' ? [['name','公开署名'], ['role','身份与专业'], ['affiliation','所在学校 / 机构'], ['bio','个人介绍（空行分段）', true], ['description','搜索与分享摘要', true], ['footer','页脚文字']] : [['school','学校'], ['degree','学历与专业'], ['period','阶段时间'], ['advisor','导师与学术背景', true], ['researchTitle','研究方向标题'], ['researchSummary','研究方向说明', true], ['cvSummary','简历介绍', true], ['cvUrl','简历 PDF 地址（可留空）'], ['recordUrl','电子档案地址']];
      return '<div><h3>' + (lang === 'zh' ? '中文版本' : 'English version') + '</h3>' + definitions.map(([key, label, area]) => field(prefix + '.' + key, key === 'bio' ? item.bio.join('\n\n') : item[key], label, area)).join('') + '</div>';
    }).join('') + '</div>';
    if (id !== 'identity') html += '<p class="field-help">阶段时间请至少填写到月份，例如 2021.10 — 2025.07 或 2026.08.30 — 至今。中英文日期自动对齐，并同步对应入学、毕业动态。简历 PDF 可填写已有文件的站内地址或 HTTPS 地址；留空时只展示电子档案入口。</p>';
  }
  html += '<div class="actions"><small>保存后可预览中文与英文页面。</small><button class="primary" type="submit">保存草稿</button><button type="button" id="editor-preview">预览页面</button></div>';
  $('#editor').innerHTML = html; list(); updateState();
}

function context(record) {
  const source = kind === 'news' ? findSource(record, portfolio) : null;
  const linked = kind !== 'news' ? findLinkedNews(news, kind, record) : null;
  let hint;
  if (kind === 'news') hint = record.cumulative ? '这条旧版汇总已归档，不出现在首页动态或时间线。原文字仍保存在草稿中；具体经历请分别添加为事件。' : record.detachedSource ? '原来源已解除关联，本条作为独立历史保留。可以继续编辑，或单独删除这次事件。' : '一条动态对应一次入学、获奖、立项、投稿或其他具体事件。比赛请填写完整名称，并写清赛项、奖级和排名。';
  else hint = record.cumulative ? '累计数字仅保留在荣誉栏目。每次具体获奖或立项须另建记录，才能关联首页动态。' : kind === 'publications' ? '关联动态保留手动编辑的文案；新论文节点会新增事件，同一节点更新已有事件。' : '关联动态保留手动编辑的日期与文案；同一事件更新已有动态。';
  const link = source ? '<button type="button" data-open-kind="' + source.kind + '" data-open-id="' + esc(source.record.id) + '">' + (source.referenceOnly ? '编辑引用的' : '编辑关联的') + KIND_NAMES[source.kind] + ' →</button>' :
    linked ? '<button type="button" data-open-kind="news" data-open-id="' + esc(linked.id) + '">编辑关联动态 →</button>' : '';
  const history = kind === 'news' && record.detachedSource ? '<p class="source-history">原来源：' + esc(KIND_NAMES[record.detachedSource.kind] || '历史记录') + ' · ' + esc(record.detachedSource.id) + '</p>' : '';
  const historicalPaper = source?.kind === 'publications' && record.sourceEvent && record.sourceEvent !== sourceEvent('publications', source.record);
  const refresh = source && !source.referenceOnly && !historicalPaper && canLinkNews(source.kind, source.record) ? '<button type="button" id="refresh-news">从来源重新生成本条文案</button>' : '';
  if (historicalPaper) hint += ' 这条论文历史事件保留当时的标题、作者身份和日期；当前论文变化不回写本条。';
  return '<div class="destination"><strong id="destination-text">显示位置：' + esc(record.cumulative && kind === 'news' ? '旧版汇总归档（不对外展示）' : destination(kind, record)) + '</strong><p>' + hint + '</p>' + history + link + refresh + '</div>';
}
function edit(record) {
  editing = clone(record); dirty = false;
  bucket = kind === 'news' && news.grouped.some(item => item.id === record.id) ? 'grouped' : 'events';
  const existing = records().some(item => item.id === record.id);
  const linked = kind === 'news' ? null : findLinkedNews(news, kind, record);
  const canSync = canLinkNews(kind, record);
  const sync = !!linked || !existing && canSync;
  let html = '<div class="editor-heading"><div><p class="overline">' + (existing ? 'EDIT RECORD' : 'NEW RECORD') + '</p><h2>' + (existing ? '编辑' : '新增') + KIND_NAMES[kind] + '</h2></div><span class="record-id">' + esc(record.id) + '</span></div>' + context(record);
  html += '<div class="form-grid">' + select('stage', record.stage, '所属阶段', { undergraduate:'本科', graduate:'硕士', ...(kind === 'news' ? { continuation:'本科研究后续' } : {}) });
  html += field(kind === 'projects' ? 'period' : 'date', kind === 'projects' ? record.period || '' : record.date || '', kind === 'projects' ? '项目时间（如 2026.09 — 至今）' : '本次事件日期（YYYY.MM.DD 或 YYYY.MM）') + '</div>';
  html += '<p class="field-help">' + (kind === 'projects' ? '同步动态时，使用项目时间的起始日期；未填时间的项目也可单独发布。' : '约定日期在前面加 ≈，例如 ≈2024.06。') + '</p>';
  if (kind === 'awards') {
    html += '<div class="form-section"><h3>荣誉、资格与汇总</h3><div class="form-grid">' + select('type', record.type, '记录类型（语言成绩请选择资格证书）', TYPES) + field('quantity', record.quantity, '数量', false, 'number') + '</div>';
    html += '<label class="check-row"><input type="checkbox" name="counted" ' + (record.counted ? 'checked' : '') + '>新增荣誉计入汇总</label><p class="field-help">补录已统计的旧荣誉时取消勾选。资格证书、校级荣誉不改变竞赛奖项汇总。</p><label class="check-row"><input type="checkbox" name="cumulative" ' + (record.cumulative ? 'checked' : '') + '>这是一条累计记录</label></div>';
    html += '<label class="check-row"><input type="checkbox" name="followUp" ' + (record.followUp ? 'checked' : '') + (record.stage === 'graduate' ? ' disabled' : '') + '>本科阶段结束后的记录</label><p class="field-help">毕业后、入硕前的语言成绩或本科延续竞赛仍归本科档案；硕士阶段不勾选。</p>';
  }
  if (kind === 'publications') {
    html += '<div class="form-section"><h3>论文信息</h3><div class="form-grid">' + select('status', record.status, '论文状态', STATUSES) + select('role', record.role, '作者身份', ROLES) + select('dateType', record.dateType, '日期含义', DATE_TYPES) + field('url', record.url, '论文链接（可选）') + field('metricsSource', record.metricsSource, '分区来源链接（可选）') + '</div>';
    html += '<label class="check-row"><input type="checkbox" name="followUp" ' + (record.followUp ? 'checked' : '') + (record.stage === 'graduate' ? ' disabled' : '') + '>本科项目后续成果</label><p class="field-help">本科项目延续形成的论文仍归入本科；硕士记录不勾选这一项。</p></div>';
  }
  if (kind === 'projects') html += '<label class="check-row"><input type="checkbox" name="practice" ' + (record.practice ? 'checked' : '') + '>实践经历（团队成员、班长等任职，不显示在项目页）</label>';
  if (kind === 'projects') html += '<div class="form-section"><h3>代码与材料</h3><div class="form-grid">' + field('gitee', record.gitee, 'Gitee 仓库（国内访问）') + field('github', record.github, 'GitHub 仓库（国际访问）') + '</div></div>';
  if (kind === 'news') html += '<div class="form-section"><div class="form-grid">' + select('category', record.category || '', '事件分类', { '': '按关联来源自动分类', ...NEWS_CATEGORIES }) + select('award', record.award || '', '引用具体荣誉（可选）', { '':'无', ...Object.fromEntries(portfolio.awards.filter(item => !item.cumulative).map(item => [item.id, item.zh.title])) }) + '</div><p class="field-help">只引用本次具体获奖、立项或证书；累计汇总不作为新闻。</p>' + (record.sourceType === 'publications' ? '<p class="source-history">论文节点：' + esc(DATE_TYPES[record.sourceEvent]?.[0] || '历史事件') + ' · 修改本条不改变其他投稿、接收或发表事件。</p>' : '') + '</div>';
  const fields = kind === 'awards' ? ['title','result','rankLabel','rank'] : kind === 'publications' ? ['title','journal','metrics','summary'] : kind === 'projects' ? ['title','category','text','moreLabel','moreUrl'] : ['title','text'];
  html += '<div class="languages">' + ['zh','en'].map(lang =>
    '<div><h3>' + (lang === 'zh' ? '中文版本' : 'English version') + '</h3>' + fields.map(name => field(lang + '.' + name, record[lang]?.[name] || '', labels[name], ['text','summary','title'].includes(name))).join('') + '</div>'
  ).join('') + '</div>';
  if (kind !== 'news') html += '<div class="sync-panel"><label><input type="checkbox" name="sync" ' + (sync && !record.cumulative ? 'checked' : '') + (record.cumulative ? ' disabled' : '') + '><span id="sync-action">' + (linked ? '同步当前节点的关联动态' : '为本次事件新增关联动态') + '</span></label><p class="field-help" id="sync-explanation">' + (record.cumulative ? '汇总记录不生成动态。请添加每一次具体事件。' : linked ? '同一事件只保留一条动态；修改未手动编辑的文案，保留已有自定义文字。' : (kind === 'publications' ? '保存时新增一条具体事件；论文后续接收、发表各有独立日期，先前事件会保留。' : '保存时为本次事件新增一条动态，已有事件和汇总数字保留。')) + '</p></div>';
  html += '<div class="actions"><small>保存为本地草稿，发布后才会更新网站。</small><button class="primary" type="submit">保存草稿</button><button type="button" id="editor-preview">预览这条记录</button>' + (existing ? '<button type="button" id="delete">删除</button>' : '') + '</div>';
  $('#editor').innerHTML = html;
  list(); updateState();
}
function clearEditor() {
  if (kind === 'profile') return editProfile();
  editing = null; dirty = false;
  const help = {news:'每条动态只记录一次具体事件。填写发生日期、完整名称与结果，在首页和时间线按本科、硕士分别显示。',awards:'竞赛奖项、奖学金、资格证书和语言成绩均在这里维护。单次具体记录可生成动态，累计汇总只显示在荣誉页。',publications:'按本科与硕士阶段维护论文。投稿、作者通知、审稿、接收与发表可分别关联独立事件，保留先前历史。',projects:'维护项目及实践经历；勾选“实践经历”后单独显示在实践页，本硕分别记录。'}[kind];
  $('#editor').innerHTML = '<div class="empty-editor"><p class="overline">PERSONAL ACADEMIC RECORD</p><h1>' + KIND_NAMES[kind] + '</h1><p>' + help + '</p><p>选择一条记录，或点击“新增”。中英文分别填写，预览确认后发布。</p></div>';
  updateState();
}
const leave = async () => !dirty || await confirmAction('当前表单还没有保存，放弃这些输入？');
async function choose(nextKind, id) {
  if (!await leave()) return;
  if (nextKind !== kind) $('#search').value = '';
  if (nextKind !== kind) { $('#event-filter').value = ''; $('#category-filter').value = ''; }
  kind = nextKind;
  if (kind === 'profile') return editProfile(id || 'identity');
  const record = records().find(item => item.id === id);
  if (record) {
    $('#search').value = '';
    if (kind === 'news') { $('#event-filter').value = record.cumulative ? 'archived' : ''; $('#category-filter').value = ''; }
    const stage = $('#filter').value;
    if (stage && (stage === 'graduate') !== (record.stage === 'graduate')) $('#filter').value = '';
    edit(record);
  } else { clearEditor(); list(); }
}
$('#nav').onclick = event => {
  const next = event.target.closest('[data-kind]')?.dataset.kind;
  if (next) choose(next);
};
$('#list').onclick = event => {
  const id = event.target.closest('[data-id]')?.dataset.id;
  if (id) choose(kind, id);
};
$('#search').oninput = list; $('#filter').onchange = list; $('#event-filter').onchange = list; $('#category-filter').onchange = list;
$('#category-filter').innerHTML = '<option value="">全部事件分类</option>' + Object.entries(NEWS_CATEGORIES).map(([id, title]) => '<option value="' + id + '">' + title + '</option>').join('');
$('#add').onclick = async () => {
  if (!await leave()) return;
  const record = { id:newId(kind), stage:$('#filter').value || 'graduate', en:{title:''}, zh:{title:''} };
  if (kind === 'projects') record.period = '';
  else record.date = today();
  if (kind === 'awards') Object.assign(record, {type:'national-award',section:'national',quantity:1,counted:true,cumulative:false});
  if (kind === 'publications') Object.assign(record, {status:'submitted',role:'coauthor',dateType:'submitted',followUp:false});
  if (kind === 'news') { $('#event-filter').value = ''; $('#category-filter').value = ''; }
  edit(record);
};
$('#editor').oninput = event => {
  dirty = true;
  if (event.target.name === 'stage' && $('[name="followUp"]')) {
    $('[name="followUp"]').disabled = event.target.value === 'graduate';
    if (event.target.value === 'graduate') $('[name="followUp"]').checked = false;
  }
  if (kind === 'publications' && event.target.name === 'status') $('[name="dateType"]').value = event.target.value;
  if (kind === 'publications' && event.target.name === 'dateType') $('[name="status"]').value = event.target.value === 'authorship' ? 'submitted' : event.target.value;
  if (['stage','followUp'].includes(event.target.name)) {
    const form = new FormData($('#editor'));
    $('#destination-text').textContent = '显示位置：' + destination(kind, {...editing,stage:form.get('stage'),followUp:form.get('stage') === 'undergraduate' && form.has('followUp')});
  }
  if (kind !== 'news' && $('#sync-action')) {
    const form = new FormData($('#editor'));
    const candidate = { ...editing, ...Object.fromEntries(['status', 'dateType', 'date', 'period', 'stage'].filter(name => form.has(name)).map(name => [name, form.get(name)])), cumulative: form.has('cumulative') };
    const linked = findLinkedNews(news, kind, candidate), summary = candidate.cumulative;
    $('[name="sync"]').disabled = summary;
    if (summary) $('[name="sync"]').checked = false;
    $('#sync-action').textContent = linked ? '同步当前节点的关联动态' : '为本次事件新增关联动态';
    $('#sync-explanation').textContent = summary ? '汇总记录不生成动态。请添加每一次具体事件。' : linked ? '同一事件更新已有动态；你手动编辑过的文案会保留。' : '将新增本次具体事件，保留此前投稿、接收或其他历史节点。';
  }
  updateState();
};
$('#editor').onsubmit = event => {
  event.preventDefault();
  if (!editing) return;
  try {
    if (kind === 'profile') {
      const id = editing.id;
      const nextProfile = profileFromForm(profile, new FormData(event.target)), n = clone(news);
      syncEducationNews(n, profile, nextProfile); assertValid(n, portfolio, nextProfile);
      news = n; profile = nextProfile;
      editProfile(id);
      saveDraft('个人资料草稿已保存。预览中英文页面，发布后全站资料一起更新。');
      return;
    }
    const next = clone(editing), form = new FormData(event.target), n = clone(news), p = clone(portfolio);
    for (const [name,value] of form) {
      if (name.includes('.')) { const [lang, field] = name.split('.'); next[lang][field] = value.trim(); }
      else if (!['sync','counted','cumulative','followUp','practice'].includes(name)) next[name] = value.trim();
    }
    if (kind === 'projects') { delete next.date; next.practice = form.has('practice'); }
    if (kind === 'news' && next.award !== editing.award && editing.sourceType === 'awards') {
      next.detachedSource = { kind: 'awards', id: editing.sourceId, event: editing.sourceEvent || '' };
      delete next.sourceType; delete next.sourceId; delete next.sourceEvent; delete next.sourceSnapshot;
    }
    if (kind === 'news') {
      if (next.historical || !next.sourceType && next.award) next.referenceOnly = true;
      else delete next.referenceOnly;
    }
    if (kind === 'awards') { next.quantity = Number(next.quantity); next.section = TYPES[next.type][1]; next.counted = form.has('counted'); next.cumulative = form.has('cumulative'); next.followUp = next.stage === 'undergraduate' && form.has('followUp'); }
    if (kind === 'publications') { next.followUp = next.stage === 'undergraduate' && form.has('followUp'); next.dateType = sourceEvent(kind, next); }
    const target = kind === 'news' ? n[bucket] : p[kind], index = target.findIndex(record => record.id === next.id);
    if (kind === 'awards') adjustAwardTotals(p, index < 0 ? null : target[index], next);
    if (index < 0) target.push(next); else target[index] = next;
    if (form.has('sync')) {
      if (kind === 'projects' && !validDate((next.period || '').split(/[—–]/)[0].trim())) throw Error('同步动态需要项目起始日期，例如 2026.09 — 至今；也可以取消同步，只保存项目。');
      if (!canLinkNews(kind, next)) throw Error('累计汇总不能生成新闻，请为每一次具体经历单独添加记录。');
      syncLinkedNews(n, kind, next);
    }
    assertValid(n, p); news = n; portfolio = p;
    edit(next);
    saveDraft('草稿已保存。显示于' + destination(kind, next) + (form.has('sync') ? '，关联动态也已同步。' : '。') + '点击预览确认，再发布更新。');
  } catch (error) { status(error.message); }
};
$('#editor').onclick = async event => {
  const opener = event.target.closest('[data-open-kind]');
  if (opener) return choose(opener.dataset.openKind, opener.dataset.openId);
  if (event.target.id === 'editor-preview') return showPreview();
  if (event.target.id === 'refresh-news' && kind === 'news' && editing) {
    if (!await leave()) return;
    const source = findSource(editing, portfolio);
    if (!source || !await confirmAction('用关联来源重新生成本条中英文标题和正文？这会替换本条手动编辑的文案，其他历史事件保留。')) return;
    const candidate = { ...source.record };
    if (source.kind === 'publications') {
      candidate.date = editing.date;
      candidate.dateType = editing.sourceEvent || candidate.dateType;
      candidate.status = candidate.dateType === 'authorship' ? 'submitted' : candidate.dateType;
    }
    const next = syncLinkedNews(news, source.kind, candidate, { overwrite: true });
    if (next) { edit(next); saveDraft('本条动态文案已从来源重新生成，请预览后发布。'); }
    return;
  }
  if (event.target.id !== 'delete' || !editing || !await confirmAction('从草稿中删除这条记录？发布后才会更新线上内容；已有动态记录将保留。')) return;
  const target = kind === 'news' ? news[bucket] : portfolio[kind], index = target.findIndex(record => record.id === editing.id);
  if (index >= 0) {
    if (kind === 'awards') adjustAwardTotals(portfolio, target[index], null);
    if (kind !== 'news') detachLinkedNews(news, kind, editing.id);
    target.splice(index, 1); clearEditor(); list(); saveDraft(kind === 'news' ? '本次事件已从草稿删除，关联来源保留。发布后更新网站。' : '来源记录已删除，相关动态保留为独立历史；可在“独立历史”筛选中查找。发布后更新网站。');
  }
};
$('#reset').onclick = async () => {
  if (await confirmAction('放弃本设备草稿并重新加载线上内容？需要保留的修改请先导出。')) {
    try { localStorage.removeItem(key); } catch {}
    dirty = false; location.reload();
  }
};
$('#export').onclick = () => {
  if (dirty) return status('请先保存当前表单，再导出完整草稿。');
  const url = URL.createObjectURL(new Blob([JSON.stringify({news,portfolio,profile,base},null,2)],{type:'application/json'}));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'portfolio-draft-' + today().replaceAll('.','-') + '.json'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
  status('草稿已导出，包含所有已保存内容，可在其他设备导入。');
};
$('#import').onchange = async event => {
  try {
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 5e6) throw Error('文件过大。');
    const data = JSON.parse(await file.text()), incomingProfile = data.profile || parse(files).profile;
    upgradeLinkedNews(data.news, data.portfolio); assertValid(data.news,data.portfolio,incomingProfile);
    if (!await confirmAction('使用导入内容替换本设备草稿？')) return;
    news = data.news; portfolio = data.portfolio; profile = incomingProfile; base = upgradeContentBase(upgradeDraftBase(data.base || '', parse(files).profile), parse(files).profile);
    client = null; snapshot = null;
    clearEditor(); list(); saveDraft('已导入草稿，现有 GitHub 连接已解除。预览后重新连接 GitHub，核对版本再发布。');
  } catch(error) { status(error.message); }
  finally { event.target.value = ''; }
};
$('#connect').onclick = () => {
  if (dirty) return status('请先保存当前表单，再连接 GitHub。');
  $('#auth').showModal();
};
const cancelConnection = () => { connectionAttempts.invalidate(); $('#login').disabled = false; };
$('#auth').addEventListener('cancel', cancelConnection);
$('#auth').addEventListener('submit', cancelConnection);
$('#auth').addEventListener('close', () => {
  if (!$('#auth').open) { cancelConnection(); $('#token').value = ''; }
});
$('#login').onclick = async () => {
  const attempt = connectionAttempts.begin();
  $('#login').disabled = true;
  try {
    const token = $('#token').value.trim();
    if (!token) throw Error('请填写 GitHub 访问令牌。');
    const candidate = new GitHub(token); $('#token').value = '';
    const remote = await candidate.snapshot();
    if (!connectionAttempts.isCurrent(attempt) || !$('#auth').open) return;
    const content = parse(remote.files); assertValid(content.news,content.portfolio,content.profile);
    if (draft) assertPublicationBaseline(base, content);
    if (!draft) { news = content.news; portfolio = content.portfolio; profile = content.profile; base = fingerprint(); }
    client = candidate; snapshot = remote; files = remote.files;
    $('#auth').close();
    if (editing) { const current = records().find(record => record.id === editing.id); if (current) kind === 'profile' ? editProfile(current.id) : edit(current); else clearEditor(); }
    list(); updateState(); status('GitHub 已连接。预览确认后，点击“发布更新”。');
  } catch(error) {
    if (!connectionAttempts.isCurrent(attempt) || !$('#auth').open) return;
    status(error.message); $('#auth').close();
  }
  finally { if (connectionAttempts.isCurrent(attempt)) $('#login').disabled = false; }
};
function preview() {
  const path = $('#preview-page').value, output = renderSite(files,news,portfolio,profile);
  const doc = new DOMParser().parseFromString(output[path], 'text/html');
  doc.querySelectorAll('script, base').forEach(node => node.remove());
  const baseElement = doc.createElement('base'); baseElement.href = new URL(path, location.origin + '/').href; doc.head.prepend(baseElement);
  const anchor = recordAnchor(kind, editing), target = anchor ? doc.getElementById(anchor) : null;
  if (target) {
    target.classList.add('editor-preview-target');
    const style = doc.createElement('style');
    style.textContent = '.editor-preview-target{outline:2px solid #64849c!important;outline-offset:7px;scroll-margin-top:105px;background:#eef4f866}';
    doc.head.append(style);
    const script = doc.createElement('script');
    script.textContent = 'window.addEventListener("load",()=>{const target=document.getElementById(' + JSON.stringify(anchor) + ');if(target)target.scrollIntoView({block:"center",behavior:"instant"});});';
    doc.body.append(script);
  }
  $('iframe').srcdoc = '<!doctype html>\n' + doc.documentElement.outerHTML;
  $('#preview-note').textContent = kind === 'profile' ? '正在预览已保存的个人资料；可切换语言与页面检查效果。' : editing ? target ? '已定位当前记录，蓝色边框仅用于预览。' : '此页面不展示当前记录；对应位置：' + destination(kind, editing) + '。' : '预览已保存草稿；发布后才会更新线上页面。';
}
function showPreview() {
  try {
    if (dirty) throw Error('请先保存当前表单，再预览这条记录。');
    const language = $('#preview-page').value.startsWith('zh/') || ['graduate-cv.html','undergraduate-cv.html'].includes($('#preview-page').value) ? 'zh' : 'en';
    $('#preview-page').value = previewPath(kind, language, editing);
    preview(); $('#preview-dialog').showModal();
  } catch(error) { status(error.message); }
}
$('#preview').onclick = showPreview;
$('#preview-page').innerHTML = PAGE_PATHS.map(path => '<option value="' + path + '">' + esc(PAGE_NAMES[path] || path) + '</option>').join('');
$('#preview-page').onchange = () => { try { preview(); } catch(error) { status(error.message); } };
$('#close-preview').onclick = () => $('#preview-dialog').close();
$('#publish').onclick = async () => {
  if (dirty) return status('请先保存当前表单，再发布更新。');
  if (!client || !snapshot) return $('#auth').showModal();
  try { assertPublicationBaseline(base, parse(snapshot.files)); }
  catch (error) { return status(error.message); }
  const count = changeCount(base, news, portfolio, profile);
  if (!await confirmAction('将' + (count ? '当前 ' + count + ' 项草稿修改' : '当前内容') + '发布到 GitHub？部署完成后网站更新，Gitee 自动同步。')) return;
  $('#publish').disabled = true; $('main').inert = true; $('header').inert = true;
  try {
    assertPublicationBaseline(base, parse(snapshot.files));
    const output = renderSite(files,news,portfolio,profile), sha = await client.publish(snapshot,output);
    files = output; base = fingerprint(); draft = false;
    try { localStorage.removeItem(key); } catch {}
    updateState();
    status('已发布至 GitHub · ' + sha.slice(0,7) + '。网页部署通常需要几分钟；部署完成后，新内容显示在' + destination(kind, editing) + '。');
  } catch(error) { status(error.message); }
  finally { $('#publish').disabled = false; $('main').inert = false; $('header').inert = false; }
};
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
try {
  files = Object.fromEntries(await Promise.all(EDITABLE_PATHS.map(async path => {
    const response = await fetch('/' + path,{cache:'no-store'});
    if (!response.ok) throw Error('加载失败：' + (PAGE_NAMES[path] || path));
    return [path,await response.text()];
  })));
  ({news,portfolio,profile} = parse(files)); assertValid(news,portfolio,profile); base = fingerprint();
  let failedDraft = false;
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved) { const savedProfile = saved.profile || profile; upgradeLinkedNews(saved.news, saved.portfolio); assertValid(saved.news,saved.portfolio,savedProfile); base = upgradeContentBase(upgradeDraftBase(saved.base,profile),profile); news = saved.news; portfolio = saved.portfolio; profile = savedProfile; draft = true; }
  } catch { failedDraft = true; }
  clearEditor(); list();
  status(failedDraft ? '旧草稿无法读取，已加载线上内容。原草稿未删除。' : draft ? '已恢复本设备草稿。预览确认后连接 GitHub 发布。' : '已加载线上内容。编辑 → 保存草稿 → 预览 → 发布更新。');
} catch(error) {
  status(error.message);
  document.querySelectorAll('button').forEach(button => button.disabled = true);
}
