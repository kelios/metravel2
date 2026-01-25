const fs = require('fs');
const path = require('path');

const reportPath = path.join(__dirname, '../lighthouse-report.local.desktop.json');

try {
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  
  const lcpElement = report.audits['largest-contentful-paint-element'];
  if (lcpElement && lcpElement.details && lcpElement.details.items && lcpElement.details.items.length > 0) {
      console.log('LCP Element:', JSON.stringify(lcpElement.details.items[0], null, 2));
  } else {
      console.log('LCP Element details not found.');
  }

  const lcpMetric = report.audits['largest-contentful-paint'];
  console.log('LCP Metric:', lcpMetric.displayValue);

} catch (e) {
  console.error('Error reading report:', e);
}
