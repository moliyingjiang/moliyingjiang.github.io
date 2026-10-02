import { EDITABLE_PATHS, PAGE_PATHS, TYPES, STATUSES, ROLES, DATE_TYPES, esc, clone, newId, today, validDate, byDate, validateContent, adjustAwardTotals, syncLinkedNews, findLinkedNews } from '../assets/js/content-model.mjs';
import { renderSite } from '../assets/js/site-renderer.mjs';
import { GitHub } from './github.mjs?v=20261001-fetch-binding';
import { KIND_NAMES, PAGE_NAMES, previewPath, recordAnchor, findSource, destination, changeCount } from './editor-model.mjs?v=20261003-editor';

const $ = selector => document.querySelector(selector);
const key = 'portfolio-editor-v1';
const labels = { title:'标题', text:'正文', result:'奖项 / 等级 / 成绩', rankLabel:'排名说明', rank:'名次（如 3 / 65）', journal:'期刊', metrics:'分区与年份（如 JCR 2025 · Q1）', summary:'研究说明', category:'研究方向', moreLabel:'附加链接文字', moreUrl:'附加链接' };
let files, news, portfolio, base, client, snapshot, kind = 'news', editing, bucket;
let dirty = false, draft = false;
const status = message => { $('#status').textContent = message; };
const parse = source => ({ news: JSON.parse(source['assets/data/news.json']), portfolio: JSON.parse(source['assets/data/portfolio.json']) });
const fingerprint = () => JSON.stringify([news, portfolio]);
const allNews = () => [...news.events, ...news.grouped];
function updateState() {
  const count = changeCount(base, news, portfolio);
  $('#draft-state').textContent = dirty ? '当前表单未保存' : count ? count + ' 项草稿修改' : draft ? '草稿与线上内容一致' : '与线上内容一致';
  $('#draft-state').classList.toggle('pending', dirty || !!count);
  $('#connect').textContent = client ? 'GitHub 已连接' : '连接 GitHub';
}
function saveDraft(message = '已保存到本设备草稿，尚未发布。') {
  draft = true;
  try { localStorage.setItem(key, JSON.stringify({ news, portfolio, base })); status(message); }
  catch { status('本设备无法保存草稿，请导出备份后再关闭页面。'); }
  updateState();
}
function assertValid(n, p) {
  const errors = validateContent(n, p);
  if (errors.length) throw new Error(errors.join('\n'));
}
function records() { return kind === 'news' ? allNews() : portfolio[kind]; }
function list() {
  const count = id => id === 'news' ? allNews().length : portfolio[id].length;
  $('#nav').innerHTML = Object.entries(KIND_NAMES).map(([id, name]) =>
    '<button type="button" data-kind="' + id + '" class="' + (id === kind ? 'selected' : '') + '" aria-pressed="' + (id === kind) + '">' + name + '<span>' + count(id) + '</span></button>').join('');
  const stage = $('#filter').value, query = $('#search').value.trim().toLowerCase();
  const filtered = records().filter(record =>
    (!stage || (stage === 'undergraduate' ? record.stage !== 'graduate' : record.stage === stage)) &&
    (record.zh.title + ' ' + record.en.title).toLowerCase().includes(query)
  ).slice().sort(byDate);
  $('#list').innerHTML = filtered.length ? filtered.map(record =>
    '<button type="button" data-id="' + esc(record.id) + '" class="' + (editing?.id === record.id ? 'selected' : '') + '">' + esc(record.zh.title) +
    '<small>' + (record.stage === 'graduate' ? '硕士' : record.stage === 'continuation' || record.followUp ? '本科研究后续' : '本科') + ' · ' + esc(record.date || record.period || '时间未填写') + '</small></button>'
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

function context(record) {
  const source = kind === 'news' ? findSource(record, portfolio) : null;
  const linked = kind !== 'news' ? findLinkedNews(news, kind, record) : null;
  let hint;
  if (kind === 'news') hint = '这条记录显示在动态与时间线。证书、成绩或奖项的完整记录请在“荣誉与资格”中添加。';
  else hint = '勾选下方“同步动态与足迹”，可同时更新首页动态和时间线。';
  const link = source ? '<button type="button" data-open-kind="' + source.kind + '" data-open-id="' + esc(source.record.id) + '">' + (source.referenceOnly ? '编辑引用的' : '编辑关联的') + KIND_NAMES[source.kind] + ' →</button>' :
    linked ? '<button type="button" data-open-kind="news" data-open-id="' + esc(linked.id) + '">编辑关联动态 →</button>' : '';
  return '<div class="destination"><strong id="destination-text">显示位置：' + esc(destination(kind, record)) + '</strong><p>' + hint + '</p>' + link + '</div>';
}
function edit(record) {
  editing = clone(record); dirty = false;
  bucket = kind === 'news' && news.grouped.some(item => item.id === record.id) ? 'grouped' : 'events';
  const existing = records().some(item => item.id === record.id);
  const linked = kind === 'news' ? null : findLinkedNews(news, kind, record);
  const canSync = kind !== 'projects' || validDate((record.period || '').split(/[—–]/)[0].trim());
  const sync = !!linked || !existing && canSync;
  let html = '<div class="editor-heading"><div><p class="overline">' + (existing ? 'EDIT RECORD' : 'NEW RECORD') + '</p><h2>' + (existing ? '编辑' : '新增') + KIND_NAMES[kind] + '</h2></div><span class="record-id">' + esc(record.id) + '</span></div>' + context(record);
  html += '<div class="form-grid">' + select('stage', record.stage, '所属阶段', { undergraduate:'本科', graduate:'硕士', ...(kind === 'news' ? { continuation:'本科研究后续' } : {}) });
  html += field(kind === 'projects' ? 'period' : 'date', kind === 'projects' ? record.period || '' : record.date || '', kind === 'projects' ? '项目时间（如 2026.09 — 至今）' : '日期（YYYY.MM.DD 或 YYYY.MM）') + '</div>';
  html += '<p class="field-help">' + (kind === 'projects' ? '同步动态时，使用项目时间的起始日期；未填时间的项目也可单独发布。' : '约定日期在前面加 ≈，例如 ≈2024.06。') + '</p>';
  if (kind === 'awards') {
    html += '<div class="form-section"><h3>荣誉、资格与汇总</h3><div class="form-grid">' + select('type', record.type, '记录类型（语言成绩请选择资格证书）', TYPES) + field('quantity', record.quantity, '数量', false, 'number') + '</div>';
    html += '<label class="check-row"><input type="checkbox" name="counted" ' + (record.counted ? 'checked' : '') + '>新增荣誉计入汇总</label><p class="field-help">补录已统计的旧荣誉时取消勾选。资格证书、校级荣誉不改变竞赛奖项汇总。</p><label class="check-row"><input type="checkbox" name="cumulative" ' + (record.cumulative ? 'checked' : '') + '>这是一条累计记录</label></div>';
  }
  if (kind === 'publications') {
    html += '<div class="form-section"><h3>论文信息</h3><div class="form-grid">' + select('status', record.status, '论文状态', STATUSES) + select('role', record.role, '作者身份', ROLES) + select('dateType', record.dateType, '日期含义', DATE_TYPES) + field('url', record.url, '论文链接（可选）') + field('metricsSource', record.metricsSource, '分区来源链接（可选）') + '</div>';
    html += '<label class="check-row"><input type="checkbox" name="followUp" ' + (record.followUp ? 'checked' : '') + '>本科项目后续成果</label><p class="field-help">本科项目延续形成的论文仍归入本科；硕士记录不勾选这一项。</p></div>';
  }
  if (kind === 'projects') html += '<div class="form-section"><h3>代码与材料</h3><div class="form-grid">' + field('gitee', record.gitee, 'Gitee 仓库（国内访问）') + field('github', record.github, 'GitHub 仓库（国际访问）') + '</div></div>';
  if (kind === 'news') html += '<div class="form-section">' + select('award', record.award || '', '引用荣誉记录（仅提供跳转，可选）', { '':'无', ...Object.fromEntries(portfolio.awards.map(item => [item.id, item.zh.title])), national:'国家级汇总', provincial:'省级汇总', innovation:'大创汇总', university:'校级汇总', software:'软件汇总', graduate:'硕士汇总' }) + '<p class="field-help">选择引用不会新建或修改荣誉记录。完整内容在对应荣誉记录中维护。</p></div>';
  const fields = kind === 'awards' ? ['title','result','rankLabel','rank'] : kind === 'publications' ? ['title','journal','metrics','summary'] : kind === 'projects' ? ['title','category','text','moreLabel','moreUrl'] : ['title','text'];
  html += '<div class="languages">' + ['zh','en'].map(lang =>
    '<div><h3>' + (lang === 'zh' ? '中文版本' : 'English version') + '</h3>' + fields.map(name => field(lang + '.' + name, record[lang]?.[name] || '', labels[name], ['text','summary','title'].includes(name))).join('') + '</div>'
  ).join('') + '</div>';
  if (kind !== 'news') html += '<div class="sync-panel"><label><input type="checkbox" name="sync" ' + (sync ? 'checked' : '') + '>同步动态与足迹</label><p class="field-help">' + (linked ? '同时更新这条记录已有的关联 News，不重复新增。' : '保存时新增一条关联 News。未勾选时，只更新上方显示位置。') + '</p></div>';
  html += '<div class="actions"><small>保存为本地草稿，发布后才会更新网站。</small><button class="primary" type="submit">保存草稿</button><button type="button" id="editor-preview">预览这条记录</button>' + (existing ? '<button type="button" id="delete">删除</button>' : '') + '</div>';
  $('#editor').innerHTML = html;
  list(); updateState();
}
function clearEditor() {
  editing = null; dirty = false;
  const help = {news:'动态显示在首页与完整时间线；语言成绩、证书和奖项请在“荣誉与资格”中维护。',awards:'竞赛奖项、奖学金、资格证书和语言成绩均在这里维护，可同步生成首页动态。',publications:'按本科与硕士阶段维护论文，准确填写投稿、审稿、接收或发表状态。',projects:'维护研究项目介绍，以及 Gitee 与 GitHub 的代码入口。'}[kind];
  $('#editor').innerHTML = '<div class="empty-editor"><p class="overline">PERSONAL ACADEMIC RECORD</p><h1>' + KIND_NAMES[kind] + '</h1><p>' + help + '</p><p>选择一条记录，或点击“新增”。中英文分别填写，预览确认后发布。</p></div>';
  updateState();
}
const leave = () => !dirty || confirm('当前表单还没有保存，放弃这些输入？');
function choose(nextKind, id) {
  if (!leave()) return;
  if (nextKind !== kind) $('#search').value = '';
  kind = nextKind;
  const record = records().find(item => item.id === id);
  if (record) {
    $('#search').value = '';
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
$('#search').oninput = list; $('#filter').onchange = list;
$('#add').onclick = () => {
  if (!leave()) return;
  const record = { id:newId(kind), stage:$('#filter').value || 'graduate', en:{title:''}, zh:{title:''} };
  if (kind === 'projects') record.period = '';
  else record.date = today();
  if (kind === 'awards') Object.assign(record, {type:'national-award',section:'national',quantity:1,counted:true,cumulative:false});
  if (kind === 'publications') Object.assign(record, {status:'submitted',role:'coauthor',dateType:'submitted',followUp:false});
  edit(record);
};
$('#editor').oninput = event => {
  dirty = true;
  if (['stage','followUp'].includes(event.target.name)) {
    const form = new FormData($('#editor'));
    $('#destination-text').textContent = '显示位置：' + destination(kind, {...editing,stage:form.get('stage'),followUp:form.get('stage') === 'undergraduate' && form.has('followUp')});
  }
  updateState();
};
$('#editor').onsubmit = event => {
  event.preventDefault();
  if (!editing) return;
  try {
    const next = clone(editing), form = new FormData(event.target), n = clone(news), p = clone(portfolio);
    for (const [name,value] of form) {
      if (name.includes('.')) { const [lang, field] = name.split('.'); next[lang][field] = value.trim(); }
      else if (!['sync','counted','cumulative','followUp'].includes(name)) next[name] = value.trim();
    }
    if (kind === 'projects') delete next.date;
    if (kind === 'awards') { next.quantity = Number(next.quantity); next.section = TYPES[next.type][1]; next.counted = form.has('counted'); next.cumulative = form.has('cumulative'); }
    if (kind === 'publications') next.followUp = next.stage === 'undergraduate' && form.has('followUp');
    const target = kind === 'news' ? n[bucket] : p[kind], index = target.findIndex(record => record.id === next.id);
    if (kind === 'awards') adjustAwardTotals(p, index < 0 ? null : target[index], next);
    if (index < 0) target.push(next); else target[index] = next;
    if (form.has('sync')) {
      if (kind === 'projects' && !validDate((next.period || '').split(/[—–]/)[0].trim())) throw Error('同步动态需要项目起始日期，例如 2026.09 — 至今；也可以取消同步，只保存项目。');
      syncLinkedNews(n, kind, next);
    }
    assertValid(n, p); news = n; portfolio = p;
    edit(next);
    saveDraft('草稿已保存。显示于' + destination(kind, next) + (form.has('sync') ? '，关联动态也已同步。' : '。') + '点击预览确认，再发布更新。');
  } catch (error) { status(error.message); }
};
$('#editor').onclick = event => {
  const opener = event.target.closest('[data-open-kind]');
  if (opener) return choose(opener.dataset.openKind, opener.dataset.openId);
  if (event.target.id === 'editor-preview') return showPreview();
  if (event.target.id !== 'delete' || !editing || !confirm('从草稿中删除这条记录？发布后才会更新线上内容；已有动态记录将保留。')) return;
  const target = kind === 'news' ? news[bucket] : portfolio[kind], index = target.findIndex(record => record.id === editing.id);
  if (index >= 0) {
    if (kind === 'awards') adjustAwardTotals(portfolio, target[index], null);
    if (kind !== 'news') for (const record of allNews()) {
      if (kind === 'awards' && record.award === editing.id) record.award = '';
      if (record.sourceType === kind && record.sourceId === editing.id) { delete record.sourceType; delete record.sourceId; }
    }
    target.splice(index, 1); clearEditor(); list(); saveDraft('已从草稿删除记录，已有动态保留。发布后更新网站。');
  }
};
$('#reset').onclick = () => {
  if (confirm('放弃本设备草稿并重新加载线上内容？需要保留的修改请先导出。')) {
    try { localStorage.removeItem(key); } catch {}
    dirty = false; location.reload();
  }
};
$('#export').onclick = () => {
  if (dirty) return status('请先保存当前表单，再导出完整草稿。');
  const url = URL.createObjectURL(new Blob([JSON.stringify({news,portfolio,base},null,2)],{type:'application/json'}));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'portfolio-draft-' + today().replaceAll('.','-') + '.json'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
  status('草稿已导出，包含所有已保存内容，可在其他设备导入。');
};
$('#import').onchange = async event => {
  try {
    const file = event.target.files[0]; if (!file) return;
    if (file.size > 5e6) throw Error('文件过大。');
    const data = JSON.parse(await file.text()); assertValid(data.news,data.portfolio);
    if (!confirm('使用导入内容替换本设备草稿？')) return;
    news = data.news; portfolio = data.portfolio; base = data.base || '';
    clearEditor(); list(); saveDraft('已导入草稿，预览后连接 GitHub 发布。');
  } catch(error) { status(error.message); }
  finally { event.target.value = ''; }
};
$('#connect').onclick = () => {
  if (dirty) return status('请先保存当前表单，再连接 GitHub。');
  $('#auth').showModal();
};
$('#auth').addEventListener('close', () => { $('#token').value = ''; });
$('#login').onclick = async () => {
  $('#login').disabled = true;
  try {
    const token = $('#token').value.trim();
    if (!token) throw Error('请填写 GitHub 访问令牌。');
    const candidate = new GitHub(token); $('#token').value = '';
    const remote = await candidate.snapshot(), content = parse(remote.files); assertValid(content.news,content.portfolio);
    if (draft && base !== JSON.stringify([content.news,content.portfolio])) throw Error('线上内容已有更新。你的草稿已保留：先导出，再放弃本地草稿并重新连接，按需要合并修改。');
    if (!draft) { news = content.news; portfolio = content.portfolio; base = fingerprint(); }
    client = candidate; snapshot = remote; files = remote.files;
    $('#auth').close();
    if (editing) { const current = records().find(record => record.id === editing.id); if (current) edit(current); else clearEditor(); }
    list(); updateState(); status('GitHub 已连接。预览确认后，点击“发布更新”。');
  } catch(error) { status(error.message); $('#auth').close(); }
  finally { $('#login').disabled = false; }
};
function preview() {
  const path = $('#preview-page').value, output = renderSite(files,news,portfolio);
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
  $('#preview-note').textContent = editing ? target ? '已定位当前记录，蓝色边框仅用于预览。' : '此页面不展示当前记录；对应位置：' + destination(kind, editing) + '。' : '预览已保存草稿；发布后才会更新线上页面。';
}
function showPreview() {
  try {
    if (dirty) throw Error('请先保存当前表单，再预览这条记录。');
    const language = $('#preview-page').value.startsWith('zh/') || ['graduate-cv.html','undergraduate-cv.html'].includes($('#preview-page').value) ? 'zh' : 'en';
    $('#preview-page').value = previewPath(kind, language);
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
  const count = changeCount(base, news, portfolio);
  if (!confirm('将' + (count ? '当前 ' + count + ' 项草稿修改' : '当前内容') + '发布到 GitHub？部署完成后网站更新，Gitee 自动同步。')) return;
  $('#publish').disabled = true; $('main').inert = true; $('header').inert = true;
  try {
    const output = renderSite(files,news,portfolio), sha = await client.publish(snapshot,output);
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
  ({news,portfolio} = parse(files)); assertValid(news,portfolio); base = fingerprint();
  let failedDraft = false;
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved) { assertValid(saved.news,saved.portfolio); news = saved.news; portfolio = saved.portfolio; base = saved.base; draft = true; }
  } catch { failedDraft = true; }
  clearEditor(); list();
  status(failedDraft ? '旧草稿无法读取，已加载线上内容。原草稿未删除。' : draft ? '已恢复本设备草稿。预览确认后连接 GitHub 发布。' : '已加载线上内容。编辑 → 保存草稿 → 预览 → 发布更新。');
} catch(error) {
  status(error.message);
  document.querySelectorAll('button').forEach(button => button.disabled = true);
}
