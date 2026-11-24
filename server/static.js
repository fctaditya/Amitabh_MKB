// Static file handler for ./public (with Range support so browsers can seek audio).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
};

function reply(res, status, body = '', headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

/** Parses "bytes=a-b" / "bytes=-n". Returns null when unsatisfiable. */
function parseRange(header, size) {
  const m = /bytes=(\d*)-(\d*)/.exec(header);
  if (!m) return { start: 0, end: size - 1 };
  let start, end;
  if (!m[1] && m[2]) { start = Math.max(0, size - parseInt(m[2], 10)); end = size - 1; }
  else { start = m[1] ? parseInt(m[1], 10) : 0; end = m[2] ? parseInt(m[2], 10) : size - 1; }
  end = Math.min(end, size - 1);
  return Number.isNaN(start) || start > end || start >= size ? null : { start, end };
}

export function handleStatic(req, res) {
  let urlPath;
  try { urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
  catch { return reply(res, 400, 'Bad request'); }
  if (urlPath === '/') urlPath = '/index.html';

  const file = path.normalize(path.join(PUBLIC, urlPath));
  if (!file.startsWith(PUBLIC + path.sep)) return reply(res, 403, 'Forbidden');

  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) return reply(res, 404, 'Not found');

    const headers = {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-cache',
    };
    if (!req.headers.range) {
      res.writeHead(200, { ...headers, 'Content-Length': stat.size });
      return fs.createReadStream(file).pipe(res);
    }

    const range = parseRange(req.headers.range, stat.size);
    if (!range) return reply(res, 416, '', { 'Content-Range': `bytes */${stat.size}` });
    res.writeHead(206, {
      ...headers,
      'Content-Range': `bytes ${range.start}-${range.end}/${stat.size}`,
      'Content-Length': range.end - range.start + 1,
    });
    fs.createReadStream(file, range).pipe(res);
  });
}
