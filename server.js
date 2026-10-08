// Minimal static file server for the tracker. No dependencies.
// Usage: node server.js            (http://localhost:3000)
//        PORT=8080 node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// Only files the app needs are served, so server.js, .git etc. stay private.
const PUBLIC = new Set(['index.html', 'app.js', 'data.js', 'styles.css']);

const server = http.createServer((req, res) => {
  let name;
  try {
    name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }

  if (!PUBLIC.has(name)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    return;
  }

  fs.readFile(path.join(ROOT, name), (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' }).end('Could not read file');
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(name)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Try: PORT=3001 npm start`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`PoE2 Build Tracker running at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log('Press Ctrl+C to stop.');
});
