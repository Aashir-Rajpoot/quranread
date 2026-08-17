// js/router.js
// Minimal hash router. Hash URLs double as deep links, e.g.:
//   #/                     -> home
//   #/quran                -> surah index
//   #/quran/2              -> reader, Al-Baqarah, ayah 1
//   #/quran/2/37           -> reader, Al-Baqarah, ayah 37 (shareable deep link)
//   #/bookmarks #/search #/settings

const routes = [];
let notFoundHandler = () => {};

export function route(pattern, handler) {
  const paramNames = [];
  const regex = new RegExp(
    '^' + pattern.replace(/:[^/]+/g, (m) => { paramNames.push(m.slice(1)); return '([^/]+)'; }) + '$'
  );
  routes.push({ regex, paramNames, handler });
}

export function notFound(handler) { notFoundHandler = handler; }

function currentPath() {
  const hash = location.hash.replace(/^#/, '');
  return hash === '' ? '/' : hash;
}

async function resolve() {
  const path = currentPath().split('?')[0].replace(/\/+$/, '') || '/';
  for (const r of routes) {
    const match = path.match(r.regex);
    if (match) {
      const params = {};
      r.paramNames.forEach((name, i) => { params[name] = decodeURIComponent(match[i + 1]); });
      await r.handler(params);
      return;
    }
  }
  await notFoundHandler();
}

export function navigate(path) {
  if (currentPath() === path) resolve();
  else location.hash = path;
}

export function startRouter() {
  window.addEventListener('hashchange', resolve);
  resolve();
}
