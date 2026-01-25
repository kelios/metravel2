const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const PUBLIC_DIR = path.join(__dirname, 'dist/prod');

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((request, response) => {
  // Safe path handling
  const safePath = path.normalize(request.url).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath);
  
  // If URL ends with /, try index.html
  if (request.url.endsWith('/')) {
      filePath = path.join(filePath, 'index.html');
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  
  // Attempt to read file
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // File not found. 
        // If it looks like a static asset (has extension), return 404.
        // Otherwise, assume it's a client-side route and serve index.html (SPA fallback).
        if (extname && extname !== '.html') {
            response.writeHead(404);
            response.end('Not found');
        } else {
            // SPA Fallback
            fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err, indexContent) => {
                if (err) {
                    response.writeHead(500);
                    response.end('Error loading index.html');
                } else {
                    response.writeHead(200, { 'Content-Type': 'text/html' });
                    response.end(indexContent, 'utf-8');
                }
            });
        }
      } else {
        response.writeHead(500);
        response.end('Server Error: ' + error.code);
      }
    } else {
      const contentType = mimeTypes[extname] || 'application/octet-stream';
      response.writeHead(200, { 'Content-Type': contentType });
      response.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`SPA Server running at http://localhost:${PORT}/`);
});
