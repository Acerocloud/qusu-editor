const { app, Menu, Tray, nativeImage, shell, dialog } = require('electron');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

app.setName('QUSU Editor');
if (process.env.QUSU_TEST_USER_DATA) app.setPath('userData', process.env.QUSU_TEST_USER_DATA);
const port = process.env.QUSU_TEST_USER_DATA && process.env.QUSU_TEST_PORT ? Number(process.env.QUSU_TEST_PORT) : 17863; // Stable origin keeps browser articles across restarts and upgrades.
const url = `http://127.0.0.1:${port}/`;
let server;
let tray;
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
async function openEditor() {
  // Test the OS boundary without opening the user's real browser.
  if (process.env.QUSU_TEST_USER_DATA) { app.qusuOpenedURLs ??= []; app.qusuOpenedURLs.push(url); return; }
  try { await shell.openExternal(url); }
  catch { dialog.showErrorBox('无法自动打开浏览器', `请在浏览器地址栏打开：${url}`); }
}
async function startServer() {
  const root = path.join(app.getAppPath(), 'dist');
  server = http.createServer(async (request, response) => {
    const reply = (status, message) => { response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end(message); };
    if (request.headers.host !== `127.0.0.1:${port}`) return reply(403, 'Forbidden');
    if (!['GET', 'HEAD'].includes(request.method)) return reply(405, 'Method not allowed');
    try {
      const pathname = decodeURIComponent(new URL(request.url, url).pathname);
      const target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      const relative = path.relative(root, target);
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return reply(403, 'Forbidden');
      const content = await fs.readFile(target);
      response.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(request.method === 'HEAD' ? undefined : content);
    } catch { reply(404, 'Not found'); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  app.qusuEditorURL = url;
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (app.qusuEditorURL) openEditor(); });
  app.whenReady().then(async () => {
    await startServer();
    tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 22, height: 22 }));
    tray.setToolTip('QUSU Editor — 浏览器编辑器');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: '打开编辑器', click: openEditor },
      { label: url, enabled: false },
      { type: 'separator' },
      { label: '退出 QUSU Editor', click: () => app.quit() },
    ]));
    tray.on('click', openEditor);
    Menu.setApplicationMenu(null);
    if (process.platform === 'darwin') app.dock.hide();
    app.on('activate', openEditor);
    await openEditor();
  }).catch(error => {
    const message = error.code === 'EADDRINUSE' ? `本地端口 ${port} 已被其他程序占用，请关闭占用程序后重新启动。` : error.message;
    dialog.showErrorBox('QUSU Editor 启动失败', message);
    app.quit();
  });
  app.on('before-quit', () => { server?.close(); tray?.destroy(); });
}
