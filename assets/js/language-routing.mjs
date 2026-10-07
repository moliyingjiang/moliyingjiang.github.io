const MANUAL_KEY = 'academic-language-v1';
const GEO_KEY = 'academic-language-geo-v1';
const GEO_HOST = 'blog.dengshu.cloud';
const GEO_TTL = 60 * 60 * 1000;
const FAILURE_TTL = 5 * 60 * 1000;

export const LANGUAGE_PAIRS = [
  ['/', '/zh/'],
  ...['milestones', 'research', 'projects', 'practice', 'awards', 'cv'].map(name => ['/' + name + '.html', '/zh/' + name + '.html']),
  ['/undergraduate-record.html', '/undergraduate-cv.html'],
  ['/graduate-record.html', '/graduate-cv.html']
];
export const validLanguage = value => value === 'en' || value === 'zh';
const canonicalPath = path => ({ '/index.html': '/', '/zh': '/zh/', '/zh/index.html': '/zh/' })[path] || path;
export function pageLanguage(path) {
  const pair = LANGUAGE_PAIRS.find(pair => pair.includes(canonicalPath(path)));
  return pair ? pair.indexOf(canonicalPath(path)) === 0 ? 'en' : 'zh' : null;
}
export function languageUrl(input, language, explicit = false) {
  if (!validLanguage(language)) return null;
  const url = new URL(input);
  const pair = LANGUAGE_PAIRS.find(pair => pair.includes(canonicalPath(url.pathname)));
  if (!pair) return null;
  url.pathname = pair[language === 'zh' ? 1 : 0];
  if (explicit) url.searchParams.set('lang', language);
  else url.searchParams.delete('lang');
  return url;
}
export function languageFromTrace(text) {
  // Read only the country field; never retain the visitor's IP or full trace.
  const country = /^loc=([A-Z]{2})\r?$/m.exec(text)?.[1];
  if (!country || ['XX', 'T1'].includes(country)) return null;
  return country === 'CN' ? 'zh' : 'en';
}
function read(store, key) { try { return store?.getItem(key); } catch { return null; } }
function write(store, key, value) { try { store?.setItem(key, value); return Boolean(store); } catch { return false; } }
function storage(win, name) { try { return win[name]; } catch { return null; } }
function linkUrl(link, base) { try { return new URL(link.getAttribute('href'), base); } catch { return null; } }
export function readGeoCache(store, now) {
  try {
    const cached = JSON.parse(read(store, GEO_KEY));
    return cached && (cached.language === null || validLanguage(cached.language)) &&
      Number.isFinite(cached.expiresAt) && cached.expiresAt > now && cached.expiresAt <= now + GEO_TTL
      ? cached : null;
  } catch { return null; }
}

export async function startLanguageRouting(win, { timeoutMs = 1800, now = () => Date.now() } = {}) {
  const current = new URL(win.location.href), currentLanguage = pageLanguage(current.pathname);
  // Public pages only. The editor's srcdoc previews must not navigate or write preferences.
  if (!currentLanguage || !['https:', 'http:'].includes(current.protocol) || win.top !== win.self) return;

  const local = storage(win, 'localStorage'), session = storage(win, 'sessionStorage');
  const explicit = current.searchParams.get('lang');
  let preferred = validLanguage(explicit) ? explicit : read(local, MANUAL_KEY);
  if (!validLanguage(preferred)) preferred = null;
  let persisted = preferred ? read(local, MANUAL_KEY) === preferred : false;
  if (validLanguage(explicit)) persisted = write(local, MANUAL_KEY, explicit);

  let cancelled = false, controller;
  const cancel = () => { cancelled = true; controller?.abort(); };
  const switches = [...win.document.querySelectorAll('a.language[href]')];
  for (const link of switches) {
    const target = linkUrl(link, current);
    const language = target?.origin === current.origin && pageLanguage(target.pathname);
    if (!language) continue;
    // A URL marker also handles a new tab and browsers with storage disabled.
    const next = languageUrl(current, language, true);
    link.setAttribute('href', next.pathname + next.search + next.hash);
  }
  win.document.addEventListener('click', event => {
    const link = event.target?.closest?.('a[href]');
    if (!link) return;
    cancel();
    if (!switches.includes(link)) return;
    const target = linkUrl(link, current);
    const language = target?.searchParams.get('lang');
    if (target?.origin === current.origin && validLanguage(language)) write(local, MANUAL_KEY, language);
  });
  win.addEventListener('pagehide', cancel, { once: true });

  if (!persisted && preferred === currentLanguage) {
    // Keep a deliberate choice during navigation even when storage is unavailable.
    for (const link of win.document.querySelectorAll('a[href]')) {
      const target = linkUrl(link, current);
      if (target?.origin === current.origin && pageLanguage(target.pathname) === currentLanguage) {
        target.searchParams.set('lang', preferred);
        link.setAttribute('href', target.pathname + target.search + target.hash);
      }
    }
  }
  const navigate = language => {
    if (cancelled || !language || language === currentLanguage) return;
    const target = languageUrl(current, language, Boolean(validLanguage(explicit)));
    if (target) win.location.replace(target.pathname + target.search + target.hash);
  };
  if (validLanguage(explicit)) { navigate(explicit); return; }
  // A shared Chinese URL is already an explicit language choice for this visit.
  if (currentLanguage === 'zh') return;
  if (preferred) { navigate(preferred); return; }

  const cached = readGeoCache(session, now());
  if (cached) { navigate(cached.language); return; }
  if (current.hostname !== GEO_HOST || current.protocol !== 'https:' || !win.fetch) return;

  controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // Do not switch the language under someone who has already begun using the page.
  for (const event of ['pointerdown', 'touchstart', 'wheel', 'keydown']) {
    win.addEventListener(event, cancel, { once: true, passive: true });
  }
  try {
    const response = await win.fetch('/cdn-cgi/trace', {
      cache: 'no-store', credentials: 'omit', signal: controller.signal
    });
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.includes('text/plain')) throw Error('No location data');
    const language = languageFromTrace(await response.text());
    if (controller.signal.aborted) throw Error('Location request cancelled');
    if (!cancelled) {
      write(session, GEO_KEY, JSON.stringify({ language, expiresAt: now() + (language ? GEO_TTL : FAILURE_TTL) }));
      navigate(language);
    }
  } catch {
    if (!cancelled) write(session, GEO_KEY, JSON.stringify({ language: null, expiresAt: now() + FAILURE_TTL }));
    // English remains available if Cloudflare is slow, offline, or cannot locate an IP.
  } finally {
    clearTimeout(timer);
    for (const event of ['pointerdown', 'touchstart', 'wheel', 'keydown']) win.removeEventListener(event, cancel);
  }
}

if (typeof window !== 'undefined') {
  startLanguageRouting(window).catch(() => {});
}
