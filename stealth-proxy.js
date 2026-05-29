import { launch, ensureBinary } from 'cloakbrowser';

let browser = null;
let browserBusy = false;
const requestQueue = [];
let launchAttempts = 0;
const MAX_LAUNCH_ATTEMPTS = 3;

const STEALTH_PREFIX = '/stealth/';

const PRIVATE_IP_RE = /^(?:10\.|127\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.|0\.|100\.(?:6[4-9]|\d{2})|198\.1[89]\.)/;
const BLOCKED_PROTOCOLS = ['file:', 'chrome:', 'data:', 'javascript:', 'blob:', 'chrome-extension:'];

function isValidUrl(url) {
  try {
    const u = new URL(url);
    if (BLOCKED_PROTOCOLS.includes(u.protocol)) return false;
    const host = u.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '[::1]') return false;
    if (PRIVATE_IP_RE.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

function baseDir(pageUrl) {
  try {
    const u = new URL(pageUrl);
    const path = u.pathname;
    const lastSlash = path.lastIndexOf('/');
    const dir = lastSlash > 0 ? path.substring(0, lastSlash + 1) : '/';
    return u.origin + dir;
  } catch {
    return pageUrl.replace(/\/[^/]*$/, '/');
  }
}

function resolveUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

function shouldProxy(url, originUrl) {
  if (!url) return false;
  try {
    const u = new URL(url);
    const o = new URL(originUrl);
    return u.hostname === o.hostname && u.port === o.port;
  } catch {
    return false;
  }
}

function rewriteAttr(html, tag, attr, proxyFn) {
  const quotedPattern = new RegExp(`(<${tag}[\\s\\S]*?${attr}\\s*=\\s*)"([^"]*)"`, 'gi');
  const singlePattern = new RegExp(`(<${tag}[\\s\\S]*?${attr}\\s*=\\s*)'([^']*)'`, 'gi');
  const unquotedPattern = new RegExp(`(<${tag}[\\s\\S]*?${attr}\\s*=\\s*)([^\\s>"']+)`, 'gi');

  html = html.replace(quotedPattern, (match, before, val) => `${before}"${proxyFn(val)}"`);
  html = html.replace(singlePattern, (match, before, val) => `${before}'${proxyFn(val)}'`);
  html = html.replace(unquotedPattern, (match, before, val) => `${before}${proxyFn(val)}`);
  return html;
}

function rewriteHtml(html, pageUrl) {
  const dir = baseDir(pageUrl);

  const proxyUrl = (url) => {
    const resolved = resolveUrl(url, dir);
    if (!resolved || !shouldProxy(resolved, pageUrl)) return url;
    return `${STEALTH_PREFIX}?url=${encodeURIComponent(resolved)}`;
  };

  let result = html;

  const baseTag = `<base href="${dir}">`;
  if (/<base\s/i.test(result)) {
    result = result.replace(/<base[^>]*>/i, baseTag);
  } else {
    result = result.replace(/<head[^>]*>/i, (m) => `${m}${baseTag}`);
  }

  result = rewriteAttr(result, 'a', 'href', proxyUrl);
  result = rewriteAttr(result, 'form', 'action', proxyUrl);

  const navScript = `
<script>
(function(){
  const proxy = '${STEALTH_PREFIX}?url=';
  const origin = ${JSON.stringify(pageUrl)};
  document.addEventListener('click', function(e) {
    var a = e.target.closest('a');
    if (!a || a.target === '_blank') return;
    var href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
    try {
      var u = new URL(href, ${JSON.stringify(dir)});
      if (u.origin !== new URL(origin).origin) return;
      e.preventDefault();
      window.location.href = proxy + encodeURIComponent(u.href);
    } catch(ex) {}
  }, true);
  var origPush = history.pushState.bind(history);
  var origReplace = history.replaceState.bind(history);
  history.pushState = function(s, t, u) {
    if (u) {
      try {
        var resolved = new URL(u, ${JSON.stringify(dir)}).href;
        if (new URL(resolved).origin === new URL(origin).origin) {
          u = proxy + encodeURIComponent(resolved);
        }
      } catch(ex) {}
    }
    return origPush(s, t, u);
  };
  history.replaceState = function(s, t, u) {
    if (u) {
      try {
        var resolved = new URL(u, ${JSON.stringify(dir)}).href;
        if (new URL(resolved).origin === new URL(origin).origin) {
          u = proxy + encodeURIComponent(resolved);
        }
      } catch(ex) {}
    }
    return origReplace(s, t, u);
  };
})();
</script>`;

  if (/<\/body>/i.test(result)) {
    result = result.replace('</body>', `${navScript}</body>`);
  } else {
    result += navScript;
  }

  return result;
}

async function getBrowser() {
  if (browser) return browser;
  await ensureBinary();
  browser = await launch({
    headless: true,
    args: ['--fingerprint-platform=windows'],
    stealthArgs: true,
  });
  browser.on('disconnected', () => { browser = null; browserBusy = false; });
  return browser;
}

async function processQueue() {
  if (browserBusy || requestQueue.length === 0) return;
  browserBusy = true;
  const { url, resolve, reject } = requestQueue.shift();
  try {
    const b = await getBrowser();
    launchAttempts = 0;
    const page = await b.newPage();
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      const html = await page.content();
      const modified = rewriteHtml(html, url);
      resolve(modified);
    } finally {
      await page.close();
    }
  } catch (err) {
    if (++launchAttempts < MAX_LAUNCH_ATTEMPTS) {
      requestQueue.unshift({ url, resolve, reject });
      browser = null;
    } else {
      launchAttempts = 0;
      reject(err);
    }
  } finally {
    browserBusy = false;
    processQueue();
  }
}

export async function fetchPage(url) {
  if (!isValidUrl(url)) {
    throw new Error('Invalid or blocked URL');
  }
  return new Promise((resolve, reject) => {
    requestQueue.push({ url, resolve, reject });
    processQueue();
  });
}

export async function shutdown() {
  if (browser) {
    try { await browser.close(); } catch {}
    browser = null;
  }
}
