import { EDITABLE_PATHS, PAGE_PATHS, TYPES, STATUSES, ROLES, DATE_TYPES, esc, clone, newId, today, validateContent, adjustAwardTotals, syncLinkedNews } from '../assets/js/content-model.mjs';
import { renderSite } from '../assets/js/site-renderer.mjs';
import { GitHub } from './github.mjs';
const $ = selector => document.querySelector(selector), key = 'portfolio-editor-v1';
const names = { news: '动态', awards: '荣誉', publications: '论文', projects: '项目' };
const labels = { title:'标题', text:'正文', result:'奖项 / 等级', rankLabel:'排名说明', rank:'名次（如 3 / 65）', journal:'期刊', metrics:'分区与年份（如 JCR 2025 · Q1）', summary:'摘要说明', category:'方向', moreLabel:'附加链接文字', moreUrl:'附加链接' };
const resetButton = document.createElement('button'); resetButton.textContent='放弃本地草稿'; $('header').append(resetButton);
resetButton.onclick=()=>{ if(confirm('清除本设备草稿并重新加载线上内容？需要保留的修改请先导出。')) { localStorage.removeItem(key); dirty=false; location.reload(); } };
let files, news, portfolio, base, client, snapshot, kind = 'news', editing, bucket, dirty = false, draft = false;
const status = message => { $('#status').textContent = message; };
const parse = f => ({ news: JSON.parse(f['assets/data/news.json']), portfolio: JSON.parse(f['assets/data/portfolio.json']) });
const fingerprint = () => JSON.stringify([news, portfolio]);
function saveDraft() { draft = true; try { localStorage.setItem(key, JSON.stringify({ news, portfolio, base })); status('已保存到本设备草稿，尚未发布。'); } catch { status('本设备无法保存草稿，请立即导出备份。'); } }
function assertValid(n, p) { const errors = validateContent(n, p); if (errors.length) throw new Error(errors.join('\n')); }
function records() { return kind === 'news' ? [...news.events, ...news.grouped] : portfolio[kind]; }
function list() {
  $('#nav').innerHTML = Object.entries(names).map(([id, name]) => `<button type="button" data-kind="${id}" class="${id === kind ? 'selected' : ''}">${name}</button>`).join('');
  const stage = $('#filter').value, query = $('#search').value.toLowerCase();
  $('#list').innerHTML = records().filter(r => (!stage || (stage === 'undergraduate' ? r.stage !== 'graduate' : r.stage === stage)) && (r.zh.title + r.en.title).toLowerCase().includes(query)).map(r => `<button data-id="${esc(r.id)}">${esc(r.zh.title)}<small>${r.stage === 'graduate' ? '硕士' : '本科'} · ${esc(r.date || r.period || '')}</small></button>`).join('');
}
const field = (name, value, label, area = false) => `<label>${esc(label)}${area ? `<textarea name="${name}">${esc(value)}</textarea>` : `<input name="${name}" value="${esc(value)}">`}</label>`;
const select = (name, value, label, options) => `<label>${label}<select name="${name}">${Object.entries(options).map(([v, l]) => `<option value="${v}" ${value === v ? 'selected' : ''}>${esc(Array.isArray(l) ? l[0] : l)}</option>`).join('')}</select></label>`;
function edit(record) {
  editing = clone(record); dirty = false;
  bucket = kind === 'news' && news.grouped.some(r => r.id === record.id) ? 'grouped' : 'events';
  let html = `<h2>编辑${names[kind]}</h2>` + select('stage', record.stage, '所属阶段', { undergraduate:'本科', graduate:'硕士', ...(kind === 'news' ? { continuation:'本科研究后续' } : {}) });
  html += field(kind === 'projects' ? 'period' : 'date', record.date || record.period || '', kind === 'projects' ? '项目时间（同步 News 时需以 YYYY.MM 开头）' : '日期 YYYY.MM.DD 或 YYYY.MM（约定日期前加 ≈）');
  if (kind === 'awards') html += select('type', record.type, '荣誉类型', TYPES) + field('quantity', record.quantity, '数量') + `<label><input type="checkbox" name="counted" ${record.counted ? 'checked' : ''}>计入汇总（补录已统计的旧荣誉不要勾选）</label><label><input type="checkbox" name="cumulative" ${record.cumulative ? 'checked' : ''}>累计记录</label>`;
  if (kind === 'publications') html += select('status', record.status, '论文状态', STATUSES) + select('role', record.role, '作者身份', ROLES) + select('dateType', record.dateType, '日期含义', DATE_TYPES) + `<label><input type="checkbox" name="followUp" ${record.followUp ? 'checked' : ''}>本科项目后续成果</label>` + field('url', record.url, '论文链接') + field('metricsSource', record.metricsSource, '分区来源链接');
  if (kind === 'projects') html += field('gitee', record.gitee, 'Gitee 链接') + field('github', record.github, 'GitHub 链接');
  if (kind === 'news') html += select('award', record.award || '', '关联荣誉（可选）', { '':'无', ...Object.fromEntries(portfolio.awards.map(r => [r.id, r.zh.title])), national:'国家级汇总', provincial:'省级汇总', innovation:'大创汇总', university:'校级汇总', software:'软件汇总', graduate:'硕士汇总' });
  const fields = kind === 'awards' ? ['title','result','rankLabel','rank'] : kind === 'publications' ? ['title','journal','metrics','summary'] : kind === 'projects' ? ['title','category','text','moreLabel','moreUrl'] : ['title','text'];
  html += '<div class="languages">' + ['zh','en'].map(lang => `<div><h3>${lang === 'zh' ? '中文' : 'English'}</h3>${fields.map(k => field(lang + '.' + k, record[lang]?.[k] || '', labels[k], ['text','summary','title'].includes(k))).join('')}</div>`).join('') + '</div>';
  if (kind !== 'news') html += '<label><input type="checkbox" name="sync">同时新增 / 更新关联 News</label>';
  html += '<div class="actions"><button class="primary" type="submit">保存草稿</button><button type="button" id="delete">删除记录</button></div>';
  $('#editor').innerHTML = html;
}
function clearEditor() { editing = null; dirty = false; $('#editor').innerHTML = '<p>选择记录或新增一条内容。中文与英文分别填写，发布时一起更新。</p>'; }
const leave = () => !dirty || confirm('当前表单还没有保存，放弃这些输入？');
$('#nav').onclick = e => { if (e.target.dataset.kind && leave()) { kind = e.target.dataset.kind; clearEditor(); list(); } };
$('#list').onclick = e => { const id = e.target.closest('[data-id]')?.dataset.id; if (id && leave()) edit(records().find(r => r.id === id)); };
$('#search').oninput = list; $('#filter').onchange = list;
$('#add').onclick = () => { if (!leave()) return; edit({ id:newId(kind), stage:$('#filter').value || 'graduate', date:today(), period:'', en:{title:''}, zh:{title:''}, ...(kind === 'awards' ? {type:'national-award',section:'national',quantity:1,counted:true,cumulative:false} : {}), ...(kind === 'publications' ? {status:'submitted',role:'coauthor',dateType:'submitted',followUp:false} : {}) }); };
$('#editor').oninput = () => { dirty = true; };
$('#editor').onsubmit = e => {
  e.preventDefault(); if (!editing) return;
  try {
    const next = clone(editing), form = new FormData(e.target), n = clone(news), p = clone(portfolio);
    for (const [k,v] of form) { if (k.includes('.')) { const [lang, name] = k.split('.'); next[lang][name] = v.trim(); } else if (!['sync','counted','cumulative','followUp'].includes(k)) next[k] = v.trim(); }
    if (kind === 'awards') { next.quantity = Number(next.quantity); next.section = TYPES[next.type][1]; next.counted = form.has('counted'); next.cumulative = form.has('cumulative'); }
    if (kind === 'publications') next.followUp = next.stage === 'undergraduate' && form.has('followUp');
    const target = kind === 'news' ? n[bucket] : p[kind], index = target.findIndex(r => r.id === next.id);
    if (kind === 'awards') adjustAwardTotals(p, index < 0 ? null : target[index], next);
    if (index < 0) target.push(next); else target[index] = next;
    if (form.has('sync')) syncLinkedNews(n, kind, next);
    assertValid(n,p); news = n; portfolio = p; saveDraft(); list(); edit(next);
  } catch (error) { status(error.message); }
};
$('#editor').onclick = e => {
  if (e.target.id !== 'delete' || !editing || !confirm('从草稿中删除这条记录？线上内容只有发布后才会改变。')) return;
  const target = kind === 'news' ? news[bucket] : portfolio[kind], index = target.findIndex(r => r.id === editing.id);
  if (index >= 0) { if (kind === 'awards') { adjustAwardTotals(portfolio, target[index], null); for (const r of [...news.events,...news.grouped]) if (r.award === editing.id) r.award = ''; } target.splice(index,1); saveDraft(); } clearEditor(); list();
};
$('#export').onclick = () => { const url = URL.createObjectURL(new Blob([JSON.stringify({news,portfolio,base},null,2)],{type:'application/json'})); const a = document.createElement('a'); a.href=url; a.download='portfolio-draft.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000); };
$('#import').onchange = async e => { try { const file = e.target.files[0]; if (!file) return; if (file.size > 5e6) throw Error('文件过大。'); const data = JSON.parse(await file.text()); assertValid(data.news,data.portfolio); if (!confirm('使用导入内容替换本设备草稿？')) return; news=data.news; portfolio=data.portfolio; base=data.base || ''; saveDraft(); clearEditor(); list(); } catch(error) { status(error.message); } finally { e.target.value=''; } };
$('#connect').onclick = () => { if (dirty) return status('请先保存当前表单再连接。'); $('#auth').showModal(); };
$('#login').onclick = async () => {
  $('#login').disabled=true;
  try {
    const candidate = new GitHub($('#token').value.trim()); $('#token').value='';
    const remote = await candidate.snapshot(), content = parse(remote.files); assertValid(content.news,content.portfolio);
    if (draft && base !== JSON.stringify([content.news,content.portfolio])) throw Error('远程内容已改变。请先导出草稿，清除本设备草稿后刷新，再连接并合并。');
    if (!draft) { news=content.news; portfolio=content.portfolio; base=fingerprint(); }
    client=candidate; snapshot=remote; files=remote.files; $('#auth').close(); status('已连接 GitHub · moliyingjiang/moliyingjiang.github.io'); clearEditor(); list();
  } catch(error) { status(error.message); $('#auth').close(); } finally { $('#login').disabled=false; }
};
function preview() { const path=$('#preview-page').value, output=renderSite(files,news,portfolio); $('iframe').srcdoc=output[path].replace('<head>', '<head><base href="' + location.origin + '/' + (path.startsWith('zh/') ? 'zh/' : '') + '">'); }
$('#preview').onclick = () => { try { if (dirty) throw Error('请先保存当前表单再预览。'); preview(); $('#preview-dialog').showModal(); } catch(error) { status(error.message); } };
$('#preview-page').innerHTML=PAGE_PATHS.map(path=>`<option>${path}</option>`).join(''); $('#preview-page').onchange=preview; $('#close-preview').onclick=()=>$('#preview-dialog').close();
$('#publish').onclick = async () => {
  if (dirty) return status('请先保存当前表单。');
  if (!client || !snapshot) return $('#auth').showModal();
  if (!confirm('将当前草稿发布到 GitHub？网页部署需要几分钟。')) return;
  $('#publish').disabled=true;
  try { const output=renderSite(files,news,portfolio); const sha=await client.publish(snapshot,output); files=output; base=fingerprint(); draft=false; localStorage.removeItem(key); status('已提交 GitHub：' + sha.slice(0,7) + '。等待 Pages 部署后查看主页；Gitee 同步结果请查看 GitHub Actions。'); } catch(error) { status(error.message); } finally { $('#publish').disabled=false; }
};
window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue=''; } });
try {
  files=Object.fromEntries(await Promise.all(EDITABLE_PATHS.map(async path => { const r=await fetch('/'+path,{cache:'no-store'}); if(!r.ok) throw Error('加载失败：'+path); return [path,await r.text()]; })));
  ({news,portfolio}=parse(files)); assertValid(news,portfolio); base=fingerprint();
  try { const saved=JSON.parse(localStorage.getItem(key)); if(saved) { assertValid(saved.news,saved.portfolio); news=saved.news; portfolio=saved.portfolio; base=saved.base; draft=true; } } catch { status('旧草稿无法读取，已加载线上内容。'); }
  list(); status(draft ? '已恢复本设备草稿，尚未发布。' : '已加载线上内容。修改保存为本地草稿，连接 GitHub 后发布。');
} catch(error) { status(error.message); document.querySelectorAll('button').forEach(b=>b.disabled=true); }
