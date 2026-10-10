const { app, BrowserWindow, Menu, net, protocol, session, shell, dialog } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

app.setName('QUSU Editor');
if (process.env.QUSU_TEST_USER_DATA) app.setPath('userData', process.env.QUSU_TEST_USER_DATA);
protocol.registerSchemesAsPrivileged([{ scheme: 'qusu', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
let window;
function trusted(url) { try { const parsed = new URL(url); return parsed.protocol === 'qusu:' && parsed.host === 'app'; } catch { return false; } }
function external(url) { try { if (['https:', 'http:', 'mailto:'].includes(new URL(url).protocol)) shell.openExternal(url).catch(() => {}); } catch {} }
function createWindow() {
  window = new BrowserWindow({ title: 'QUSU Editor', icon: path.join(__dirname, 'icon.png'), width: 1440, height: 1000, minWidth: 900, minHeight: 650, backgroundColor: '#f3f4f6', show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true } });
  window.once('ready-to-show', () => { if (!process.env.QUSU_TEST_USER_DATA) window.show(); });
  window.webContents.setWindowOpenHandler(({ url }) => { external(url); return { action: 'deny' }; });
  window.webContents.on('will-navigate', (event, url) => { if (!trusted(url)) { event.preventDefault(); external(url); } });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {
    if (isMainFrame && code !== -3) dialog.showErrorBox('QUSU Editor 无法打开', `请重新启动应用。错误：${description}`);
  });
  window.on('closed', () => { window = null; });
  window.loadURL('qusu://app/index.html');
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); } });
  app.whenReady().then(() => {
    const root = path.join(app.getAppPath(), 'dist');
    protocol.handle('qusu', request => {
      try {
        if (!trusted(request.url) || !['GET', 'HEAD'].includes(request.method)) return new Response('Not found', { status: 404 });
        const pathname = decodeURIComponent(new URL(request.url).pathname);
        const target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
        const relative = path.relative(root, target);
        if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return new Response('Forbidden', { status: 403 });
        return net.fetch(pathToFileURL(target).toString()).catch(() => new Response('Not found', { status: 404 }));
      } catch { return new Response('Not found', { status: 404 }); }
    });
    session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => callback(trusted(contents?.getURL() || '') && ['clipboard-sanitized-write', 'clipboard-write'].includes(permission)));
    session.defaultSession.setPermissionCheckHandler((contents, permission) => trusted(contents?.getURL() || '') && ['clipboard-sanitized-write', 'clipboard-write'].includes(permission));
    session.defaultSession.on('will-download', (_event, item) => item.setSaveDialogOptions({ defaultPath: path.join(app.getPath('downloads'), item.getFilename()) }));
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
      { label: '编辑', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
      { label: '视图', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] },
      { role: 'windowMenu' },
    ]));
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  }).catch(error => { dialog.showErrorBox('QUSU Editor 启动失败', error.message); app.quit(); });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
