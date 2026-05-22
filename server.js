const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');
const crypto = require('crypto');

const PORT      = process.env.PORT         || 3000;
const DATA_DIR  = process.env.DATA_DIR     || __dirname;
const PASSWORD  = process.env.APP_PASSWORD || 'biblioteca';
const HTML_FILE = path.join(__dirname, 'index.html');
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const COOKIE_TTL = 30 * 24 * 3600; // 30 giorni

if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');

// ── Auth ──────────────────────────────────────────────────────────────────────
// Token deterministico: sopravvive ai riavvii del server
const TOKEN = crypto.createHash('sha256').update('bib:' + PASSWORD).digest('hex');

function parseCookies(str = '') {
  const out = {};
  for (const part of str.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k) out[k.trim()] = v.join('=').trim();
  }
  return out;
}

function isAuth(req) {
  return parseCookies(req.headers.cookie || '')['bib_session'] === TOKEN;
}

const LOGIN_HTML = (err = false) => `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>📚 Biblioteca — Accesso</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{
  font-family:Georgia,serif;min-height:100vh;
  display:flex;align-items:center;justify-content:center;
  background-color:#e8d9be;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='40'%3E%3Crect x='1' y='1' width='37' height='17' rx='2' fill='%23a85235' fill-opacity='0.12'/%3E%3Crect x='40' y='1' width='38' height='17' rx='2' fill='%23b05a3a' fill-opacity='0.10'/%3E%3Crect x='0' y='21' width='19' height='17' rx='2' fill='%23a85235' fill-opacity='0.11'/%3E%3Crect x='21' y='21' width='37' height='17' rx='2' fill='%23b05a3a' fill-opacity='0.12'/%3E%3Crect x='60' y='21' width='20' height='17' rx='2' fill='%23a85235' fill-opacity='0.10'/%3E%3C/svg%3E");
  background-size:80px 40px;
  padding:20px;
}
.box{
  background:#fffdf0;border-radius:12px;padding:44px 40px;
  max-width:380px;width:100%;
  border:2px solid #4a2810;
  box-shadow:6px 6px 0 #4a2810;
  text-align:center;
}
h1{color:#4a2810;font-size:1.8rem;margin-bottom:6px;text-shadow:1px 1px 0 rgba(0,0,0,.1);}
.sub{color:#7a5535;font-size:.9rem;margin-bottom:30px;line-height:1.6;}
input{
  display:block;width:100%;padding:11px 16px;
  border:2px solid #e0c9a8;border-radius:8px;
  font-size:1rem;font-family:Georgia,serif;
  background:#fff;color:#2c1a0e;
  margin-bottom:16px;
  transition:border-color .15s;
}
input:focus{outline:none;border-color:#7a5230;}
button{
  width:100%;padding:12px;
  background:#c05018;border:2px solid #8a3010;border-radius:22px;
  color:#fff;font-size:1rem;font-family:Georgia,serif;
  cursor:pointer;box-shadow:2px 2px 0 rgba(30,10,0,.3);
  transition:background .1s,transform .1s;
}
button:hover{background:#d06828;transform:translateY(-1px);}
button:active{transform:translateY(1px);box-shadow:none;}
.err{color:#c0392b;font-size:.83rem;margin-top:14px;}
</style>
</head>
<body>
<div class="box">
  <h1>📚</h1>
  <h1 style="font-size:1.3rem;margin-top:6px">Biblioteca di Casa</h1>
  <p class="sub">Inserisci la password per accedere</p>
  <form method="POST" action="/login">
    <input type="password" name="pwd" placeholder="Password"
      autofocus autocomplete="current-password">
    <button type="submit">Entra →</button>
  </form>
  ${err ? '<p class="err">❌ Password errata — riprova</p>' : ''}
</div>
</body>
</html>`;

// ── Dati ──────────────────────────────────────────────────────────────────────
const sseClients = new Set();

function load() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return []; }
}

function save(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(r => { try { r.write(msg); } catch { sseClients.delete(r); } });
}

function readBody(req) {
  return new Promise(resolve => {
    let b = '';
    req.on('data', chunk => b += chunk);
    req.on('end', () => resolve(b));
  });
}

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

// ── Server ────────────────────────────────────────────────────────────────────
http.createServer(async (req, res) => {
  const { method } = req;
  const p = new URL(req.url, 'http://x').pathname;

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  try {
    // ── Login GET ──
    if (p === '/login' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(LOGIN_HTML());
      return;
    }

    // ── Login POST ──
    if (p === '/login' && method === 'POST') {
      const params = new URLSearchParams(await readBody(req));
      if (params.get('pwd') === PASSWORD) {
        res.writeHead(302, {
          'Set-Cookie': `bib_session=${TOKEN}; Path=/; HttpOnly; Max-Age=${COOKIE_TTL}; SameSite=Strict`,
          'Location': '/',
        });
        res.end();
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(LOGIN_HTML(true));
      }
      return;
    }

    // ── Logout ──
    if (p === '/logout') {
      res.writeHead(302, {
        'Set-Cookie': 'bib_session=; Path=/; Max-Age=0',
        'Location': '/login',
      });
      res.end();
      return;
    }

    // ── Auth guard ──
    if (!isAuth(req)) {
      res.writeHead(302, { 'Location': '/login' });
      res.end();
      return;
    }

    // ── App HTML ──
    if (p === '/' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(HTML_FILE));
      return;
    }

    // ── SSE ──
    if (p === '/api/eventi' && method === 'GET') {
      res.writeHead(200, {
        'Content-Type':      'text/event-stream',
        'Cache-Control':     'no-cache',
        'Connection':        'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write(`data: ${JSON.stringify(load())}\n\n`);
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    // ── GET libri ──
    if (p === '/api/libri' && method === 'GET') {
      sendJSON(res, 200, load()); return;
    }

    // ── POST libro ──
    if (p === '/api/libri' && method === 'POST') {
      const libro = JSON.parse(await readBody(req));
      const libri = load();
      libri.push(libro);
      save(libri);
      sendJSON(res, 201, libro); return;
    }

    // ── PUT / DELETE ──
    const match = p.match(/^\/api\/libri\/([^/]+)$/);
    if (match) {
      const id    = decodeURIComponent(match[1]);
      const libri = load();
      if (method === 'PUT') {
        const idx = libri.findIndex(b => b.id === id);
        if (idx === -1) { sendJSON(res, 404, { err: 'non trovato' }); return; }
        Object.assign(libri[idx], JSON.parse(await readBody(req)));
        save(libri);
        sendJSON(res, 200, libri[idx]); return;
      }
      if (method === 'DELETE') {
        save(libri.filter(b => b.id !== id));
        sendJSON(res, 200, { ok: true }); return;
      }
    }

    res.writeHead(404); res.end('Non trovato');

  } catch (e) {
    console.error('Errore:', e.message);
    res.writeHead(500); res.end('Errore interno');
  }

}).on('error', e => {
  if (e.code === 'EADDRINUSE') {
    const hostname = os.hostname().replace(/\.local$/, '');
    console.log(`\n  ⚡  Server già in esecuzione sulla porta ${PORT}.`);
    console.log(`     http://localhost:${PORT}\n`);
    process.exit(0);
  }
  throw e;
}).listen(PORT, '0.0.0.0', () => {
  const nets     = Object.values(os.networkInterfaces()).flat();
  const net      = nets.find(n => n.family === 'IPv4' && !n.internal);
  const ip       = net ? net.address : '—';
  const hostname = os.hostname().replace(/\.local$/, '');
  const line     = '═'.repeat(52);
  console.log(`\n${line}`);
  console.log('          📚   Biblioteca di Casa   📚');
  console.log(line);
  console.log(`   🖥   Questo Mac   →  http://localhost:${PORT}`);
  console.log(`   📱   Rete casa    →  http://${hostname}.local:${PORT}`);
  console.log(`   🌐   IP           →  http://${ip}:${PORT}`);
  console.log(`   🔑   Password     →  ${PASSWORD === 'biblioteca' ? 'biblioteca (⚠️  cambia in produzione!)' : '***'}`);
  console.log(line + '\n');
});
