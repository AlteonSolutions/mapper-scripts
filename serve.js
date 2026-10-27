/*
 * serve.js — a static server for the local test pages. No dependencies.
 *
 *   node serve.js            serves this directory on http://localhost:8000
 *   node serve.js 8080       ...on another port
 *
 * The test pages have to be served over HTTP rather than opened from the
 * filesystem. On a file:// origin fetch is blocked, so the template download and
 * the submit both fail for reasons that have nothing to do with the code, and
 * mapper.js resolves its vendored xlsx against a file:// path.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.argv[2]) || 8000;
const ROOT = __dirname;

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
};

http.createServer(function (req, res) {
    let rel;
    try {
        rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch (e) {
        res.writeHead(400); res.end('bad request'); return;
    }
    if (rel === '/') rel = '/test-live-embed-local.html';

    // Resolve inside ROOT and refuse anything that escapes it.
    const file = path.join(ROOT, path.normalize(rel));
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
        res.writeHead(403); res.end('forbidden'); return;
    }

    fs.stat(file, function (err, st) {
        if (err || !st.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('not found: ' + rel);
            return;
        }
        res.writeHead(200, {
            'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
            'Content-Length': st.size,
            // Always revalidate, so editing a script and reloading shows the edit.
            'Cache-Control': 'no-store',
        });
        fs.createReadStream(file).pipe(res);
    });
}).listen(PORT, function () {
    console.log('serving ' + ROOT);
    console.log('open  http://localhost:' + PORT + '/test-live-embed-local.html');
    console.log('(ctrl-c to stop)');
});
