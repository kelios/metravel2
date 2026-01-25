#!/usr/bin/env node

/**
 * Lighthouse performance testing script for travel pages
 * Tests before and after optimization changes
 */

const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const path = require('path');

const TRAVEL_URL = process.env.LIGHTHOUSE_URL || 'https://metravel.by/travels/tropa-vedm-harzer-hexenstieg-kak-proiti-marshrut-i-kak-eto-vygliadit-na-samom-dele';
const OUTPUT_DIR = path.join(__dirname, '../lighthouse-reports');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

const mobileConfig = {
  extends: 'lighthouse:default',
  settings: {
    formFactor: 'mobile',
    throttling: {
      rttMs: 150,
      throughputKbps: 1638.4,
      cpuSlowdownMultiplier: 4,
    },
    screenEmulation: {
      mobile: true,
      width: 412,
      height: 823,
      deviceScaleFactor: 2.625,
      disabled: false,
    },
    emulatedUserAgent: 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  },
};

const desktopConfig = {
  extends: 'lighthouse:default',
  settings: {
    formFactor: 'desktop',
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
    },
    screenEmulation: {
      mobile: false,
      width: 1350,
      height: 940,
      deviceScaleFactor: 1,
      disabled: false,
    },
    emulatedUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
};

async function runLighthouse(url, config) {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox'],
  });

  const options = {
    logLevel: 'info',
    output: 'html',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    port: chrome.port,
  };

  const runnerResult = await lighthouse(url, options, config);

  await chrome.kill();

  return runnerResult;
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
    url: TRAVEL_URL,
    mobile: mobileResults,
    desktop: desktopResults,
  };

  const filename = path.join(OUTPUT_DIR, `performance-${timestamp}.json`);
  fs.writeFileSync(filename, JSON.stringify(report, null, 2));
  console.log(`\n📄 Detailed report saved to: ${filename}`);
}

async function main() {
  console.log(`\n🚀 Testing Travel Page Performance`);
  console.log(`📍 URL: ${TRAVEL_URL}\n`);

  console.log('⏳ Running Mobile Lighthouse audit...');
  const mobileResult = await runLighthouse(TRAVEL_URL, mobileConfig, 'mobile');
  const mobileMetrics = extractMetrics(mobileResult.lhr);

  // Save mobile HTML report
  const mobileHtmlPath = path.join(OUTPUT_DIR, `mobile-${timestamp}.html`);
  fs.writeFileSync(mobileHtmlPath, mobileResult.report);
  console.log(`✅ Mobile HTML report: ${mobileHtmlPath}`);

  printResults('Mobile', mobileMetrics);

  console.log('\n⏳ Running Desktop Lighthouse audit...');
  const desktopResult = await runLighthouse(TRAVEL_URL, desktopConfig, 'desktop');
  const desktopMetrics = extractMetrics(desktopResult.lhr);

  // Save desktop HTML report
  const desktopHtmlPath = path.join(OUTPUT_DIR, `desktop-${timestamp}.html`);
  fs.writeFileSync(desktopHtmlPath, desktopResult.report);
  console.log(`✅ Desktop HTML report: ${desktopHtmlPath}`);

  printResults('Desktop', desktopMetrics);

  saveComparison(mobileMetrics, desktopMetrics);

  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ Testing Complete!');
  console.log(`${'='.repeat(60)}\n`);

  // Summary
  const allGreen = 
    mobileMetrics.performance >= 90 &&
    desktopMetrics.performance >= 90 &&
    mobileMetrics.accessibility >= 90 &&
    desktopMetrics.accessibility >= 90;

  if (allGreen) {
    console.log('🎉 EXCELLENT! All scores are in the green zone (90+)!');
  } else {
    console.log('⚠️  Some scores need improvement to reach 90+');
    
    const improvements = [];
    if (mobileMetrics.performance < 90) improvements.push('Mobile Performance');
    if (desktopMetrics.performance < 90) improvements.push('Desktop Performance');
    if (mobileMetrics.accessibility < 90) improvements.push('Mobile Accessibility');
    if (desktopMetrics.accessibility < 90) improvements.push('Desktop Accessibility');
    
    console.log(`   Focus areas: ${improvements.join(', ')}`);
  }

  process.exit(allGreen ? 0 : 1);
}

main().catch((error) => {
  console.error('❌ Error running Lighthouse:', error);
  process.exit(1);
});
