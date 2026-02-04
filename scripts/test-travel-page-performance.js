#!/usr/bin/env node

/**
 * Lighthouse performance testing script for travel pages
 * Tests before and after optimization changes
 */

const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

const DEFAULT_TRAVEL_PATH =
  '/travels/czarny-staw-i-drugie-radosti-treki-termy-i-nochi-u-kamina';

function parseArgs(argv) {
  const args = {};
  const list = Array.isArray(argv) ? argv : [];

  for (let i = 0; i < list.length; i += 1) {
    const token = String(list[i] ?? '');
    if (!token.startsWith('--')) continue;

    const stripped = token.slice(2);
    if (!stripped) continue;

    const eqIndex = stripped.indexOf('=');
    if (eqIndex !== -1) {
      const key = stripped.slice(0, eqIndex);
      const value = stripped.slice(eqIndex + 1);
      args[key] = value;
      continue;
    }

    const next = list[i + 1];
    if (next != null && !String(next).startsWith('--')) {
      args[stripped] = String(next);
      i += 1;
      continue;
    }

    args[stripped] = '1';
  }

  return args;
}

function resolveTravelPath() {
  const argv = parseArgs(process.argv.slice(2));
  const argPath = String(argv.path || argv.pathname || '').trim();
  if (argPath) {
    return argPath.startsWith('/') ? argPath : `/${argPath}`;
  }

  const explicitPath = String(process.env.LIGHTHOUSE_PATH || '').trim();
  if (explicitPath) {
    return explicitPath.startsWith('/') ? explicitPath : `/${explicitPath}`;
  }

  const rawUrl = String(process.env.LIGHTHOUSE_URL || '').trim();
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      const p = String(parsed.pathname || '').trim();
      return p ? p : DEFAULT_TRAVEL_PATH;
    } catch {
      // If user passed a relative-ish URL, treat it as a path.
      return rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
    }
  }

  return DEFAULT_TRAVEL_PATH;
}

const TRAVEL_PATH = resolveTravelPath();
const OUTPUT_DIR = path.join(__dirname, '../lighthouse-reports');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

async function findAvailablePort(startPort) {
  const start = Number(startPort) || 4173;

  const tryPort = (port) =>
    new Promise((resolve) => {
      const server = net.createServer();
      server.unref();
      server.on('error', () => resolve(null));
      server.listen({ port, host: '127.0.0.1' }, () => {
        const actualPort = server.address().port;
        server.close(() => resolve(actualPort));
      });
    });

  for (let i = 0; i < 25; i += 1) {
    const candidate = start + i;
    const ok = await tryPort(candidate);
    if (ok) return ok;
  }
  return start;
}

async function runLighthouseViaScript({ url, formFactor, port, reportPath }) {
  const argv = parseArgs(process.argv.slice(2));

  const throttlingMethod = String(
    argv['throttling-method'] ||
      argv.throttlingMethod ||
      process.env.LIGHTHOUSE_THROTTLING_METHOD ||
      'simulate',
  ).trim();

  const flags = [
    '--only-categories=performance,accessibility,best-practices,seo',
    `--emulated-form-factor=${formFactor}`,
    `--throttling-method=${throttlingMethod}`,
  ];

  return new Promise((resolve, reject) => {
    const apiStubValue = String(
      argv['api-stub'] ?? argv.apiStub ?? process.env.LIGHTHOUSE_API_STUB ?? '0',
    ).trim();

    const child = spawn('node', [path.join(__dirname, 'run-lighthouse.js')], {
      stdio: 'inherit',
      env: {
        ...process.env,
        LIGHTHOUSE_API_STUB: apiStubValue === '1' ? '1' : '0',
        LIGHTHOUSE_API_ORIGIN: String(
          argv['api-origin'] || argv.apiOrigin || process.env.LIGHTHOUSE_API_ORIGIN || '',
        ).trim(),
        LIGHTHOUSE_BUILD_DIR: String(
          argv['build-dir'] || argv.buildDir || process.env.LIGHTHOUSE_BUILD_DIR || '',
        ).trim(),
        LIGHTHOUSE_HOST: '127.0.0.1',
        LIGHTHOUSE_PORT: String(port),
        LIGHTHOUSE_URL: url,
        LIGHTHOUSE_REPORT: reportPath,
        LIGHTHOUSE_FLAGS: flags.join(' '),
        LIGHTHOUSE_API_INSECURE: process.env.LIGHTHOUSE_API_INSECURE || '1',
      },
    });

    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Lighthouse failed with exit code ${code}`));
    });

    child.on('error', (error) => reject(error));
  });
}

function extractMetrics(lhr) {
  const { categories, audits } = lhr;

  return {
    performance: Math.round(categories.performance.score * 100),
    accessibility: Math.round(categories.accessibility.score * 100),
    bestPractices: Math.round(categories['best-practices'].score * 100),
    seo: Math.round(categories.seo.score * 100),
    metrics: {
      fcp: audits['first-contentful-paint'].numericValue,
      lcp: audits['largest-contentful-paint'].numericValue,
      tbt: audits['total-blocking-time'].numericValue,
      cls: audits['cumulative-layout-shift'].numericValue,
      si: audits['speed-index'].numericValue,
    },
  };
}

function numberFromEnv(key, fallback) {
  const raw = process.env[key];
  if (raw == null) return fallback;
  const str = String(raw).trim();
  if (!str) return fallback;
  const num = Number(str);
  return Number.isFinite(num) ? num : fallback;
}

function assertThresholds(label, results, thresholds) {
  const failed = [];

  if (results.performance < thresholds.minPerf) failed.push(`${label}: Performance < ${thresholds.minPerf}`);
  if (results.accessibility < thresholds.minA11y) failed.push(`${label}: Accessibility < ${thresholds.minA11y}`);
  if (results.bestPractices < thresholds.minBest) failed.push(`${label}: Best Practices < ${thresholds.minBest}`);
  if (results.seo < thresholds.minSeo) failed.push(`${label}: SEO < ${thresholds.minSeo}`);

  if (results.metrics.lcp > thresholds.maxLcpMs) failed.push(`${label}: LCP > ${thresholds.maxLcpMs}ms`);
  if (results.metrics.cls > thresholds.maxCls) failed.push(`${label}: CLS > ${thresholds.maxCls}`);
  if (results.metrics.tbt > thresholds.maxTbtMs) failed.push(`${label}: TBT > ${thresholds.maxTbtMs}ms`);
  if (results.metrics.fcp > thresholds.maxFcpMs) failed.push(`${label}: FCP > ${thresholds.maxFcpMs}ms`);
  if (results.metrics.si > thresholds.maxSiMs) failed.push(`${label}: SI > ${thresholds.maxSiMs}ms`);

  return failed;
}

function formatMetric(value, unit = 'ms') {
  if (unit === 'ms') {
    return `${Math.round(value)}ms`;
  }
  return value.toFixed(3);
}

function getScoreColor(score) {
  if (score >= 90) return '🟢';
  if (score >= 50) return '🟠';
  return '🔴';
}

function printResults(formFactor, results) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 ${formFactor.toUpperCase()} PERFORMANCE REPORT`);
  console.log(`${'='.repeat(60)}\n`);

  console.log('SCORES:');
  console.log(`  Performance:     ${getScoreColor(results.performance)} ${results.performance}/100`);
  console.log(`  Accessibility:   ${getScoreColor(results.accessibility)} ${results.accessibility}/100`);
  console.log(`  Best Practices:  ${getScoreColor(results.bestPractices)} ${results.bestPractices}/100`);
  console.log(`  SEO:             ${getScoreColor(results.seo)} ${results.seo}/100\n`);

  console.log('CORE WEB VITALS:');
  console.log(`  FCP (First Contentful Paint):     ${formatMetric(results.metrics.fcp)}`);
  console.log(`  LCP (Largest Contentful Paint):   ${formatMetric(results.metrics.lcp)}`);
  console.log(`  TBT (Total Blocking Time):        ${formatMetric(results.metrics.tbt)}`);
  console.log(`  CLS (Cumulative Layout Shift):    ${formatMetric(results.metrics.cls, 'score')}`);
  console.log(`  SI (Speed Index):                 ${formatMetric(results.metrics.si)}`);
}

function saveComparison(mobileResults, desktopResults) {
  const report = {
    timestamp: new Date().toISOString(),
    url: TRAVEL_PATH,
    mobile: mobileResults,
    desktop: desktopResults,
  };

  const filename = path.join(OUTPUT_DIR, `performance-${timestamp}.json`);
  fs.writeFileSync(filename, JSON.stringify(report, null, 2));
  console.log(`\n📄 Detailed report saved to: ${filename}`);
}

async function main() {
  console.log(`\n🚀 Testing Travel Page Performance`);
  console.log(`📍 Path: ${TRAVEL_PATH}\n`);

  const argv = parseArgs(process.argv.slice(2));
  const preferredPort = Number(argv.port || process.env.LIGHTHOUSE_PORT || '4173');
  const port = await findAvailablePort(preferredPort);
  const localUrl = `http://127.0.0.1:${port}${TRAVEL_PATH}`;

  console.log('⏳ Running Mobile Lighthouse audit...');
  const mobileJsonPath = path.join(OUTPUT_DIR, `mobile-${timestamp}.json`);
  await runLighthouseViaScript({
    url: localUrl,
    formFactor: 'mobile',
    port,
    reportPath: mobileJsonPath,
  });
  const mobileJson = JSON.parse(fs.readFileSync(mobileJsonPath, 'utf8'));
  const mobileMetrics = extractMetrics(mobileJson);
  console.log(`✅ Mobile JSON report: ${mobileJsonPath}`);

  printResults('Mobile', mobileMetrics);

  console.log('\n⏳ Running Desktop Lighthouse audit...');
  const desktopJsonPath = path.join(OUTPUT_DIR, `desktop-${timestamp}.json`);
  await runLighthouseViaScript({
    url: localUrl,
    formFactor: 'desktop',
    port,
    reportPath: desktopJsonPath,
  });
  const desktopJson = JSON.parse(fs.readFileSync(desktopJsonPath, 'utf8'));
  const desktopMetrics = extractMetrics(desktopJson);
  console.log(`✅ Desktop JSON report: ${desktopJsonPath}`);

  printResults('Desktop', desktopMetrics);

  saveComparison(mobileMetrics, desktopMetrics);

  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ Testing Complete!');
  console.log(`${'='.repeat(60)}\n`);

  // Summary: strict thresholds (fail if ANY condition is violated)
  const thresholds = {
    minPerf: numberFromEnv('LIGHTHOUSE_MIN_PERF', 90),
    minA11y: numberFromEnv('LIGHTHOUSE_MIN_A11Y', 90),
    minBest: numberFromEnv('LIGHTHOUSE_MIN_BEST', 90),
    minSeo: numberFromEnv('LIGHTHOUSE_MIN_SEO', 90),

    maxLcpMs: numberFromEnv('LIGHTHOUSE_MAX_LCP_MS', 2500),
    maxCls: numberFromEnv('LIGHTHOUSE_MAX_CLS', 0.1),
    maxTbtMs: numberFromEnv('LIGHTHOUSE_MAX_TBT_MS', 400),
    maxFcpMs: numberFromEnv('LIGHTHOUSE_MAX_FCP_MS', 1800),
    maxSiMs: numberFromEnv('LIGHTHOUSE_MAX_SI_MS', 4500),
  };

  const failures = [
    ...assertThresholds('Mobile', mobileMetrics, thresholds),
    ...assertThresholds('Desktop', desktopMetrics, thresholds),
  ];

  const allGreen = failures.length === 0;

  if (allGreen) {
    console.log('🎉 EXCELLENT! All thresholds passed.');
  } else {
    console.log('⚠️  Some thresholds failed:');
    failures.forEach((line) => console.log(`   - ${line}`));
  }

  process.exit(allGreen ? 0 : 1);
}

main().catch((error) => {
  console.error('❌ Error running Lighthouse:', error);
  process.exit(1);
});
