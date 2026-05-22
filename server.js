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
  background-size:80px 40px;padding:20px;
}

/* ── lucchetto ── */
.lock{width:80px;margin:0 auto 20px;position:relative;transition:transform .7s ease,opacity .7s ease;}
.lock-shackle{
  width:46px;height:34px;
  border:8px solid #5c3310;border-bottom:none;
  border-radius:26px 26px 0 0;
  margin:0 auto;
  transform-origin:50% 100%;
  transition:transform .6s cubic-bezier(.34,1.56,.64,1);
}
.lock-body{
  width:80px;height:62px;
  background:linear-gradient(135deg,#9a6635,#5c3310);
  border-radius:10px;
  display:flex;align-items:center;justify-content:center;flex-direction:column;gap:0;
  box-shadow:0 4px 14px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.15);
  transition:box-shadow .4s,background .4s;
  position:relative;overflow:hidden;
}
.lock-body::before{content:'';position:absolute;inset:0;border-radius:10px;
  background:linear-gradient(135deg,rgba(255,255,255,.14),transparent 55%);}
.kh-circle{width:14px;height:14px;border-radius:50%;background:#2c1a0e;
  box-shadow:inset 0 2px 4px rgba(0,0,0,.6);}
.kh-slot{width:7px;height:11px;background:#2c1a0e;border-radius:0 0 3px 3px;margin-top:-1px;}

/* stati lucchetto */
.lock.opening .lock-shackle{transform:rotate(38deg) translateY(-5px);}
.lock.opening .lock-body{
  background:linear-gradient(135deg,#d4a060,#9a6030);
  box-shadow:0 4px 28px rgba(200,140,40,.8),0 0 50px rgba(255,190,60,.5);
}
.lock.gone{transform:translateY(-100px) scale(.5);opacity:0;}

@keyframes shake{
  0%,100%{transform:translateX(0) rotate(0);}
  15%{transform:translateX(-10px) rotate(-5deg);}
  35%{transform:translateX(10px) rotate(5deg);}
  55%{transform:translateX(-7px) rotate(-3deg);}
  75%{transform:translateX(7px) rotate(3deg);}
}
.lock.shaking{animation:shake .45s cubic-bezier(.36,.07,.19,.97);}

/* ── box login ── */
.box{
  background:#fffdf0;border-radius:12px;padding:36px 40px 40px;
  max-width:380px;width:100%;
  border:2px solid #4a2810;box-shadow:6px 6px 0 #4a2810;
  text-align:center;
  transition:opacity .5s ease,transform .5s ease;
}
.box.hide{opacity:0;transform:scale(.92);}
h1{color:#4a2810;font-size:1.3rem;margin-bottom:6px;}
.sub{color:#7a5535;font-size:.88rem;margin-bottom:24px;line-height:1.5;}
input{
  display:block;width:100%;padding:11px 16px;
  border:2px solid #e0c9a8;border-radius:8px;
  font-size:1rem;font-family:Georgia,serif;
  background:#fff;color:#2c1a0e;
  margin-bottom:14px;transition:border-color .15s;
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
.err{color:#c0392b;font-size:.83rem;margin-top:12px;display:none;}

/* ── stanza rivelata ── */
.room{
  position:fixed;inset:0;z-index:200;
  background:#0d0603;
  opacity:0;pointer-events:none;
  transition:opacity .7s ease;
  overflow:hidden;
}
.room.show{opacity:1;}
.ro-shelf{
  position:absolute;bottom:0;width:23%;height:90%;
  background:repeating-linear-gradient(0deg,
    #3d1f0d 0px,#3d1f0d 7px,#5a3010 7px,#5a3010 66px);
  border-top:3px solid #5c3010;
}
.ro-shelf.l{left:0;}
.ro-shelf.r{right:0;}
.ro-fp{
  position:absolute;bottom:0;left:50%;transform:translateX(-50%);
  width:210px;height:145px;
  background:linear-gradient(to top,#2c1408,#3d1f0d);
  border-radius:3px 3px 0 0;
}
.ro-fp::after{
  content:'';position:absolute;bottom:0;left:50%;transform:translateX(-50%);
  width:136px;height:115px;
  border-radius:50% 50% 0 0/40% 40% 0 0;
  background:radial-gradient(ellipse at 50% 100%,
    rgba(255,120,20,.95) 0%,rgba(255,50,0,.5) 40%,transparent 72%);
  animation:gfp 1.4s ease-in-out infinite alternate;
}
@keyframes gfp{0%{opacity:.65}100%{opacity:1}}
.ro-glow{
  position:absolute;bottom:0;left:0;right:0;height:45%;
  background:radial-gradient(ellipse at 50% 100%,rgba(255,80,0,.1),transparent 65%);
}
.ro-win{
  position:absolute;left:50%;transform:translateX(-50%);
  bottom:225px;width:145px;height:205px;
  background:linear-gradient(to bottom,#0a1520,#142030);
  border:10px solid #3d1f0d;border-radius:3px;
}
.ro-welcome{
  position:absolute;top:44%;left:50%;transform:translate(-50%,-50%);
  text-align:center;color:#f5deb3;font-family:Georgia,serif;
  opacity:0;animation:wfc 1s ease .7s forwards;
}
.ro-welcome h2{font-size:2rem;text-shadow:0 0 24px rgba(255,150,50,.9);margin-bottom:10px;}
.ro-welcome p{font-size:.92rem;color:#c4956a;}
@keyframes wfc{to{opacity:1;}}
</style>
</head>
<body>

<!-- stanza — mostrata dopo login corretto -->
<div class="room" id="room">
  <div class="ro-shelf l"></div>
  <div class="ro-shelf r"></div>
  <div class="ro-fp"></div>
  <div class="ro-glow"></div>
  <div class="ro-win"></div>
  <div class="ro-welcome">
    <h2>📚 Benvenuto/a!</h2>
    <p>La tua biblioteca ti aspetta…</p>
  </div>
</div>

<div class="box" id="box">
  <div class="lock" id="lock">
    <div class="lock-shackle"></div>
    <div class="lock-body">
      <div class="kh-circle"></div>
      <div class="kh-slot"></div>
    </div>
  </div>
  <h1>Biblioteca di Casa</h1>
  <p class="sub">Inserisci la password per accedere</p>
  <form id="form" method="POST" action="/login">
    <input type="password" name="pwd" id="pwd"
      placeholder="Password" autofocus autocomplete="current-password">
    <button type="submit" id="btn">Entra →</button>
  </form>
  <p class="err" id="err">❌ Password errata — riprova</p>
</div>

<script>
(function(){
  var form=document.getElementById('form');
  var lock=document.getElementById('lock');
  var box =document.getElementById('box');
  var err =document.getElementById('err');
  var room=document.getElementById('room');
  var btn =document.getElementById('btn');

  form.addEventListener('submit',function(e){
    e.preventDefault();
    var pwd=document.getElementById('pwd').value;
    err.style.display='none';
    btn.disabled=true; btn.textContent='…';

    fetch('/login',{
      method:'POST',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:'pwd='+encodeURIComponent(pwd),
      redirect:'manual'
    }).then(function(res){
      var ok=(res.type==='opaqueredirect'||res.status===302||res.status===200&&res.redirected);
      if(ok){
        /* 1. lucchetto si apre */
        lock.classList.add('opening');
        setTimeout(function(){ lock.classList.add('gone'); },800);
        /* 2. box scompare, stanza appare */
        setTimeout(function(){ box.classList.add('hide'); },900);
        setTimeout(function(){ room.classList.add('show'); },1000);
        /* 3. redirect all'app */
        setTimeout(function(){ window.location.href='/'; },2800);
      } else {
        lock.classList.add('shaking');
        lock.addEventListener('animationend',function(){ lock.classList.remove('shaking'); },{once:true});
        err.style.display='block';
        btn.disabled=false; btn.textContent='Entra →';
      }
    }).catch(function(){
      form.submit(); /* fallback senza JS avanzato */
    });
  });
})();
</script>
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
