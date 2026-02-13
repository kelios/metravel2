#!/usr/bin/env node
/**
 * Post-build SEO page generator.
 *
 * After `expo export` produces a single index.html (SPA), this script creates
 * per-route copies with unique <title>, <meta description>, <link canonical>,
 * and Open Graph / Twitter tags so that search-engine crawlers see correct
 * metadata without executing JavaScript.
 *
 * Usage:
 *   node scripts/generate-seo-pages.js [--dist <dir>] [--api <url>]
 *
 * Defaults:
 *   --dist  dist/prod          (output of `expo export`)
 *   --api   https://metravel.by (production API)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const DIST_DIR = path.resolve(getArg('dist', 'dist/prod'));
const API_BASE = getArg('api', 'https://metravel.by').replace(/\/+$/, '');
const SITE_URL = 'https://metravel.by';
const OG_IMAGE = `${SITE_URL}/og-preview.jpg`;
const DEFAULT_DESC = 'Добавляй поездки, фото и заметки — и собирай красивую книгу в PDF для печати.';
const FALLBACK_DESC = 'Найди место для путешествия и поделись своим опытом.';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fetch JSON from a URL (follows redirects). */
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const opts = { timeout: 30000 };
    // Allow self-signed certs in CI/local environments
    if (mod === https) opts.rejectUnauthorized = false;
    const req = mod.get(url, opts, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

/** Strip HTML tags and collapse whitespace → plain text description. */
function stripHtml(html, maxLength = 160) {
  if (!html) return '';
  const plain = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return plain.slice(0, maxLength) || '';
}

/** Escape a string for safe insertion into HTML attribute values. */
function escapeAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Run async tasks with limited concurrency. */
async function batchAsync(items, concurrency, fn) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = [];
  for (let w = 0; w < Math.min(concurrency, items.length); w++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

/** Fetch a single travel detail (description + gallery). */
async function fetchTravelDetail(id) {
  try {
    const url = `${API_BASE}/api/travels/${id}/`;
    const detail = await fetchJson(url);
    return {
      description: detail.description || '',
      gallery: Array.isArray(detail.gallery) ? detail.gallery : [],
    };
  } catch {
    return { description: '', gallery: [] };
  }
}

// ---------------------------------------------------------------------------
// Meta-tag injection
// ---------------------------------------------------------------------------

/**
 * Replace or insert a tag in the HTML.
 * If the regex matches, replace it; otherwise insert the tag before </head>.
 */
function replaceOrInsert(html, regex, tag) {
  if (regex.test(html)) {
    return html.replace(regex, tag);
  }
  return html.replace('</head>', `${tag}\n</head>`);
}

/**
 * Inject page-specific meta tags into the base HTML.
 *
 * Uses replace-or-insert so that tags are correctly added even when the
 * base HTML from Expo static export does not contain OG / canonical /
 * Twitter placeholders.
 */
function injectMeta(baseHtml, { title, description, canonical, image, ogType = 'website', robots }) {
  let html = baseHtml;

  // --- <title> ---
  html = html.replace(
    /<title[^>]*>.*?<\/title>/i,
    `<title data-rh="true">${escapeAttr(title)}</title>`
  );

  // --- meta description ---
  html = replaceOrInsert(
    html,
    /<meta[^>]*name="description"[^>]*\/?>/i,
    `<meta data-rh="true" name="description" content="${escapeAttr(description)}"/>`
  );

  // --- canonical ---
  html = replaceOrInsert(
    html,
    /<link[^>]*rel="canonical"[^>]*\/?>/i,
    `<link data-rh="true" rel="canonical" href="${escapeAttr(canonical)}"/>`
  );

  // --- og:type ---
  html = replaceOrInsert(
    html,
    /<meta[^>]*property="og:type"[^>]*\/?>/i,
    `<meta data-rh="true" property="og:type" content="${escapeAttr(ogType)}"/>`
  );

  // --- og:title ---
  html = replaceOrInsert(
    html,
    /<meta[^>]*property="og:title"[^>]*\/?>/i,
    `<meta data-rh="true" property="og:title" content="${escapeAttr(title)}"/>`
  );

  // --- og:description ---
  html = replaceOrInsert(
    html,
    /<meta[^>]*property="og:description"[^>]*\/?>/i,
    `<meta data-rh="true" property="og:description" content="${escapeAttr(description)}"/>`
  );

  // --- og:url ---
  html = replaceOrInsert(
    html,
    /<meta[^>]*property="og:url"[^>]*\/?>/i,
    `<meta data-rh="true" property="og:url" content="${escapeAttr(canonical)}"/>`
  );

  // --- og:image ---
  if (image) {
    html = replaceOrInsert(
      html,
      /<meta[^>]*property="og:image"[^>]*\/?>/i,
      `<meta data-rh="true" property="og:image" content="${escapeAttr(image)}"/>`
    );
  }

  // --- og:site_name ---
  html = replaceOrInsert(
    html,
    /<meta[^>]*property="og:site_name"[^>]*\/?>/i,
    `<meta data-rh="true" property="og:site_name" content="MeTravel"/>`
  );

  // --- twitter:card ---
  html = replaceOrInsert(
    html,
    /<meta[^>]*name="twitter:card"[^>]*\/?>/i,
    `<meta data-rh="true" name="twitter:card" content="summary_large_image"/>`
  );

  // --- twitter:title ---
  html = replaceOrInsert(
    html,
    /<meta[^>]*name="twitter:title"[^>]*\/?>/i,
    `<meta data-rh="true" name="twitter:title" content="${escapeAttr(title)}"/>`
  );

  // --- twitter:description ---
  html = replaceOrInsert(
    html,
    /<meta[^>]*name="twitter:description"[^>]*\/?>/i,
    `<meta data-rh="true" name="twitter:description" content="${escapeAttr(description)}"/>`
  );

  // --- twitter:image ---
  if (image) {
    html = replaceOrInsert(
      html,
      /<meta[^>]*name="twitter:image"[^>]*\/?>/i,
      `<meta data-rh="true" name="twitter:image" content="${escapeAttr(image)}"/>`
    );
  }

  // --- robots (optional, for noindex pages) ---
  if (robots) {
    html = replaceOrInsert(
      html,
      /<meta[^>]*name="robots"[^>]*\/?>/i,
      `<meta data-rh="true" name="robots" content="${escapeAttr(robots)}"/>`
    );
  }

  return html;
}

/** Write file, creating directories as needed. */
function writeFileSafe(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

// ---------------------------------------------------------------------------
// Static pages definitions
// ---------------------------------------------------------------------------
const STATIC_PAGES = [
  {
    route: '/',
    title: 'Твоя книга путешествий | Metravel',
    description: DEFAULT_DESC,
  },
  {
    route: '/about',
    title: 'О проекте MeTravel | Кто мы и зачем это всё',
    description: 'Проект MeTravel — сообщество путешественников. Делитесь маршрутами, пишите статьи, вдохновляйтесь идеями!',
  },
  {
    route: '/search',
    title: 'Поиск путешествий | MeTravel',
    description: 'Ищи путешествия по странам, городам, категориям и датам. Находи вдохновение для следующей поездки.',
  },
  {
    route: '/map',
    title: 'Карта путешествий | MeTravel',
    description: 'Интерактивная карта с маршрутами и точками путешествий. Исследуй мир вместе с MeTravel.',
  },
  {
    route: '/articles',
    title: 'Статьи о путешествиях | MeTravel',
    description: 'Читай статьи и заметки путешественников. Полезные советы, маршруты и лайфхаки.',
  },
  {
    route: '/roulette',
    title: 'Рулетка путешествий | MeTravel',
    description: 'Не знаешь куда поехать? Крути рулетку и получи случайное направление для путешествия!',
  },
  {
    route: '/favorites',
    title: 'Избранное | MeTravel',
    description: 'Твои сохранённые путешествия и маршруты.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/privacy',
    title: 'Политика конфиденциальности | MeTravel',
    description: 'Политика конфиденциальности и обработки персональных данных MeTravel.',
  },
  {
    route: '/cookies',
    title: 'Настройки cookies | MeTravel',
    description: 'Управление настройками cookies и аналитики на MeTravel.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/login',
    title: 'Вход | MeTravel',
    description: 'Войди в свой аккаунт MeTravel.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/registration',
    title: 'Регистрация | MeTravel',
    description: 'Создай аккаунт MeTravel и начни делиться путешествиями.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/travelsby',
    title: 'Путешествия по Беларуси | MeTravel',
    description: 'Маршруты и путешествия по Беларуси. Открой для себя красоту родной страны.',
  },
  {
    route: '/quests',
    title: 'Квесты | MeTravel',
    description: 'Проходи квесты по городам и открывай новые места.',
  },
  {
    route: '/history',
    title: 'История путешествий | MeTravel',
    description: 'Хронология твоих путешествий и поездок.',
    robots: 'noindex, nofollow',
  },
  {
    route: '/userpoints',
    title: 'Мои точки | MeTravel',
    description: 'Управляй своими точками на карте.',
    robots: 'noindex, nofollow',
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.error(`❌ index.html not found at ${indexPath}`);
    console.error('   Run "expo export" first, then run this script.');
    process.exit(1);
  }

  const baseHtml = fs.readFileSync(indexPath, 'utf8');
  let totalPages = 0;

  // --- 1. Static pages ---
  console.log('📄 Generating static pages...');
  for (const page of STATIC_PAGES) {
    const canonical = `${SITE_URL}${page.route === '/' ? '/' : page.route}`;
    const html = injectMeta(baseHtml, {
      title: page.title,
      description: page.description,
      canonical,
      image: OG_IMAGE,
      robots: page.robots,
    });

    if (page.route === '/') {
      // Overwrite root index.html with correct home meta
      writeFileSafe(indexPath, html);
    } else {
      const outPath = path.join(DIST_DIR, page.route, 'index.html');
      writeFileSafe(outPath, html);
    }
    totalPages++;
    console.log(`  ✅ ${page.route}`);
  }

  // --- 2. Travel pages ---
  console.log('\n🌍 Fetching travels from API...');
  let travels = [];
  try {
    const perPage = 500;
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({
        page: String(page),
        perPage: String(perPage),
        where: JSON.stringify({ publish: 1, moderation: 1 }),
      });

      const url = `${API_BASE}/api/travels/?${params}`;
      console.log(`  📡 Fetching page ${page}...`);
      const result = await fetchJson(url);

      let items = [];
      let total = 0;

      if (Array.isArray(result)) {
        items = result;
        total = result.length;
      } else if (result && typeof result === 'object') {
        items = result.data || result.results || result.items || [];
        total = typeof result.total === 'number' ? result.total
              : typeof result.count === 'number' ? result.count
              : items.length;
      }

      travels = travels.concat(items);
      console.log(`  📦 Got ${items.length} items (total so far: ${travels.length}/${total})`);

      hasMore = travels.length < total && items.length === perPage;
      page++;
    }
  } catch (err) {
    console.error('❌ Failed to fetch travels:', err.message);
    console.error('   Travel pages will not be generated.');
  }

  if (travels.length > 0) {
    // Fetch detail for each travel (description + gallery) with concurrency limit
    const travelsWithId = travels.filter((t) => t.id);
    console.log(`\n� Fetching details for ${travelsWithId.length} travels (concurrency: 10)...`);
    const details = await batchAsync(travelsWithId, 10, async (travel, i) => {
      if ((i + 1) % 50 === 0 || i === travelsWithId.length - 1) {
        console.log(`  📡 Fetched ${i + 1}/${travelsWithId.length} details...`);
      }
      return fetchTravelDetail(travel.id);
    });
    const detailMap = new Map();
    travelsWithId.forEach((t, i) => detailMap.set(t.id, details[i]));

    console.log(`\n�📝 Generating ${travels.length} travel pages...`);
    let generated = 0;
    let skipped = 0;

    for (const travel of travels) {
      const slug = travel.slug || '';
      const id = travel.id;

      if (!slug && !id) {
        skipped++;
        continue;
      }

      const routeKey = slug || String(id);
      const name = travel.name || '';
      const title = name ? `${name} | MeTravel` : 'MeTravel';

      // Use description from detail endpoint (list endpoint doesn't include it)
      const detail = detailMap.get(id) || { description: '', gallery: [] };
      const rawDesc = detail.description || travel.description || '';
      const description = stripHtml(rawDesc, 160) || FALLBACK_DESC;
      const canonical = `${SITE_URL}/travels/${routeKey}`;

      // Prefer HD gallery image (≥1200px) for og:image; fall back to thumb, then site OG
      let image = OG_IMAGE;
      const galleryFirst = detail.gallery[0];
      const galleryUrl = galleryFirst
        ? (typeof galleryFirst === 'string' ? galleryFirst : galleryFirst.url)
        : '';
      if (galleryUrl) {
        image = galleryUrl.startsWith('http') ? galleryUrl
              : galleryUrl.startsWith('/') ? `${SITE_URL}${galleryUrl}`
              : galleryUrl;
      } else {
        const thumbUrl = travel.travel_image_thumb_url || travel.travelImageThumbUrl || '';
        if (thumbUrl) {
          image = thumbUrl.startsWith('http') ? thumbUrl
                : thumbUrl.startsWith('/') ? `${SITE_URL}${thumbUrl}`
                : thumbUrl;
        }
      }

      const html = injectMeta(baseHtml, {
        title,
        description,
        canonical,
        image,
        ogType: 'article',
      });

      // Write to travels/{slug}/index.html
      const outPath = path.join(DIST_DIR, 'travels', routeKey, 'index.html');
      writeFileSafe(outPath, html);

      // Also write to travels/{id}/index.html if slug exists (for id-based URLs)
      if (slug && id) {
        const idPath = path.join(DIST_DIR, 'travels', String(id), 'index.html');
        writeFileSafe(idPath, html);
      }

      generated++;
    }

    totalPages += generated;
    console.log(`  ✅ Generated: ${generated}, Skipped: ${skipped}`);
  }

  // --- 3. Article pages ---
  console.log('\n📰 Fetching articles from API...');
  let articles = [];
  try {
    const params = new URLSearchParams({
      page: '1',
      perPage: '500',
      where: JSON.stringify({ publish: 1, moderation: 1 }),
    });
    const url = `${API_BASE}/api/articles?${params}`;
    const result = await fetchJson(url);

    if (Array.isArray(result)) {
      articles = result;
    } else if (result && typeof result === 'object') {
      articles = result.data || result.results || result.items || [];
    }
    console.log(`  📦 Got ${articles.length} articles`);
  } catch (err) {
    console.error('❌ Failed to fetch articles:', err.message);
  }

  if (articles.length > 0) {
    console.log(`📝 Generating ${articles.length} article pages...`);
    let generated = 0;

    for (const article of articles) {
      const id = article.id;
      if (!id) continue;

      const name = article.name || '';
      const title = name ? `${name} | MeTravel` : 'MeTravel';
      const rawDesc = article.description || '';
      const description = stripHtml(rawDesc, 160) || FALLBACK_DESC;
      const canonical = `${SITE_URL}/article/${id}`;

      let image = OG_IMAGE;
      const thumbUrl = article.article_image_thumb_url || '';
      if (thumbUrl) {
        if (thumbUrl.startsWith('http')) {
          image = thumbUrl;
        } else if (thumbUrl.startsWith('/')) {
          image = `${SITE_URL}${thumbUrl}`;
        }
      }

      const html = injectMeta(baseHtml, {
        title,
        description,
        canonical,
        image,
        ogType: 'article',
      });

      const outPath = path.join(DIST_DIR, 'article', String(id), 'index.html');
      writeFileSafe(outPath, html);
      generated++;
    }

    totalPages += generated;
    console.log(`  ✅ Generated: ${generated} article pages`);
  }

  console.log(`\n🎉 Done! Generated ${totalPages} SEO pages in ${DIST_DIR}`);
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
