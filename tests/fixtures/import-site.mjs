import { createServer } from "node:http";
const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
export async function startImportSite() {
  let mutations = 0;
  const server = createServer((req, res) => {
    if (req.url === "/mutate") { mutations++; res.end("unexpected"); return; }
    if (req.url === "/pixel.png") { res.setHeader("Content-Type", "image/png"); res.end(pixel); return; }
    if (req.url === "/vector.svg") { res.setHeader("Content-Type", "image/svg+xml"); res.end('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="80" height="40" fill="#287b83"/><script>fetch("/mutate")</script></svg>'); return; }
    if (req.url === "/external.css") { res.setHeader("Content-Type", "text/css"); res.end(".card{box-shadow:0 8px 20px #0001}"); return; }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (req.url.startsWith("/login")) { res.end('<h1>Sign in</h1><input type="password" value="fixture-secret">'); return; }
    res.end(`<!doctype html><html><head><title>Publishing workspace</title><link rel="stylesheet" href="/external.css"><style>
*{box-sizing:border-box}body{margin:0;font:16px Arial;background:#f1f4f5;color:#193b43}header{height:70px;background:#fff;padding:20px;position:sticky;top:0}main{padding:32px}h1{font-size:36px}.card{background:#fff;border-radius:16px;padding:28px;width:400px}button{padding:12px 24px;border:0;border-radius:8px;background:#1a766e;color:white}#menu{position:absolute;top:240px;left:64px;padding:20px;background:#fff;box-shadow:0 5px 30px #0004;z-index:20}#menu[hidden]{display:none}.swatch{width:80px;height:40px;background-image:url('/pixel.png')}#long{height:1300px}#private{font-size:14px}#late{color:#176153}
</style></head><body><header><a href="/calendar">Calendar</a> · <a href="/settings">Settings</a></header><main><h1>${req.url.startsWith("/settings") ? "Settings" : "Content calendar"}</h1><p id="private">member@example.test</p><div class="card" aria-label="Reference card"><h2>Draft reference</h2><p>Nested text</p><button id="filter" onclick="document.querySelector('#menu').hidden=!document.querySelector('#menu').hidden">All posts</button><div id="menu" hidden><button id="published" onclick="document.querySelector('#status').textContent='Published';document.querySelector('#menu').hidden=true">Published</button></div><p id="status">All statuses</p><img src="/pixel.png" alt="Synthetic image" width="60" height="40"><img src="/vector.svg" alt="Vector image" width="80" height="40"><div class="swatch"></div><svg width="24" height="24" viewBox="0 0 24 24"><path d="M2 12h20" stroke="currentColor" stroke-width="2"/></svg></div><button id="async" onclick="setTimeout(()=>document.querySelector('#late').textContent='Ready after request',120)">Load result</button><p id="late">Waiting</p><div id="long">Long page reference</div></main><script>window.originalAppRan=true;</script></body></html>`);
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, mutations: () => mutations, close: () => new Promise(resolve => server.close(resolve)) };
}
