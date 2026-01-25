const fs = require('fs');
const path = require('path');

const mobileReportPath = path.join(__dirname, '../lighthouse-report.local.mobile.json');
const desktopReportPath = path.join(__dirname, '../lighthouse-report.local.desktop.json');

function analyzeReport(filePath, type) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`${type}: Report file not found.`);
      return;
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const score = data.categories.performance.score * 100;
    const metrics = data.audits;
    
    console.log(`\n--- ${type.toUpperCase()} PERFORMANCE (${score.toFixed(0)}) ---`);
    console.log(`FCP: ${metrics['first-contentful-paint'].displayValue}`);
    console.log(`LCP: ${metrics['largest-contentful-paint'].displayValue}`);
    console.log(`TBT: ${metrics['total-blocking-time'].displayValue}`);
    console.log(`CLS: ${metrics['cumulative-layout-shift'].displayValue}`);
    console.log(`SI:  ${metrics['speed-index'].displayValue}`);
    
  } catch (err) {
    console.error(`Error analyzing ${type} report:`, err.message);
  }
}

analyzeReport(mobileReportPath, 'Mobile');
analyzeReport(desktopReportPath, 'Desktop');
