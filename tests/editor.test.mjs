import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PAGE_PATHS, validateContent, clone, adjustAwardTotals, validDate, safeUrl, syncLinkedNews, findLinkedNews, linkedNews, upgradeLinkedNews, detachLinkedNews } from '../assets/js/content-model.mjs';
import { renderSite } from '../assets/js/site-renderer.mjs';
import { GitHub } from '../admin/github.mjs';
const portfolio=JSON.parse(fs.readFileSync('assets/data/portfolio.json'));
const news=upgradeLinkedNews(JSON.parse(fs.readFileSync('assets/data/news.json')),portfolio);
const pages=Object.fromEntries(PAGE_PATHS.map(path=>[path,fs.readFileSync(path,'utf8')]));
test('default fetch retains the browser global receiver',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async function(){ assert.equal(this,globalThis,'native Window.fetch requires the global receiver'); return {ok:true,json:async()=>({ok:true})}; };
  try { assert.deepEqual(await new GitHub('test').request('git/ref/heads/main'),{ok:true}); }
  finally { globalThis.fetch=original; }
});
test('existing bilingual records validate and rendering is stable',()=>{ assert.deepEqual(validateContent(news,portfolio),[]); const out=renderSite(pages,news,portfolio); assert.deepEqual(renderSite(out,news,portfolio),out); });
test('reject invalid dates and unsafe links',()=>{ assert.equal(validDate('2026.02.30'),false); assert.equal(validDate('≈2026.09'),true); for(const url of ['javascript:alert(1)','//evil.test','/\\evil.test','data:text/html,x']) assert.equal(safeUrl(url),false); const p=clone(portfolio); p.awards[0].stage='unknown'; assert.ok(validateContent(news,p).length); });
test('rendered text is escaped and Measurement remains undergraduate',()=>{ const p=clone(portfolio); p.publications[0].en.title='<img src=x onerror=alert(1)>'; const out=renderSite(pages,news,p); assert.ok(out['research.html'].includes('&lt;img')); assert.ok(!out['research.html'].includes('<img src=x')); const measurement=portfolio.publications.find(r=>r.id==='measurement'); assert.equal(measurement.stage,'undergraduate'); assert.ok(!out['graduate-record.html'].includes('publication-measurement')); });
test('counted awards update totals without recounting imported history',()=>{ const p=clone(portfolio), start=p.totals.graduate.nationalAwards; const r={stage:'graduate',type:'national-award',quantity:1,counted:true}; adjustAwardTotals(p,null,r); assert.equal(p.totals.graduate.nationalAwards,start+1); adjustAwardTotals(p,r,{...r,quantity:2}); assert.equal(p.totals.graduate.nationalAwards,start+2); adjustAwardTotals(p,{...r,quantity:2},null); assert.equal(p.totals.graduate.nationalAwards,start); });
test('empty graduate publication lists can be rendered repeatedly',()=>{ const p=clone(portfolio); p.publications=p.publications.filter(r=>r.stage!=='graduate'); const out=renderSite(pages,news,p); assert.deepEqual(renderSite(out,news,p),out); });
test('replacement metacharacters remain literal text',()=>{ const p=clone(portfolio), n=clone(news); p.publications[0].en.title='Cost $& $$ research'; n.events[0].en.title='Cost $& $$ news'; const out=renderSite(pages,n,p); assert.ok(out['research.html'].includes('Cost $&amp; $$ research')); assert.ok(out['index.html'].includes('Cost $&amp; $$ news')); assert.deepEqual(renderSite(out,n,p),out); });
test('updating legacy paper news does not create duplicates',()=>{ const n=clone(news), before=n.events.length; syncLinkedNews(n,'publications',portfolio.publications.find(r=>r.id==='road-crack')); assert.equal(n.events.length,before); assert.equal(n.events.find(r=>r.id==='road-paper').sourceId,'road-crack'); });
test('cumulative award summaries never generate or replace a specific news event',()=>{
  const n=clone(news), original=clone(n);
  const record={...clone(portfolio.awards[0]),cumulative:true};
  assert.equal(syncLinkedNews(n,'awards',record),null);
  assert.deepEqual(n,original);
});
test('editing an undergraduate award preserves its historical follow-up phase in news',()=>{
  const n=clone(news),record=portfolio.awards.find(r=>r.id==='national-1');
  assert.equal(findLinkedNews(n,'awards',record).stage,'continuation');
  syncLinkedNews(n,'awards',record);
  assert.equal(findLinkedNews(n,'awards',record).stage,'continuation');
  syncLinkedNews(n,'awards',{...record,stage:'graduate'});
  assert.equal(findLinkedNews(n,'awards',record).stage,'graduate');
});
test('individual scholarship does not overwrite archived summaries or user-edited qualifications',()=>{
  const n=clone(news);
  const aggregate={...clone(n.events[0]),id:'old-scholarships',cumulative:true}, qualifications={...clone(n.events[0]),id:'manual-qualifications',sourceType:undefined,sourceId:undefined,award:'',zh:{title:'雅思 6.5',text:'本次考试成绩'}};
  n.grouped.push(aggregate);n.events.push(qualifications);
  const record={...clone(portfolio.awards[0]),id:'individual-scholarship',type:'scholarship',section:'university',cumulative:false};assert.equal(findLinkedNews(n,'awards',record),undefined);
  syncLinkedNews(n,'awards',record);
  assert.deepEqual(n.grouped.find(r=>r.id==='old-scholarships'),aggregate);
  assert.deepEqual(n.events.find(r=>r.id==='manual-qualifications'),qualifications);
});
test('new publication status reaches the homepage, research page and electronic records',()=>{
  const p=clone(portfolio);p.publications.find(r=>r.id==='measurement').status='accepted';p.publications.find(r=>r.id==='measurement').dateType='accepted';
  const out=renderSite(pages,news,p);
  for(const path of ['research.html','undergraduate-record.html','undergraduate-cv.html']) assert.ok(out[path].includes('data-status="accepted"'),path);
  assert.ok(out['index.html'].includes('1 accepted manuscript'));
  assert.ok(out['cv.html'].includes('1 accepted manuscript'));
});
test('cumulative records are rejected as news while specific paper details remain linked',()=>{
  const n=clone(news);n.events[0]={...n.events[0],stage:'graduate',cumulative:true};
  assert.ok(validateContent(n,portfolio).some(error=>error.includes('具体事件')));
  const out=renderSite(pages,news,portfolio);
  assert.ok(out['index.html'].includes('/research.html#publication-sustainability'));
});
test('historical news remains readable without broken links after a paper or project is removed',()=>{
  const n=clone(news),p=clone(portfolio),project={...clone(p.projects[0]),period:'2026.09 — present'};
  syncLinkedNews(n,'projects',project);
  p.projects=p.projects.filter(record=>record.id!==project.id);
  p.publications=p.publications.filter(record=>record.id!=='measurement');
  const out=renderSite(pages,n,p);
  assert.ok(out['index.html'].includes('news-measurement'));
  for(const path of ['index.html','milestones.html','zh/index.html','zh/milestones.html']){
    assert.ok(!out[path].includes('#publication-measurement'),path);
    assert.ok(!out[path].includes('#project-'+project.id),path);
  }
});
test('publication history adds one event for each stage and updates the same stage without duplication',()=>{
  const n={events:[],grouped:[]}, paper=clone(portfolio.publications.find(record=>record.id==='measurement'));
  Object.assign(paper,{date:'2026.09.30',dateType:'authorship',status:'submitted'});
  syncLinkedNews(n,'publications',paper);
  const notification=clone(n.events[0]);
  Object.assign(paper,{date:'2026.10.01',dateType:'submitted',status:'submitted'});
  syncLinkedNews(n,'publications',paper);
  const submission=clone(n.events[1]);
  Object.assign(paper,{date:'2026.11.15',status:'accepted'});
  syncLinkedNews(n,'publications',paper);
  paper.zh.title='更完整的论文标题';paper.en.title='A fuller paper title';paper.date='2026.11.16';
  syncLinkedNews(n,'publications',paper);
  assert.equal(n.events.length,3);
  assert.deepEqual(n.events[0],notification);assert.deepEqual(n.events[1],submission);
  assert.equal(n.events[2].date,'2026.11.16');assert.equal(n.events[2].zh.title,paper.zh.title);
  Object.assign(paper,{date:'2027.01.10',dateType:'published',status:'published'});
  syncLinkedNews(n,'publications',paper);assert.equal(n.events.length,4);
});
test('source updates preserve hand-written news and refresh untouched names, ranks, and dates',()=>{
  const n={events:[],grouped:[]}, award={...clone(portfolio.awards[0]),cumulative:false};
  const item=syncLinkedNews(n,'awards',award);item.zh.title='为这次比赛精写的完整事件标题';
  award.zh.title='比赛的完整名称';award.en.title='The full competition name';award.zh.rankLabel='全国决赛';award.zh.rank='3 / 65';award.date='2026.10.05';
  const next=syncLinkedNews(n,'awards',award);
  assert.equal(n.events.length,1);assert.equal(next.zh.title,item.zh.title);assert.equal(next.en.title,award.en.title);
  assert.ok(next.zh.text.includes('全国决赛 3 / 65'));assert.equal(next.date,'2026.10.05');
  syncLinkedNews(n,'awards',award,{overwrite:true});assert.equal(n.events[0].zh.title,award.zh.title);
});
test('manual event dates and stages survive repeated source synchronization',()=>{
  const n={events:[],grouped:[]},paper=clone(portfolio.publications.find(record=>record.id==='sustainability'));
  const event=syncLinkedNews(n,'publications',paper);event.date='2026.09.27';event.stage='undergraduate';
  paper.date='2026.10.01';paper.zh.title='更完整的同节点标题';
  syncLinkedNews(n,'publications',paper);
  assert.equal(n.events[0].date,'2026.09.27');assert.equal(n.events[0].stage,'undergraduate');
  assert.equal(n.events[0].sourceSnapshot.date,'2026.10.01');assert.equal(n.events[0].sourceSnapshot.stage,'graduate');
  syncLinkedNews(n,'publications',paper,{overwrite:true});
  assert.equal(n.events[0].date,'2026.09.27');assert.equal(n.events[0].stage,'undergraduate');
});
test('legacy text-only source snapshots gain date metadata without changing edited historical fields',()=>{
  const p=clone(portfolio),paper=p.publications.find(record=>record.id==='sustainability'),event=linkedNews('publications',paper);
  delete event.sourceSnapshot.date;delete event.sourceSnapshot.stage;event.date='2026.09.27';event.stage='undergraduate';
  const n={events:[event],grouped:[]};upgradeLinkedNews(n,p);
  assert.equal(n.events[0].sourceSnapshot.date,paper.date);assert.equal(n.events[0].sourceSnapshot.stage,paper.stage);
  paper.date='2026.10.03';syncLinkedNews(n,'publications',paper);
  assert.equal(n.events[0].date,'2026.09.27');assert.equal(n.events[0].stage,'undergraduate');
});
test('a manually referenced award stays a reference after reload and does not become a synchronization target',()=>{
  const p=clone(portfolio),award=p.awards[0],event={id:'independent-report',date:award.date,stage:'graduate',award:award.id,referenceOnly:true,en:{title:'Independent report',text:'A report about the result'},zh:{title:'独立报道事件',text:'对获奖结果进行报道'}};
  const n={events:[clone(event)],grouped:[]};upgradeLinkedNews(n,p);
  assert.deepEqual(n.events[0],event);assert.equal(findLinkedNews(n,'awards',award),undefined);
  syncLinkedNews(n,'awards',award);assert.equal(n.events.length,2);assert.deepEqual(n.events[0],event);
});
test('a historical earlier manuscript version never absorbs the current author role, title or date',()=>{
  const p=clone(portfolio),paper=p.publications.find(record=>record.id==='measurement');
  const early={id:'measurement-early-version',date:'2026.03.15',stage:'continuation',historical:true,referenceOnly:true,sourceType:'publications',sourceId:paper.id,sourceEvent:'submitted',award:'',en:{title:'Earlier manuscript title',text:'First author · Submitted'},zh:{title:'前期版本的原题目',text:'第一作者 · 已投稿'}};
  const n={events:[clone(early)],grouped:[]};upgradeLinkedNews(n,p);
  Object.assign(paper,{date:'2026.10.03',dateType:'submitted',status:'submitted',role:'coauthor'});
  syncLinkedNews(n,'publications',paper);assert.equal(n.events.length,2);assert.deepEqual(n.events[0],early);
  assert.equal(n.events[0].sourceSnapshot,undefined);
});
test('old drafts retain concrete events, migrate concrete grouped news and archive totals without losing text',()=>{
  const award=clone(portfolio.awards[0]);award.cumulative=true;
  const original={id:'historic-award',date:'2024.06',stage:'undergraduate',award:award.id,en:{title:'A specific competition result',text:'Third prize'},zh:{title:'一次具体竞赛获奖',text:'三等奖'}};
  const total={...clone(original),id:'legacy-total',cumulative:true,zh:{title:'旧版累计荣誉',text:'旧版原文'}};
  const grouped={...clone(original),id:'grouped-specific',award:''};
  const n={events:[clone(original)],grouped:[total,grouped]}, p={...clone(portfolio),awards:[award]};
  upgradeLinkedNews(n,p);
  assert.equal(n.events.length,2);assert.equal(n.grouped.length,1);
  assert.equal(n.events[0].zh.text,original.zh.text);assert.equal(n.events[0].award,'');assert.equal(n.events[0].detachedSource.reason,'summary-reference');
  assert.equal(n.grouped[0].zh.text,'旧版原文');
  assert.deepEqual(upgradeLinkedNews(clone(n),p),n);
});
test('legacy publication nodes are inferred without replacing a different historical stage',()=>{
  const paper=clone(portfolio.publications.find(record=>record.id==='measurement'));
  const n={events:[{id:'measurement',date:'2026.09.30',stage:'continuation',sourceType:'publications',sourceId:paper.id,award:'',en:{title:'Authorship confirmation',text:'Industrial meter paper'},zh:{title:'论文作者确认',text:'收到作者确认通知'}}],grouped:[]};
  Object.assign(paper,{date:'2026.11.15',dateType:'accepted',status:'accepted'});
  const p={...clone(portfolio),publications:[paper]};upgradeLinkedNews(n,p);
  assert.equal(n.events[0].sourceEvent,'authorship');
  syncLinkedNews(n,'publications',paper);assert.equal(n.events.length,2);assert.equal(n.events[0].date,'2026.09.30');
});
test('acceptance and publication dates cannot be labelled as an authorship notification',()=>{
  const p=clone(portfolio),paper=p.publications.find(record=>record.id==='measurement');
  paper.status='accepted';paper.dateType='authorship';
  assert.ok(validateContent(news,p).some(error=>error.includes('日期含义须对应')));
  const n=clone(news);upgradeLinkedNews(n,p);
  assert.equal(paper.dateType,'accepted');
  assert.equal(n.events.find(record=>record.id==='measurement').sourceEvent,'authorship');
});
test('deleting a source preserves all distinct events as visibly detached history',()=>{
  const n={events:[],grouped:[]}, paper=clone(portfolio.publications[0]);
  Object.assign(paper,{dateType:'submitted',status:'submitted'});syncLinkedNews(n,'publications',paper);
  Object.assign(paper,{dateType:'accepted',status:'accepted',date:'2026.11.01'});syncLinkedNews(n,'publications',paper);
  const text=n.events.map(record=>clone(record.zh));detachLinkedNews(n,'publications',paper.id);
  assert.deepEqual(n.events.map(record=>record.zh),text);
  for(const item of n.events){assert.equal(item.detachedSource.id,paper.id);assert.equal(item.sourceType,undefined);assert.equal(item.sourceSnapshot,undefined);}
  assert.equal(findLinkedNews(n,'publications',paper),undefined);
});
test('publisher refuses a stale head before writing',async()=>{ let calls=0; const api=new GitHub('test',async()=>{calls++;return {ok:true,json:async()=>({object:{sha:'new'}})};}); await assert.rejects(api.publish({head:'old',tree:'t',files:{}},{'index.html':'x'}),/新版本/); assert.equal(calls,1); });
test('atomic publication uses changed files and non-force branch update',async()=>{ const calls=[], replies=[{object:{sha:'old'}},{sha:'tree2'},{sha:'commit2'},{}]; const api=new GitHub('test',async(url,options)=>{ calls.push({url,...options});return {ok:true,json:async()=>replies.shift()}; }); const s={head:'old',tree:'tree1',files:{'index.html':'same'}}; await api.publish(s,{'index.html':'same','zh/index.html':'changed'}); assert.equal(JSON.parse(calls[1].body).tree.length,1); assert.deepEqual(JSON.parse(calls[3].body),{sha:'commit2',force:false}); assert.equal(s.head,'commit2'); });
test('failed reference update leaves snapshot unchanged; paths are restricted',async()=>{ const replies=[{object:{sha:'old'}},{sha:'tree2'},{sha:'commit2'}]; const api=new GitHub('test',async()=>replies.length?{ok:true,json:async()=>replies.shift()}:{ok:false,status:422}); const s={head:'old',tree:'t',files:{}}; await assert.rejects(api.publish(s,{'index.html':'x'})); assert.equal(s.head,'old'); await assert.rejects(api.publish(s,{'.github/workflows/evil.yml':'x'}),/禁止/); });
