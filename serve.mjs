import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const port = 8080;
const files = new Map([
  ['/index.html', 'text/html; charset=utf-8'],
  ['/index.js', 'text/javascript; charset=utf-8'],
  ['/index-sandbox.js', 'text/javascript; charset=utf-8'],
  ['/manifest.json', 'application/json; charset=utf-8'],
  ['/README.md', 'text/markdown; charset=utf-8'],
]);
const baseURL = new URL('./dist/', import.meta.url);

const server = createServer(async (request, response) => {
  const path = request.url.split('?')[0];
  const file = path === '/' ? '/index.html' : path;
  const contentType = files.get(file);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  response.setHeader('Access-Control-Allow-Private-Network', 'true');
  response.setHeader('Cache-Control', 'no-store');
  if (request.method === 'OPTIONS') return response.writeHead(204).end();
  if (request.method !== 'GET' && request.method !== 'HEAD') return response.writeHead(405).end();
  if (!contentType) return response.writeHead(404).end();
  try {
    const data = await readFile(new URL(file.slice(1), baseURL));
    response.writeHead(200, { 'Content-Type': contentType, 'Content-Length': data.length });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch {
    response.writeHead(404).end();
  }
});

server.on('error', error => {
  console.error(`Lokaler RemNote-Server konnte nicht starten: ${error.message}`);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`RemNote-Plugin erreichbar unter http://127.0.0.1:${port}`);
  console.log('Dieses Fenster während der Nutzung offen lassen. Zum Beenden Strg+C drücken.');
});
