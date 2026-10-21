import { chromium, expect } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir } from 'node:fs/promises';

const server = await createServer({ server: { host: '127.0.0.1', port: 0, open: false } });
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(origin);
  await expect(page.locator('[data-block-id]')).toHaveCount(22);
  await expect(page.getByLabel('章节编号',{exact:true})).toHaveCount(0);
  await expect(page.getByLabel('章节标题',{exact:true})).toHaveValue('从一个观察开始');
  expect(await page.locator('[data-block-type=sectionHeading]').innerText()).not.toContain(' / ');
  await page.evaluate(async () => {
    const { createBlock } = await import('/src/blocks/registry.ts');
    const { newArticle } = await import('/src/lib/project.ts');
    const { useEditorStore } = await import('/src/store/editor.ts');
    const block = createBlock('imageGallery');
    block.content.images = [200, 800, 400].map((height, index) => {
      const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = height;
      const context = canvas.getContext('2d'); context.fillStyle = ['#e3ba35', '#05183b', '#bfcbdc'][index]; context.fillRect(0, 0, 400, height);
      return { id: `geometry-${index}`, src: canvas.toDataURL(), local: true, caption: '' };
    });
    useEditorStore.getState().replace({ ...newArticle(true), blocks: [block] });
  });
  async function geometry(target, selector) {
    await expect.poll(() => target.locator(`${selector} img`).evaluateAll(images => images.length === 3 && images.every(img => img.complete && img.naturalWidth > 0))).toBe(true);
    return target.locator(selector).evaluate(element => ({
      height: element.getBoundingClientRect().height,
      slides: Array.from(element.children).map(slide => slide.getBoundingClientRect().height),
      images: Array.from(element.querySelectorAll('img')).map(img => ({ width: img.getBoundingClientRect().width, height: img.getBoundingClientRect().height, ratio: img.naturalHeight / img.naturalWidth })),
    }));
  }
  function assertTallest(result) {
    for (const image of result.images) expect(Math.abs(image.height - image.width * image.ratio)).toBeLessThan(1);
    expect(Math.abs(result.height - Math.max(...result.slides))).toBeLessThan(2);
    expect(result.height).toBeGreaterThanOrEqual(Math.max(...result.images.map(image => image.height)));
  }
  const canvas = await geometry(page, '.gallery-viewport'); assertTallest(canvas);
  expect(canvas.images[1].height).toBeGreaterThan(canvas.images[0].height * 3);
  await page.locator('.article-paper').evaluate(element => { element.style.transition = 'none'; element.style.width = '360px'; });
  const narrow = await geometry(page, '.gallery-viewport'); assertTallest(narrow);
  expect(narrow.height).toBeLessThan(canvas.height);
  // Replace the tallest image: the viewport must shrink instead of retaining an old maximum.
  await page.evaluate(async () => {
    const { useEditorStore } = await import('/src/store/editor.ts');
    const store = useEditorStore.getState(); const block = store.article.blocks[0];
    store.content(block.id, 'imageGallery', { images: block.content.images.map((image, index) => index === 1 ? { ...image, src: block.content.images[0].src } : image) }, true);
  });
  await expect.poll(() => page.locator('.gallery-viewport img').nth(1).evaluate(img => img.naturalHeight)).toBe(200);
  const replaced = await geometry(page, '.gallery-viewport'); assertTallest(replaced);
  expect(replaced.height).toBeLessThan(narrow.height);
  const html = await page.evaluate(async () => {
    const { serializeBlock } = await import('/src/lib/serializer.ts');
    const { useEditorStore } = await import('/src/store/editor.ts');
    return serializeBlock(useEditorStore.getState().article.blocks[0], true);
  });
  const exported = await browser.newPage();
  await exported.setContent(`<body style="margin:0"><main style="width:600px">${html}</main></body>`);
  const selector = 'main>section>section';
  const wideExport = await geometry(exported, selector); assertTallest(wideExport);
  await exported.locator('main').evaluate(element => { element.style.width = '360px'; });
  const narrowExport = await geometry(exported, selector); assertTallest(narrowExport);
  expect(narrowExport.height).toBeLessThan(wideExport.height);
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/gallery-auto-height.png' });
  console.log('Gallery layout passed: mixed aspect ratios, tallest off-screen image, responsive width, tallest-image replacement and standalone exported HTML.');
} finally {
  await browser?.close();
  await server.close();
}
