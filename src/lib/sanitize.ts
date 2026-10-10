import DOMPurify from 'dompurify';
export const escapeHTML = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export function safeURL(value: string, image = false, local = false): string {
  if (image && local && /^data:image\/(png|jpe?g|gif|webp);base64,[a-z\d+/=]+$/i.test(value)) return value;
  try { const u = new URL(value); return ['https:', 'http:', ...(image ? [] : ['mailto:', 'tel:'])].includes(u.protocol) ? u.href : ''; } catch { return ''; }
}
export function sanitizeRich(html: string): string {
  const clean = DOMPurify.sanitize(html, { ALLOWED_TAGS: ['p','br','strong','b','em','i','s','u','a','ul','ol','li','blockquote','h1','h2','h3','h4','span'], ALLOWED_ATTR: ['href','title','style'], ALLOW_DATA_ATTR: false });
  const doc = new DOMParser().parseFromString(clean, 'text/html');
  doc.querySelectorAll<HTMLElement>('[style]').forEach(el => {
    const original = el.style;
    const allowed: [string,string][] = [];
    if (el.tagName === 'SPAN') {
      for (const key of ['color','background-color']) {
        const value = original.getPropertyValue(key);
        if (/^(#[\da-f]{3,8}|[a-z]+|(?:rgb|hsl)a?\([\d\s.,%/+-]+\))$/i.test(value)) allowed.push([key,value]);
      }
      const size = original.fontSize;
      if (/^\d+(?:\.\d+)?px$/.test(size) && parseFloat(size)>=8 && parseFloat(size)<=96) allowed.push(['font-size',size]);
      if (/^[4-7]00$/.test(original.fontWeight)) allowed.push(['font-weight',original.fontWeight]);
    }
    el.removeAttribute('style');
    allowed.forEach(([key,value]) => el.style.setProperty(key,value));
  });
  doc.querySelectorAll('a').forEach(a => { const url = safeURL(a.getAttribute('href') || ''); if (url) a.setAttribute('href', url); else a.removeAttribute('href'); });
  return doc.body.innerHTML;
}
export function inlineRich(html: string): string {
  const doc = new DOMParser().parseFromString(sanitizeRich(html), 'text/html');
  doc.body.querySelectorAll('*').forEach(el => {
    const map: Record<string, string> = { P: 'margin:0 0 8px;overflow-wrap:break-word;', UL: 'margin:8px 0;padding-left:24px;', OL: 'margin:8px 0;padding-left:24px;', LI: 'margin:3px 0;', A: 'color:#05183B;text-decoration:underline;', BLOCKQUOTE: 'margin:8px 0;padding-left:15px;border-left:3px solid #D8DEE7;', H1: 'font-size:24px;margin:12px 0;', H2: 'font-size:21px;margin:12px 0;', H3: 'font-size:17px;margin:12px 0;', H4: 'font-size:15px;margin:12px 0;' };
    if (map[el.tagName]) el.setAttribute('style', map[el.tagName]);
  });
  if(doc.body.lastElementChild?.tagName==='P')doc.body.lastElementChild.setAttribute('style','margin:0;overflow-wrap:break-word;');
  return doc.body.innerHTML;
}
