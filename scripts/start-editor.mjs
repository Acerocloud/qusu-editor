import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const url = 'http://127.0.0.1:5173/';
const noBrowser = process.argv.includes('--no-browser');

function openBrowser() {
  if (noBrowser || process.platform !== 'win32') return;
  const browser = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], {
    detached: true, stdio: 'ignore', windowsHide: true,
  });
  browser.on('error', () => console.log(`请手动打开浏览器访问 ${url}`));
  browser.unref();
}

async function main() {
  // Reuse only an existing QUSU instance, rather than silently switching ports.
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    const html = await response.text();
    if (response.ok && html.includes('QUSU Editor') && html.includes('/src/main.tsx')) {
      console.log(`QUSU Editor 已在运行：${url}`);
      openBrowser();
      return;
    }
  } catch { /* No existing server; start this project's Vite instance. */ }

  let createServer;
  try { ({ createServer } = await import('vite')); }
  catch { throw new Error('未找到项目依赖。请在项目目录运行 npm install，再启动编辑器。'); }
  const server = await createServer({ root, server: { host: '127.0.0.1', port: 5173, strictPort: true } });
  await server.listen();
  console.log(`\nQUSU Editor 已启动：${url}`);
  console.log('浏览器将自动打开。使用编辑器期间请保留此窗口；按 Ctrl+C 停止。\n');
  openBrowser();
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await server.close();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch(error => {
  console.error('\n启动失败：', error.message);
  if (error.code === 'EADDRINUSE' || String(error.message).includes('already in use')) {
    console.error('5173 端口被其他程序占用，请关闭占用程序后重试。');
  }
  process.exitCode = 1;
});
