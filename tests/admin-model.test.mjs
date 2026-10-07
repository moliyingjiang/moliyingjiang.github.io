import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { clone, upgradeLinkedNews } from '../assets/js/content-model.mjs';
import { previewPath, recordAnchor, findSource, destination, changeCount, newsState, upgradeContentBase, createConfirmation, assertPublicationBaseline, createConnectionAttempts } from '../admin/editor-model.mjs';
const news = JSON.parse(fs.readFileSync('assets/data/news.json'));
const portfolio = JSON.parse(fs.readFileSync('assets/data/portfolio.json'));

test('preview follows the edited category rather than always opening the homepage', () => {
  assert.equal(previewPath('awards'), 'awards.html');
  assert.equal(previewPath('publications', 'zh'), 'zh/research.html');
  assert.equal(previewPath('projects'), 'projects.html');
  assert.equal(recordAnchor('news', { id: 'ielts' }), 'news-ielts');
  assert.equal(recordAnchor('awards', { id: 'ielts' }), 'ielts');
  assert.match(destination('news', { stage: 'graduate' }), /首页动态、完整时间线 · 硕士/);
  assert.match(destination('awards', { stage: 'graduate' }), /荣誉与资格页 · 硕士/);
});

test('source navigation distinguishes a linked record from a shared award reference', () => {
  const paper = portfolio.publications[0];
  assert.equal(findSource({ sourceType: 'publications', sourceId: paper.id }, portfolio).record.id, paper.id);
  const award = portfolio.awards[0];
  assert.equal(findSource({ award: award.id }, portfolio).referenceOnly, true);
  assert.equal(findSource({ sourceType: 'awards', sourceId: award.id, award: award.id }, portfolio).referenceOnly, undefined);
  assert.equal(findSource({ id: 'unlinked-news' }, portfolio), null);
});

test('draft counter notices additions, deletions and changed content without recounting unchanged records', () => {
  const base = JSON.stringify([news, portfolio]), n = clone(news), p = clone(portfolio);
  assert.equal(changeCount(base, n, p), 0);
  n.events[0].zh.title += ' changed';
  p.awards.pop();
  p.projects.push({ ...p.projects[0], id: 'new-project' });
  assert.equal(changeCount(base, n, p), 3);
  assert.equal(changeCount('invalid', n, p), null);
});

test('detached legacy paper events stay independent even if their original source is later re-created', () => {
  const item = { id: 'measurement', detachedSource: { kind: 'publications', id: 'measurement' } };
  assert.equal(findSource(item, portfolio), null);
  assert.equal(newsState(item, portfolio), 'detached');
  assert.equal(newsState({ cumulative: true }, portfolio), 'archived');
});

test('legacy source metadata upgrades both draft content and conflict baseline consistently', () => {
  const p = clone(portfolio), paper = p.publications.find(record => record.id === 'measurement');
  const n = { events: [{ id: 'measurement', date: paper.date, stage: 'continuation', sourceType: 'publications', sourceId: paper.id, en: { title: 'Authorship confirmation', text: 'An authorship notification' }, zh: { title: '作者确认', text: '收到共同作者确认通知' } }], grouped: [] };
  const profile = { test: 'profile baseline' }, raw = JSON.stringify([n, p]);
  const base = upgradeContentBase(raw, profile);
  upgradeLinkedNews(n, p);
  assert.equal(changeCount(base, n, p, profile), 0);
  assert.equal(upgradeContentBase(base, profile), base);
  assert.equal(n.events[0].sourceEvent, 'authorship');
});
test('publishing rejects a stale imported baseline even after the connection uses the latest remote head', () => {
  const remote={news:clone(news),portfolio:clone(portfolio),profile:{test:'current profile'}};
  upgradeLinkedNews(remote.news,remote.portfolio);
  const base=JSON.stringify([remote.news,remote.portfolio,remote.profile]);
  assert.doesNotThrow(()=>assertPublicationBaseline(base,remote));
  const old=JSON.parse(base);old[0].events.pop();
  assert.throws(()=>assertPublicationBaseline(JSON.stringify(old),remote),/草稿来源.*不一致/);
  assert.throws(()=>assertPublicationBaseline('',remote),/草稿来源.*不一致/);
});
test('legacy baseline metadata remains compatible regardless of JSON object key order', () => {
  const n=clone(news),p=clone(portfolio),profile={test:'profile baseline'};
  upgradeLinkedNews(n,p);
  const old=clone(n);
  for(const item of old.events) if(item.sourceSnapshot){delete item.sourceSnapshot.date;delete item.sourceSnapshot.stage;}
  const reorder=value=>Array.isArray(value)?value.map(reorder):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse().map(([key,item])=>[key,reorder(item)])):value;
  const base=JSON.stringify(reorder([old,p,profile]));
  assert.doesNotThrow(()=>assertPublicationBaseline(base,{news:n,portfolio:p,profile}));
});
test('historical source references cannot offer an editable current-source regeneration path', () => {
  const paper=portfolio.publications.find(record=>record.id==='measurement');
  const item={sourceType:'publications',sourceId:paper.id,historical:true,referenceOnly:true};
  assert.equal(findSource(item,portfolio).referenceOnly,true);
});
test('cancelled or superseded GitHub attempts cannot replace content or unlock a newer pending connection', async () => {
  const attempts=createConnectionAttempts();let disabled=false,connected=null;
  const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};};
  const connect=async result=>{const attempt=attempts.begin();disabled=true;try{const value=await result.promise;if(attempts.isCurrent(attempt))connected=value;}finally{if(attempts.isCurrent(attempt))disabled=false;}};
  const old=deferred(),oldWork=connect(old);attempts.invalidate();disabled=false;
  const current=deferred(),currentWork=connect(current);
  old.resolve('cancelled content');await oldWork;
  assert.equal(connected,null);assert.equal(disabled,true);
  current.resolve('current content');await currentWork;
  assert.equal(connected,'current content');assert.equal(disabled,false);
  attempts.invalidate();assert.equal(connected,'current content','closing a successfully connected auth dialog does not discard the client');
});

class ConfirmationDialog extends EventTarget {
  open = false;
  returnValue = '';
  cancelFocused = 0;
  triggerFocused = 0;
  ownerDocument = { activeElement: { focus: () => this.triggerFocused++ } };
  querySelector() { return { focus: () => this.cancelFocused++ }; }
  showModal() { this.open = true; }
  close(value) { if (value !== undefined) this.returnValue = value; this.open = false; this.dispatchEvent(new Event('close')); }
}

test('HTML confirmation waits for an explicit decision and restores focus', async () => {
  const dialog = new ConfirmationDialog(), message = {}, confirm = createConfirmation(dialog, message);
  let settled = false;
  const decision = confirm('删除本条记录？').then(value => { settled = true; return value; });
  assert.equal(dialog.open, true); assert.equal(settled, false); assert.equal(message.textContent, '删除本条记录？');
  assert.equal(dialog.cancelFocused, 1);
  dialog.close('confirm');
  assert.equal(await decision, true); assert.equal(dialog.triggerFocused, 1);
  const next = confirm('第二次确认'); dialog.close('cancel');
  assert.equal(await next, false);
});

test('Escape and repeated clicks cannot silently approve a pending operation', async () => {
  const dialog = new ConfirmationDialog(), confirm = createConfirmation(dialog, {});
  const pending = confirm('放弃本地草稿？');
  assert.equal(await confirm('重复点击'), false);
  const escape = new Event('cancel', { cancelable: true }); dialog.dispatchEvent(escape);
  assert.equal(escape.defaultPrevented, true); assert.equal(dialog.open, false); assert.equal(await pending, false);
  const next = confirm('后续操作'); dialog.close(); assert.equal(await next, false);
});

test('a failed dialog open does not leave confirmation stuck pending', async () => {
  const dialog = new ConfirmationDialog(), confirm = createConfirmation(dialog, {});
  dialog.showModal = () => { throw new Error('Cannot open'); };
  await assert.rejects(confirm('操作'), /Cannot open/);
  dialog.showModal = () => { dialog.open = true; };
  const next = confirm('重试'); dialog.close('confirm'); assert.equal(await next, true);
});
test('missing confirmation controls or an unavailable focus target never leave a pending operation', async () => {
  const missing=createConfirmation(null,{});
  await assert.rejects(missing('操作'),/刷新管理页/);await assert.rejects(missing('重试'),/刷新管理页/);
  const dialog=new ConfirmationDialog();dialog.ownerDocument.activeElement.focus=()=>{throw Error('Focus unavailable');};
  const confirm=createConfirmation(dialog,{}),decision=confirm('确认');dialog.close('confirm');assert.equal(await decision,true);
  const next=confirm('下一次');dialog.close('cancel');assert.equal(await next,false);
});
