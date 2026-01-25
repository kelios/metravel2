const fs = require('fs');
const path = require('path');

const reportPath = path.join(__dirname, '../lighthouse-report.local.desktop.json');

try {
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const lcp = report.audits['largest-contentful-paint'];
  console.log('LCP Value:', lcp.displayValue);
  console.log('LCP Details:', JSON.stringify(lcp.details, null, 2));
} catch (e) {
  console.error('Error reading report:', e);
}
