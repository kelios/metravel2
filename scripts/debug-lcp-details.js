const fs = require('fs');
const path = require('path');

const reportPath = path.join(__dirname, '../lighthouse-report.local.desktop.json');

try {
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  
  // LCP Audit
  const lcp = report.audits['largest-contentful-paint'];
  console.log('LCP Display Value:', lcp.displayValue);
  console.log('LCP Score:', lcp.score);
  
  if (lcp.details && lcp.details.items && lcp.details.items.length > 0) {
      console.log('LCP Element:', JSON.stringify(lcp.details.items[0], null, 2));
  }

  // Diagnostics
  const diagnostics = report.audits['diagnostics'];
  if (diagnostics) {
      console.log('Diagnostics:', JSON.stringify(diagnostics.details, null, 2));
  }
  
  // Network requests (to check for slow images)
  const network = report.audits['network-requests'];
  if (network && network.details && network.details.items) {
      const images = network.details.items
          .filter(i => i.resourceType === 'Image' || i.mimeType.includes('image'))
          .sort((a, b) => b.endTime - a.endTime)
          .slice(0, 5);
      
      console.log('Slowest Images:', JSON.stringify(images.map(i => ({
          url: i.url,
          startTime: i.startTime,
          endTime: i.endTime,
          transferSize: i.transferSize
      })), null, 2));
  }

} catch (e) {
  console.error('Error reading report:', e);
}
