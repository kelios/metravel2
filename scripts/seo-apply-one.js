#!/usr/bin/env node
/**
 * Apply a single article's personalized FAQ + editor comment in one shot.
 * Designed to be called by Workflow agents so each agent owns its full
 * mutation (no parent dependency on file persistence).
 *
 * Usage:
 *   node scripts/seo-apply-one.js \
 *     --id 638 \
 *     --faq-file /tmp/faq-638.html \
 *     --comment-file /tmp/cmt-638.txt
 *
 * Behaviour:
 *   - GET /api/travels/{id}/; if description already has FAQ_MARKER, FAQ apply
 *     is SKIPPED (still posts comment if missing).
 *   - Re-uses scripts/seo-edit.js composeDescription + buildUpsertPayload +
 *     detectRegression for safety. Auto-rolls back on regression.
 *   - GET /api/travel-comments/?travel_id=ID; if an editor user already has a
 *     "От редакции metravel:"-prefixed comment, comment post is SKIPPED.
 *   - Comment text is force-prefixed with COMMENT_PREFIX if missing.
 *
 * Tokens:
 *   - Author edit  → METRAVEL_TOKEN env or ~/.metravel_token
 *   - Editor post  → METRAVEL_EDITOR_TOKEN env or ~/.metravel_editor_token
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const seoEdit = require('./seo-edit');

const API = (process.env.METRAVEL_API || 'https://metravel.by/api').replace(/\/+$/, '');
const FAQ_MARKER = 'data-faq="metravel-seo"';
const COMMENT_PREFIX = 'От редакции metravel:';
const EDITOR_USER_ID = 120;

const args = process.argv.slice(2);
const getArg = (n, d) => { const i = args.indexOf(`--${n}`); return i !== -1 && args[i + 1] ? args[i + 1] : d; };
const ID = parseInt(getArg('id', ''), 10);
const FAQ_FILE = getArg('faq-file', '');
const COMMENT_FILE = getArg('comment-file', '');
if (!ID || !FAQ_FILE || !COMMENT_FILE) {
  console.error('ERROR: --id, --faq-file, --comment-file required');
  process.exit(1);
}

function loadToken(envName, fileName) {
  if (process.env[envName]) return process.env[envName].trim();
  const p = path.join(os.homedir(), fileName);
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
  return null;
}
const AUTHOR_TOKEN = loadToken('METRAVEL_TOKEN', '.metravel_token');
const EDITOR_TOKEN = loadToken('METRAVEL_EDITOR_TOKEN', '.metravel_editor_token');

function request(method, url, body, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      method,
      timeout: 60000,
      headers: { 'Cache-Control': 'no-cache' },
      rejectUnauthorized: false,
    };
    if (token) opts.headers.Authorization = `Token ${token}`;
    if (body) {
      opts.headers['Content-Type'] = 'application/json; charset=utf-8';
      opts.headers['Content-Length'] = Buffer.byteLength(body);
    }
    const req = https.request(url, opts, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (buf += c));
      res.on('end', () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`timeout ${url}`)); });
    if (body) req.write(body);
    req.end();
  });
}

async function getJson(url, token) {
  const { status, body } = await request('GET', url, null, token);
  if (status >= 300) throw new Error(`HTTP ${status} ${url}: ${body.slice(0, 200)}`);
  try { return JSON.parse(body); } catch { return null; }
}

async function main() {
  const result = { id: ID, faq: 'skipped', comment: 'skipped' };

  // FAQ ----------------------------------------------------------------
  const detail = await getJson(`${API}/travels/${ID}/?_cb=${Date.now()}-${ID}`);
  if (!detail || !detail.id) throw new Error(`GET /travels/${ID}/ returned no detail`);
  const oldDesc = detail.description || '';

  if (oldDesc.includes(FAQ_MARKER)) {
    result.faq = 'already-present';
  } else {
    if (!fs.existsSync(FAQ_FILE)) throw new Error(`FAQ file not found: ${FAQ_FILE}`);
    let faqHtml = fs.readFileSync(FAQ_FILE, 'utf8');
    if (!faqHtml.includes(FAQ_MARKER)) {
      faqHtml = faqHtml.replace(/<section\b/i, `<section ${FAQ_MARKER}`);
      if (!faqHtml.includes(FAQ_MARKER)) {
        faqHtml = `<section class="seo-faq" ${FAQ_MARKER}>\n${faqHtml}\n</section>\n`;
      }
    }
    if (!AUTHOR_TOKEN) throw new Error('AUTHOR_TOKEN missing (~/.metravel_token)');
    const newDesc = seoEdit.composeDescription(oldDesc, { append: faqHtml });
    const payload = seoEdit.buildUpsertPayload(detail, { description: newDesc, meta: detail.meta_description });
    const put1 = await request(
      'PUT',
      `${API}/travels/upsert/`,
      JSON.stringify(payload),
      AUTHOR_TOKEN
    );
    if (put1.status >= 300) throw new Error(`PUT upsert → HTTP ${put1.status}: ${put1.body.slice(0, 200)}`);
    const after = await getJson(`${API}/travels/${ID}/?_cb=${Date.now()}-${ID}`);
    const problems = seoEdit.detectRegression(detail, after, {
      expectChanged: true,
      newDescription: newDesc,
    });
    if (problems.length) {
      const revert = seoEdit.buildUpsertPayload(detail, { description: oldDesc, meta: detail.meta_description });
      await request('PUT', `${API}/travels/upsert/`, JSON.stringify(revert), AUTHOR_TOKEN).catch(() => {});
      throw new Error(`FAQ REGRESSION ${ID}: ${problems.join('; ')}`);
    }
    result.faq = 'applied';
  }

  // Comment ------------------------------------------------------------
  const comments = await getJson(`${API}/travel-comments/?travel_id=${ID}`);
  const already = Array.isArray(comments)
    && comments.some((c) => c.user === EDITOR_USER_ID && typeof c.text === 'string' && c.text.startsWith(COMMENT_PREFIX));
  if (already) {
    result.comment = 'already-present';
  } else {
    if (!fs.existsSync(COMMENT_FILE)) throw new Error(`comment file not found: ${COMMENT_FILE}`);
    let text = fs.readFileSync(COMMENT_FILE, 'utf8').trim();
    if (!text.startsWith(COMMENT_PREFIX)) text = `${COMMENT_PREFIX} ${text}`;
    if (!EDITOR_TOKEN) throw new Error('EDITOR_TOKEN missing (~/.metravel_editor_token)');
    const post = await request(
      'POST',
      `${API}/travel-comments/`,
      JSON.stringify({ travel_id: ID, text }),
      EDITOR_TOKEN
    );
    if (post.status >= 300) throw new Error(`POST comment → HTTP ${post.status}: ${post.body.slice(0, 200)}`);
    try { result.commentId = JSON.parse(post.body).id; } catch { /* ignore */ }
    result.comment = 'posted';
  }

  console.log(JSON.stringify(result));
}

main().catch((e) => {
  console.error(JSON.stringify({ id: ID, error: e.message }));
  process.exit(2);
});
