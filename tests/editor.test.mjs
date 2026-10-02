import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PAGE_PATHS, validateContent, clone, adjustAwardTotals, validDate, safeUrl, syncLinkedNews, findLinkedNews } from '../assets/js/content-model.mjs';
import { renderSite } from '../assets/js/site-renderer.mjs';
import { GitHub } from '../admin/github.mjs';
const news=JSON.parse(fs.readFileSync('assets/data/news.json'));
const portfolio=JSON.parse(fs.readFileSync('assets/data/portfolio.json'));
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
test('cumulative awards update their exact summary without replacing a single historical result',()=>{
  const n=clone(news), original=clone(n.events.find(r=>r.id==='challenge-2024'));
  const record=clone(portfolio.awards.find(r=>r.id==='provincial-4'));record.zh.result='累计 4 项';
  syncLinkedNews(n,'awards',record);
  assert.deepEqual(n.events.find(r=>r.id==='challenge-2024'),original);
  assert.ok(n.grouped.find(r=>r.id==='challenge-total').zh.text.includes('4 项'));
});
test('editing an undergraduate award preserves its historical follow-up phase in news',()=>{
  const n=clone(news),record=portfolio.awards.find(r=>r.id==='national-1');
  assert.equal(findLinkedNews(n,'awards',record).stage,'continuation');
  syncLinkedNews(n,'awards',record);
  assert.equal(findLinkedNews(n,'awards',record).stage,'continuation');
  syncLinkedNews(n,'awards',{...record,stage:'graduate'});
  assert.equal(findLinkedNews(n,'awards',record).stage,'graduate');
});
test('individual scholarship does not overwrite an aggregate or user-edited qualifications',()=>{
  const n=clone(news), aggregate=clone(n.grouped.find(r=>r.id==='scholarships')), qualifications=clone(n.grouped.find(r=>r.id==='qualifications'));
  const record=portfolio.awards.find(r=>r.id==='university-5');assert.equal(findLinkedNews(n,'awards',record),undefined);
  syncLinkedNews(n,'awards',record);
  assert.deepEqual(n.grouped.find(r=>r.id==='scholarships'),aggregate);
  assert.deepEqual(n.grouped.find(r=>r.id==='qualifications'),qualifications);
});
test('new publication status reaches the homepage, research page and electronic records',()=>{
  const p=clone(portfolio);p.publications.find(r=>r.id==='measurement').status='accepted';p.publications.find(r=>r.id==='measurement').dateType='accepted';
  const out=renderSite(pages,news,p);
  for(const path of ['research.html','undergraduate-record.html','undergraduate-cv.html']) assert.ok(out[path].includes('data-status="accepted"'),path);
  assert.ok(out['index.html'].includes('1 accepted manuscript'));
  assert.ok(out['cv.html'].includes('1 accepted manuscript'));
});
test('graduate cumulative news is labelled correctly and paper details are linked',()=>{
  const n=clone(news);n.events[0]={...n.events[0],stage:'graduate',cumulative:true};
  const out=renderSite(pages,n,portfolio);
  assert.ok(out['index.html'].includes('Graduate total'));
  assert.ok(out['zh/index.html'].includes('硕士累计'));
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
test('publisher refuses a stale head before writing',async()=>{ let calls=0; const api=new GitHub('test',async()=>{calls++;return {ok:true,json:async()=>({object:{sha:'new'}})};}); await assert.rejects(api.publish({head:'old',tree:'t',files:{}},{'index.html':'x'}),/新版本/); assert.equal(calls,1); });
test('atomic publication uses changed files and non-force branch update',async()=>{ const calls=[], replies=[{object:{sha:'old'}},{sha:'tree2'},{sha:'commit2'},{}]; const api=new GitHub('test',async(url,options)=>{ calls.push({url,...options});return {ok:true,json:async()=>replies.shift()}; }); const s={head:'old',tree:'tree1',files:{'index.html':'same'}}; await api.publish(s,{'index.html':'same','zh/index.html':'changed'}); assert.equal(JSON.parse(calls[1].body).tree.length,1); assert.deepEqual(JSON.parse(calls[3].body),{sha:'commit2',force:false}); assert.equal(s.head,'commit2'); });
test('failed reference update leaves snapshot unchanged; paths are restricted',async()=>{ const replies=[{object:{sha:'old'}},{sha:'tree2'},{sha:'commit2'}]; const api=new GitHub('test',async()=>replies.length?{ok:true,json:async()=>replies.shift()}:{ok:false,status:422}); const s={head:'old',tree:'t',files:{}}; await assert.rejects(api.publish(s,{'index.html':'x'})); assert.equal(s.head,'old'); await assert.rejects(api.publish(s,{'.github/workflows/evil.yml':'x'}),/禁止/); });
