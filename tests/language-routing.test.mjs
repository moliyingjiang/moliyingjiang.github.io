import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PAGE_PATHS } from '../assets/js/content-model.mjs';
import { renderSite } from '../assets/js/site-renderer.mjs';
import {
  LANGUAGE_PAIRS, validLanguage, pageLanguage, languageUrl,
  languageFromTrace, readGeoCache, startLanguageRouting
} from '../assets/js/language-routing.mjs';

const MANUAL = 'academic-language-v1';
const GEO = 'academic-language-geo-v1';
const NOW = 1_800_000_000_000;
const ORIGIN = 'https://blog.dengshu.cloud';
const options = { now: () => NOW, timeoutMs: 100 };

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value))
  };
}

class Events {
  listeners = new Map();
  addEventListener(type, handler, options = {}) {
    const handlers = this.listeners.get(type) || [];
    handlers.push({ handler, once: options.once });
    this.listeners.set(type, handlers);
  }
  removeEventListener(type, handler) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item.handler !== handler));
  }
  dispatch(type, event = {}) {
    for (const item of [...(this.listeners.get(type) || [])]) {
      if (item.once) this.removeEventListener(type, item.handler);
      item.handler(event);
    }
  }
}

function anchor(href, language = false) {
  return {
    href, language,
    getAttribute(name) { return name === 'href' ? this.href : null; },
    setAttribute(name, value) { if (name === 'href') this.href = value; },
    closest(selector) { return selector === 'a[href]' ? this : null; }
  };
}

function response(body = 'loc=CN\n', { ok = true, contentType = 'text/plain; charset=utf-8' } = {}) {
  return { ok, headers: { get: () => contentType }, text: async () => body };
}

function windowMock(path = '/', config = {}) {
  const win = new Events();
  const links = config.links || [anchor('/zh/', true), anchor('/research.html'), anchor('/cv.pdf')];
  const document = new Events();
  document.querySelectorAll = selector => selector === 'a.language[href]' ? links.filter(link => link.language) : links;
  const fetches = [], redirects = [];
  Object.assign(win, {
    document, links, fetches, redirects,
    location: {
      href: new URL(path, config.origin || ORIGIN).href,
      replace: target => redirects.push(target)
    },
    localStorage: config.local || memoryStorage(),
    sessionStorage: config.session || memoryStorage(),
    fetch: async (...args) => {
      fetches.push(args);
      return config.fetch ? config.fetch(...args) : response();
    }
  });
  win.self = win;
  win.top = config.frame ? {} : win;
  return win;
}

test('all seven public route pairs preserve query and fragment in both directions', () => {
  assert.equal(LANGUAGE_PAIRS.length, 7);
  for (const [en, zh] of LANGUAGE_PAIRS) {
    assert.equal(pageLanguage(en), 'en');
    assert.equal(pageLanguage(zh), 'zh');
    for (const source of [en, zh]) {
      assert.equal(languageUrl(ORIGIN + source + '?tag=a%20b&lang=zh#details', 'en').href,
        ORIGIN + en + '?tag=a+b#details');
      assert.equal(languageUrl(ORIGIN + source + '?tag=a%20b#details', 'zh', true).href,
        ORIGIN + zh + '?tag=a+b&lang=zh#details');
    }
  }
});

test('home aliases, unsupported routes, and invalid language values are handled explicitly', () => {
  for (const path of ['/index.html', '/']) assert.equal(pageLanguage(path), 'en');
  for (const path of ['/zh', '/zh/', '/zh/index.html']) {
    assert.equal(pageLanguage(path), 'zh');
    assert.equal(languageUrl(ORIGIN + path, 'en').pathname, '/');
  }
  for (const path of ['/admin/', '/admin/index.html', '/cv.pdf', '/assets/js/site-renderer.mjs', '/missing.html']) {
    assert.equal(pageLanguage(path), null);
    assert.equal(languageUrl(ORIGIN + path, 'zh'), null);
  }
  for (const language of ['', 'ZH', 'fr', null, undefined, 1]) {
    assert.equal(validLanguage(language), false);
    assert.equal(languageUrl(ORIGIN, language), null);
  }
});

test('country parsing accepts only complete loc fields and uses mainland China only for Chinese', () => {
  assert.equal(languageFromTrace('fl=123\nip=192.0.2.1\nloc=CN\ntls=TLSv1.3\n'), 'zh');
  assert.equal(languageFromTrace('loc=CN\r\n'), 'zh');
  for (const country of ['US', 'TW', 'HK', 'MO', 'GB', 'DE']) {
    assert.equal(languageFromTrace('loc=' + country + '\n'), 'en');
  }
  for (const trace of ['', 'loc=XX\n', 'loc=T1\n', 'loc=cn\n', 'loc=CNX\n', 'xloc=CN\n', '<p>loc=CN</p>', 'loc= CN\n']) {
    assert.equal(languageFromTrace(trace), null);
  }
});

test('first mainland visit redirects every English route to its exact Chinese counterpart', async () => {
  for (const [en, zh] of LANGUAGE_PAIRS) {
    const win = windowMock(en + '?ref=shared#details');
    await startLanguageRouting(win, options);
    assert.deepEqual(win.redirects, [zh + '?ref=shared#details']);
    assert.equal(win.fetches[0][0], '/cdn-cgi/trace');
    assert.equal(win.fetches[0][1].credentials, 'omit');
    assert.equal(win.fetches[0][1].cache, 'no-store');
    assert.equal(win.localStorage.getItem(MANUAL), null);
    assert.deepEqual(JSON.parse(win.sessionStorage.getItem(GEO)), { language: 'zh', expiresAt: NOW + 3_600_000 });
  }
});

test('foreign visits remain English and cache only language and expiry, not trace or IP', async () => {
  const win = windowMock('/research.html', { fetch: async () => response('ip=192.0.2.1\nloc=TW\n') });
  await startLanguageRouting(win, options);
  assert.deepEqual(win.redirects, []);
  assert.deepEqual(JSON.parse(win.sessionStorage.getItem(GEO)), { language: 'en', expiresAt: NOW + 3_600_000 });
  assert.equal([...win.sessionStorage.values.values()].join('').includes('192.0.2.1'), false);
});

test('saved manual preference takes precedence over geolocation without a request', async () => {
  for (const language of ['en', 'zh']) {
    const win = windowMock('/research.html', { local: memoryStorage({ [MANUAL]: language }) });
    await startLanguageRouting(win, options);
    assert.deepEqual(win.redirects, language === 'zh' ? ['/zh/research.html'] : []);
    assert.equal(win.fetches.length, 0);
  }
});

test('explicit lang takes precedence over storage and persists the selected language', async () => {
  for (const [path, language, expected] of [
    ['/research.html?ref=x&lang=zh#part', 'zh', '/zh/research.html?ref=x&lang=zh#part'],
    ['/zh/projects.html?lang=en', 'en', '/projects.html?lang=en'],
    ['/zh/?lang=zh', 'zh', null]
  ]) {
    const win = windowMock(path, { local: memoryStorage({ [MANUAL]: language === 'en' ? 'zh' : 'en' }) });
    await startLanguageRouting(win, options);
    assert.deepEqual(win.redirects, expected ? [expected] : []);
    assert.equal(win.localStorage.getItem(MANUAL), language);
    assert.equal(win.fetches.length, 0);
  }
});

test('Chinese direct links remain Chinese even with a saved English preference', async () => {
  for (const path of [...LANGUAGE_PAIRS.map(pair => pair[1]), '/zh', '/zh/index.html']) {
    const win = windowMock(path, { local: memoryStorage({ [MANUAL]: 'en' }) });
    await startLanguageRouting(win, options);
    assert.deepEqual(win.redirects, []);
    assert.equal(win.fetches.length, 0);
    assert.equal(win.localStorage.getItem(MANUAL), 'en');
  }
});

test('invalid stored and query language values do not block automatic detection', async () => {
  const win = windowMock('/?lang=fr', { local: memoryStorage({ [MANUAL]: 'garbage' }) });
  await startLanguageRouting(win, options);
  assert.deepEqual(win.redirects, ['/zh/']);
  assert.equal(win.fetches.length, 1);
});

test('valid session cache avoids network calls, including cached failures', async () => {
  for (const language of ['en', 'zh', null]) {
    const session = memoryStorage({ [GEO]: JSON.stringify({ language, expiresAt: NOW + 10_000 }) });
    const win = windowMock('/awards.html', { session });
    await startLanguageRouting(win, options);
    assert.equal(win.fetches.length, 0);
    assert.deepEqual(win.redirects, language === 'zh' ? ['/zh/awards.html'] : []);
  }
});

test('expired, malformed, and implausibly long caches are rejected and refreshed', async () => {
  for (const value of [
    'not json', 'null', '{}',
    JSON.stringify({ language: 'zh', expiresAt: NOW }),
    JSON.stringify({ language: 'zh', expiresAt: NOW - 1 }),
    JSON.stringify({ language: 'zh', expiresAt: NOW + 3_600_001 }),
    JSON.stringify({ language: 'fr', expiresAt: NOW + 1_000 }),
    JSON.stringify({ language: 'en', expiresAt: 'tomorrow' })
  ]) {
    const session = memoryStorage({ [GEO]: value });
    assert.equal(readGeoCache(session, NOW), null);
    const win = windowMock('/', { session });
    await startLanguageRouting(win, options);
    assert.equal(win.fetches.length, 1);
    assert.deepEqual(win.redirects, ['/zh/']);
  }
});

test('storage exceptions do not prevent routing and manual URL markers survive without storage', async () => {
  for (const mode of ['getter', 'methods']) {
    const links = [anchor('/zh/', true), anchor('/research.html#part'), anchor('/cv.pdf'), anchor('https://example.org/')];
    const win = windowMock('/?lang=en', { links });
    for (const name of ['localStorage', 'sessionStorage']) {
      if (mode === 'getter') Object.defineProperty(win, name, { get() { throw Error('Blocked storage'); } });
      else win[name] = { getItem() { throw Error('Blocked'); }, setItem() { throw Error('Blocked'); } };
    }
    await startLanguageRouting(win, options);
    assert.deepEqual(win.redirects, []);
    assert.equal(win.fetches.length, 0);
    assert.equal(links[0].href, '/zh/?lang=zh');
    assert.equal(links[1].href, '/research.html?lang=en#part');
    assert.equal(links[2].href, '/cv.pdf');
    assert.equal(links[3].href, 'https://example.org/');
    win.location.href = ORIGIN + '/research.html';
    await startLanguageRouting(win, options);
    assert.deepEqual(win.redirects, ['/zh/research.html']);
  }
});

test('an explicit language URL terminates on the target page without a redirect loop', async () => {
  const start = windowMock('/research.html?lang=zh#part');
  await startLanguageRouting(start, options);
  const end = windowMock(start.redirects[0], { local: start.localStorage });
  await startLanguageRouting(end, options);
  assert.deepEqual(end.redirects, []);
  assert.equal(end.fetches.length, 0);
});

test('manual language links preserve the current deep page, query, and fragment', async () => {
  const link = anchor('/zh/', true);
  const win = windowMock('/research.html?tag=one#details', { links: [link], local: memoryStorage({ [MANUAL]: 'en' }) });
  await startLanguageRouting(win, options);
  assert.equal(link.href, '/zh/research.html?tag=one&lang=zh#details');
  win.document.dispatch('click', { target: { closest: () => link } });
  assert.equal(win.localStorage.getItem(MANUAL), 'zh');
});

test('a manual click cancels a pending geolocation redirect and records the choice', async () => {
  let finish;
  const link = anchor('/zh/', true);
  const win = windowMock('/', { links: [link], fetch: () => new Promise(resolve => { finish = resolve; }) });
  const pending = startLanguageRouting(win, options);
  win.document.dispatch('click', { target: link });
  finish(response());
  await pending;
  assert.equal(win.localStorage.getItem(MANUAL), 'zh');
  assert.deepEqual(win.redirects, []);
  assert.equal(win.sessionStorage.getItem(GEO), null);
  assert.equal(win.fetches[0][1].signal.aborted, true);
});

test('page interaction or navigation cancels late automatic redirects without caching a false failure', async () => {
  for (const event of ['pointerdown', 'touchstart', 'wheel', 'keydown', 'pagehide', 'link']) {
    let finish;
    const win = windowMock('/', { fetch: () => new Promise(resolve => { finish = resolve; }) });
    const pending = startLanguageRouting(win, options);
    if (event === 'link') win.document.dispatch('click', { target: win.links[1] });
    else win.dispatch(event);
    finish(response());
    await pending;
    assert.deepEqual(win.redirects, [], event);
    assert.equal(win.sessionStorage.getItem(GEO), null, event);
    assert.equal(win.fetches[0][1].signal.aborted, true, event);
    assert.equal(win.localStorage.getItem(MANUAL), null, event);
  }
});

test('network errors, unsuccessful responses, HTML, and invalid trace leave English available', async () => {
  const failures = [
    async () => { throw Error('Offline'); },
    async () => response('loc=CN\n', { ok: false }),
    async () => response('loc=CN\n', { contentType: 'text/html' }),
    async () => response('loc=XX\n'),
    async () => response('no country')
  ];
  for (const fetch of failures) {
    const win = windowMock('/', { fetch });
    await startLanguageRouting(win, options);
    assert.deepEqual(win.redirects, []);
    assert.deepEqual(JSON.parse(win.sessionStorage.getItem(GEO)), { language: null, expiresAt: NOW + 300_000 });
  }
});

test('a slow network request is aborted at the deadline and caches a short-lived failure', async () => {
  const win = windowMock('/', {
    fetch: (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Timeout', 'AbortError')), { once: true });
    })
  });
  await startLanguageRouting(win, { ...options, timeoutMs: 5 });
  assert.equal(win.fetches[0][1].signal.aborted, true);
  assert.deepEqual(win.redirects, []);
  assert.deepEqual(JSON.parse(win.sessionStorage.getItem(GEO)), { language: null, expiresAt: NOW + 300_000 });
});

test('late responses from a fetch implementation ignoring abort cannot redirect after the deadline', async () => {
  const win = windowMock('/', {
    fetch: () => new Promise(resolve => setTimeout(() => resolve(response()), 15))
  });
  await startLanguageRouting(win, { ...options, timeoutMs: 1 });
  assert.equal(win.fetches[0][1].signal.aborted, true);
  assert.deepEqual(win.redirects, []);
  assert.deepEqual(JSON.parse(win.sessionStorage.getItem(GEO)), { language: null, expiresAt: NOW + 300_000 });
});

test('malformed and external language links do not interrupt valid routing or save preferences', async () => {
  const links = [anchor('https://[invalid', true), anchor('https://example.org/zh/', true), anchor('/zh/', true)];
  const win = windowMock('/', { links });
  await startLanguageRouting(win, options);
  assert.deepEqual(win.redirects, ['/zh/']);
  assert.equal(links[0].href, 'https://[invalid');
  assert.equal(links[1].href, 'https://example.org/zh/');
  win.document.dispatch('click', { target: links[0] });
  win.document.dispatch('click', { target: links[1] });
  assert.equal(win.localStorage.getItem(MANUAL), null);
});

test('admin, assets, iframe previews, non-HTTP documents, and non-Cloudflare domains never request trace', async () => {
  for (const win of [
    windowMock('/admin/'), windowMock('/admin/index.html'), windowMock('/cv.pdf'),
    windowMock('/', { frame: true }), windowMock('file:///index.html'),
    windowMock('/', { origin: 'https://moliyingjiang.github.io' }),
    windowMock('/', { origin: 'http://localhost:8766' }),
    windowMock('/', { origin: 'http://blog.dengshu.cloud' }),
    windowMock('/', { origin: 'https://example.org' })
  ]) {
    await startLanguageRouting(win, options);
    assert.equal(win.fetches.length, 0, win.location.href);
    assert.deepEqual(win.redirects, [], win.location.href);
    assert.equal(win.localStorage.values.size, 0);
    assert.equal(win.sessionStorage.values.size, 0);
  }
});

test('iframe previews do not write even an explicit language preference', async () => {
  const link = anchor('/zh/', true);
  const win = windowMock('/?lang=zh', { frame: true, links: [link] });
  await startLanguageRouting(win, options);
  assert.equal(win.localStorage.getItem(MANUAL), null);
  assert.equal(link.href, '/zh/');
  assert.equal(win.document.listeners.size, 0);
});

test('rendering all fourteen public pages inserts one routing module and is idempotent', () => {
  const readFile = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const pages = Object.fromEntries(PAGE_PATHS.map(path => [path, readFile(path)]));
  const news = JSON.parse(readFile('assets/data/news.json'));
  const portfolio = JSON.parse(readFile('assets/data/portfolio.json'));
  const profile = JSON.parse(readFile('assets/data/profile.json'));
  const stale = '<script type="module" src="/assets/js/language-routing.mjs?v=old"></script>';
  for (const path of PAGE_PATHS) pages[path] = pages[path].replace('</head>', stale + stale + '</head>');
  const output = renderSite(pages, news, portfolio, profile);
  assert.equal(PAGE_PATHS.length, 14);
  assert.equal(Object.keys(output).filter(path => path.endsWith('.html')).length, 14);
  for (const path of PAGE_PATHS) {
    const matches = [...output[path].matchAll(/<script\b[^>]*src="\/assets\/js\/language-routing\.mjs(?:\?[^"]*)?"[^>]*><\/script>/g)];
    assert.equal(matches.length, 1, path);
    assert.ok(matches[0].index < output[path].indexOf('</head>'), path);
    assert.ok(!matches[0][0].includes('v=old'), path);
  }
  assert.deepEqual(renderSite(output, news, portfolio, profile), output);
});
