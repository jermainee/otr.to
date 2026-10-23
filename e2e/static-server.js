/**
 * Serves the built site the way a web server would, so the end to end tests
 * run against the same bundle that gets deployed. Started by playwright.config.ts.
 */
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..', 'public');
const port = Number(process.env.PORT || 4173);

const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
};

const server = http.createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.join(root, pathname.endsWith('/') ? pathname + 'index.html' : pathname);

    // Nothing outside public/ is ours to serve.
    if (!file.startsWith(root + path.sep)) {
        response.writeHead(403).end('Forbidden');
        return;
    }

    try {
        const body = await fs.readFile(file);
        response.writeHead(200, {'Content-Type': contentTypes[path.extname(file)] || 'application/octet-stream'});
        response.end(body);
    } catch {
        response.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'}).end('Not found');
    }
});

server.listen(port, '127.0.0.1', () => console.log('Serving ' + root + ' on http://127.0.0.1:' + port));
