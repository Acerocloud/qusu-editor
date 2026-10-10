// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createBlock } from '../blocks/registry';
import { sanitizeRich } from './sanitize';
import { serializeBlock } from './serializer';
import { newArticle, parseProject } from './project';

describe('inline text styles and quoted paragraphs', () => {
  it('preserves supported text styles while removing unrelated and unsafe CSS', () => {
    const html = sanitizeRich('<p style="position:fixed">普通<span style="color:#e34040;font-size:22px;font-weight:600;background-color:#fff0b3;position:fixed;background-image:url(https://example.com/track);width:999px" onclick="alert(1)">强调<u>下划线</u></span>正文</p>');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('p')?.hasAttribute('style')).toBe(false);
    const span = doc.querySelector('span')!;
    expect(span.style.fontSize).toBe('22px');
    expect(span.style.fontWeight).toBe('600');
    expect(span.style.color).toBe('rgb(227, 64, 64)');
    expect(span.style.backgroundColor).toBe('rgb(255, 240, 179)');
    expect(html).not.toMatch(/position|url\(|onclick|width:/);
    expect(span.querySelector('u')?.textContent).toBe('下划线');
    expect(sanitizeRich('<span style="font-size:999px;font-weight:900;color:var(--x)">x</span>')).not.toContain('style=');
  });
  it('keeps the quoted appearance and selected text through save and publishing', () => {
    const b = createBlock('quoteParagraph');
    b.content.html = '<p>普通<span style="color:#e34040;font-size:22px">引用</span>正文</p>';
    const article = { ...newArticle(), blocks: [b] };
    const restored = parseProject(JSON.stringify(article));
    const html = serializeBlock(restored.blocks[0]);
    expect(html).toContain('background-color:#F3F5F8');
    expect(html).toContain('border-left:3px solid #BBC7D7');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('span')?.style.fontSize).toBe('22px');
    expect(doc.querySelector('span')?.textContent).toBe('引用');
    expect(doc.querySelector('p')?.textContent).toBe('普通引用正文');
  });
});
