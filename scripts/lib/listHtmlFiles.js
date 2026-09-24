const fs = require('fs');
const path = require('path');

// Every *.html under distDir as absolute paths in a stable order. An empty
// tree throws: a post-build check over zero pages would pass vacuously.
function listHtmlFiles(distDir, purpose = 'check') {
  const files = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(filePath);
      else if (entry.isFile() && /\.html$/i.test(entry.name)) files.push(filePath);
    }
  }
  visit(distDir);
  if (files.length === 0) throw new Error(`${distDir}: no HTML files to ${purpose}`);
  return files;
}

module.exports = { listHtmlFiles };
