import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';

const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  let state = { current: '1.4.4', latest: '1.4.4', phase: 'idle', progress: 0, token: 'fixture-token', postponed: false };
  let offline = false, reads = 0;
  const actions = [];
  await context.route('**/.qusu-update**', async route => {
    const action = new URL(route.request().url()).pathname.split('/')[2];
    if (!action) reads++;
    if (['startup', 'auto', 'check'].includes(action)) {
      actions.push(action);
      state = { ...state, phase: offline ? 'error' : state.latest === state.current ? 'current' : 'available', error: offline ? '无法连接更新服务' : undefined };
    }
    if (action === 'install') { actions.push(action); state = { ...state, phase: 'downloading' }; }
    await route.fulfill({ json: state });
  });
  const page = await context.newPage();
  const dialog = page.getByRole('dialog', { name: '软件更新' });
  await page.goto(origin + '/?checkUpdate=startup');
  await expect.poll(() => actions.filter(action => action === 'startup').length).toBe(1);
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: '检查更新', exact: true }).click();
  await expect(dialog).toContainText('已是最新版本');
  await dialog.getByRole('button', { name: '关闭', exact: true }).click();
  // A background check finds a new version; only this result opens a prompt.
  state = { ...state, latest: '1.4.5', phase: 'available' };
  await expect(dialog).toContainText('最新版本：v1.4.5');
  await dialog.getByRole('button', { name: '暂不更新', exact: true }).click();
  const previousReads = reads;
  await expect.poll(() => reads).toBeGreaterThan(previousReads + 1);
  await expect(dialog).not.toBeVisible();
  expect(actions).not.toContain('install');
  state = { ...state, latest: '1.4.6', phase: 'available' };
  await expect(dialog).toContainText('最新版本：v1.4.6');
  await dialog.getByRole('button', { name: '立即更新', exact: true }).click();
  await expect.poll(() => actions.filter(action => action === 'install').length).toBe(1);
  await expect(dialog).not.toBeVisible();
  await page.close();
  // Network errors from automatic checks stay silent, including on reopening.
  offline = true; state = { ...state, latest: state.current, phase: 'idle' };
  const failed = await context.newPage();
  await failed.goto(origin + '/?checkUpdate=startup');
  await expect.poll(() => actions.filter(action => action === 'startup').length).toBe(2);
  await expect(failed.getByRole('dialog')).not.toBeVisible();
  await failed.goto(origin + '/?checkUpdate=auto');
  await expect.poll(() => actions.filter(action => action === 'auto').length).toBe(1);
  await expect(failed.getByRole('dialog')).not.toBeVisible();
  await failed.getByRole('button', { name: '检查更新', exact: true }).click();
  await expect(failed.getByRole('dialog')).toContainText('无法连接更新服务');
  await failed.close();
  // A fresh software launch with an available release does prompt.
  offline = false; state = { ...state, latest: '1.4.7', phase: 'idle' };
  const fresh = await context.newPage();
  await fresh.goto(origin + '/?checkUpdate=startup');
  await expect(fresh.getByRole('dialog')).toContainText('最新版本：v1.4.7');
  expect(actions.filter(action => action === 'install')).toHaveLength(1);
  console.log('Update notice passed: quiet startup/current/error/reopen, manual feedback, automatic new-release prompt, dismissal without repeated prompts, and explicit installation consent.');
} finally {
  await browser?.close();
  await server.close();
}
