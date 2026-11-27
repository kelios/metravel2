/* global require, module */
const fs = require('node:fs');
const path = require('node:path');

const ALLOWED_ORIGINS = new Set(['https://metravel.by', 'https://www.metravel.by']);
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const installed = new WeakSet();

function safeUrl(value) {
  try {
    const url = new URL(value);
    const pathname = url.pathname.replace(/\/([A-Za-z0-9_-]{40,})(?=\/|$)/g, '/<redacted-segment>');
    return url.origin + pathname;
  } catch {
    return '<invalid-url>';
  }
}

function safeMessage(value) {
  const message = String(value);
  // Do not retain the rest of a Bearer header, cookie list or quoted JSON value.
  if (/\b(?:authorization|password|token|secret|cookie)["']?\s*[:=]|\bbearer\s+\S+/i.test(message)) {
    return '[credential-bearing console message redacted]';
  }
  return message
    .replace(/https?:\/\/[^\s"'<>]+/g, safeUrl)
    .slice(0, 1500);
}

function shouldBlock(request) {
  if (!SAFE_METHODS.has(request.method())) return true;
  if (!request.isNavigationRequest()) return false;
  // Subframes and assets can use their ordinary external GET origins.
  if (request.frame().parentFrame()) return false;
  try {
    return !ALLOWED_ORIGINS.has(new URL(request.url()).origin);
  } catch {
    return true;
  }
}

async function installGuard(page, record) {
  const context = page.context();
  if (installed.has(context)) return;
  await context.route('**/*', async route => {
    const request = route.request();
    if (shouldBlock(request)) {
      record({event: 'blocked-by-qa-policy', method: request.method(), url: safeUrl(request.url())});
      await route.abort('blockedbyclient');
      return;
    }
    // Playwright routing does not re-enter this handler for redirect hops.
    // Guest QA blocks all top-level 3xx instead of following an unchecked hop.
    if (request.isNavigationRequest() && !request.frame().parentFrame()) {
      try {
        const response = await route.fetch({maxRedirects: 0});
        if (response.status() >= 300 && response.status() < 400) {
          record({event: 'blocked-by-qa-policy', reason: 'navigation-3xx', status: response.status(),
            method: request.method(), url: safeUrl(request.url())});
          await route.abort('blockedbyclient');
        } else {
          await route.fulfill({response});
        }
      } catch (error) {
        record({event: 'qa-navigation-unavailable', message: safeMessage(error.message)});
        await route.abort('blockedbyclient');
      }
      return;
    }
    await route.continue();
  });
  context.on('response', response => {
    const request = response.request();
    record({event: 'response', method: request.method(), status: response.status(), url: safeUrl(request.url())});
  });
  const watch = current => {
    current.on('console', message => {
      if (['error', 'warning'].includes(message.type())) {
        record({event: 'console', level: message.type(), message: safeMessage(message.text())});
      }
    });
    current.on('pageerror', error => record({event: 'pageerror', message: safeMessage(error.message)}));
  };
  context.on('page', watch);
  watch(page);
  installed.add(context);
}

function fileRecorder(directory) {
  const destination = path.join(directory, 'browser-network.jsonl');
  return entry => fs.appendFileSync(destination, JSON.stringify({at: new Date().toISOString(), ...entry}) + '\n');
}

module.exports = {safeUrl, safeMessage, shouldBlock, installGuard, fileRecorder};
