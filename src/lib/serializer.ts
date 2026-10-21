import type { Article, Block, BlockOf, BlockType, Styles } from '../types';
import { escapeHTML as e, inlineRich, safeURL } from './sanitize';
import { blockImages, galleryImage, galleryFrame, gallerySlide, horizontalViewport, inlineCSS, squareImageFrame, verticalViewport } from './image-layout';
export function styleString(s: Styles, type: BlockType): string {
  let css = `background-color:${s.background};color:${s.color};font-size:${s.fontSize}px;font-weight:${s.fontWeight};line-height:${s.lineHeight};text-align:${s.textAlign};padding:${s.paddingTop}px ${s.paddingRight}px ${s.paddingBottom}px ${s.paddingLeft}px;margin:${s.marginTop}px 0 ${s.marginBottom}px;border:${s.borderWidth}px solid ${s.borderColor};border-radius:${s.borderRadius}px;overflow-wrap:break-word;`;
  if (type === 'sectionHeading') css += `border-left:4px solid ${s.accent};`;
  if (type === 'keyQuote' || type === 'caveatBox' || type === 'quoteParagraph') css += `border-left:3px solid ${s.accent};`;
  if (type === 'subsectionHeading') css += `border-bottom:1px solid ${s.borderColor};`;
  if (type === 'takeaway') css += `border-top:2px solid ${s.accent};`;
  if (type === 'categoryLabel') css += 'letter-spacing:0.5px;';
  return css;
}
const line = (width: number, accent: string) => `<section style="width:${width}px;height:3px;background-color:${accent};margin-bottom:16px;"></section>`;
const heading = (text: string, color = '#05183B', size = 14) => `<p style="margin:0 0 8px;color:${color};font-size:${size}px;font-weight:700;">${e(text)}</p>`;
const caption = (s: string) => `<p style="margin:8px 0 0;font-size:12px;color:#78828E;line-height:1.75;">${e(s)}</p>`;
function image(c: BlockOf<'image'>['content'], preview: boolean): string {
  const src = safeURL(c.src, true, preview);
  return `${src && (!c.local || preview) ? `<img src="${e(src)}" alt="${e(c.caption)}" style="display:block;width:${c.width}%;max-width:100%;height:auto;margin:0 auto;"/>` : `<section style="background-color:#F4F6F9;border:1px dashed #D8DEE7;padding:38px 15px;text-align:center;color:#78828E;font-size:12px;">${c.local ? '本地图片占位 · 请先上传公众号，再填回素材图片 URL' : '图片位置 · 请上传或填写图片地址'}</section>`}${caption(c.caption)}`;
}
type Serializers = { [K in BlockType]: (b: BlockOf<K>, preview: boolean) => string };
export const serializers: Serializers = {
  articleHeader: b => `${line(52,b.styles.accent)}${e(b.content.label)} · ${e(b.content.date)}`,
  articleTitle: b => `<p style="margin:0 0 12px;">${e(b.content.title)}</p><p style="margin:0;font-size:14px;color:#626B77;font-weight:400;line-height:1.75;">${e(b.content.subtitle)}</p>`,
  authorInfo: b => `<p style="margin:0;font-size:inherit;color:inherit;">${e(b.content.author)}</p>`,
  abstract: b => heading(b.content.heading) + inlineRich(b.content.html),
  sectionHeading: b => e(b.content.title),
  subsectionHeading: b => e(b.content.title),
  categoryLabel: b => e(b.content.text),
  keyQuote: b => inlineRich(b.content.html),
  quoteParagraph: b => inlineRich(b.content.html),
  insightBox: b => heading(b.content.heading) + inlineRich(b.content.html),
  caveatBox: b => heading(b.content.heading,'#8C6A0D',12) + inlineRich(b.content.html),
  metrics: b => `<table style="width:100%;border-collapse:collapse;table-layout:fixed;"><tbody><tr>${b.content.items.map((item,i) => `<td style="width:${b.content.items.length === 3 ? 32 : 49}%;background-color:#F4F6F9;padding:16px 10px;vertical-align:top;text-align:center;"><p style="margin:0;font-size:24px;font-weight:700;color:#05183B;">${e(item.value)}</p><p style="margin:4px 0 0;font-size:12px;color:#626B77;">${e(item.description)} / ${e(item.unit)}</p></td>${i < b.content.items.length-1 ? '<td style="width:2%;"></td>' : ''}`).join('')}</tr></tbody></table>`,
  figure: (b,p) => `<p style="margin:0 0 12px;font-size:14px;color:#05183B;font-weight:700;"><span style="background-color:#05183B;color:#FFFFFF;padding:3px 7px;margin-right:8px;font-size:11px;">FIG. ${e(b.content.number)}</span>${e(b.content.title)}</p>${image(b.content,p)}`,
  comparisonTable: b => `<table style="width:100%;border-collapse:collapse;font-size:14px;table-layout:fixed;"><tbody>${b.content.rows.map((row,i) => `<tr>${row.map(cell => `<td style="padding:10px;border:1px solid #E0E5ED;background-color:${i===0 ? b.content.headerColor : i%2===0 ? '#F4F6F9' : '#FFFFFF'};color:${i===0 ? '#FFFFFF' : b.styles.color};font-weight:${i===0 ? 700 : 400};overflow-wrap:break-word;">${e(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`,
  takeaway: b => heading(b.content.heading) + inlineRich(b.content.html),
  references: b => heading(b.content.heading) + b.content.items.map(s => `<p style="margin:0 0 6px;">${e(s)}</p>`).join('') + caption(b.content.note),
  brandFooter: b => `${line(34,b.styles.accent)}<p style="margin:0 0 8px;">${e(b.content.title)}</p><p style="margin:0;font-size:11px;font-weight:400;color:#CDD6E6;letter-spacing:1px;">${e(b.content.subtitle).replace(/\r\n|\r|\n/g,'<br/>')}</p>`,
  paragraph: b => inlineRich(b.content.html),
  image: (b,p) => image(b.content,p),
  scrollImage: (b,p) => {
    const c=b.content;const src=safeURL(c.src,true,p);
    const picture=src&&(!c.local||p)?`<img src="${e(src)}" alt="${e(c.caption)}" style="display:block;width:100%;height:auto;"/>`:`<p style="margin:0;padding:38px 15px;text-align:center;font-size:12px;color:#78828E;">${c.local?'本地长图占位 · 请先上传公众号，再填回素材图片 URL':'长图位置 · 请上传或填写图片地址'}</p>`;
    return `<section style="width:${c.width}%;margin:0 auto;"><section style="${inlineCSS(squareImageFrame())}"><section style="${inlineCSS(verticalViewport())}">${picture}</section></section>${c.showHint?caption('↑ 在图片内上下滑动，查看完整长图 ↓'):''}</section>${caption(c.caption)}`;
  },
  imageGallery: (b,p) => {
    const c=b.content;
    const slides=c.images.map((asset,index)=>{
      const src=safeURL(asset.src,true,p);
      const picture=src&&(!asset.local||p)?`<a href="${e(src)}" target="_blank" rel="noopener noreferrer" title="点击查看完整原图" style="display:block;width:100%;"><img src="${e(src)}" alt="${e(asset.caption||`相册图片 ${index+1}`)}" style="${inlineCSS(galleryImage())}"/></a>`:`<section style="width:100%;min-height:160px;box-sizing:border-box;border:1px dashed #D8DEE7;padding:38px 15px;text-align:center;font-size:12px;color:#78828E;">${asset.local?`本地图片 ${index+1} 占位 · 请先上传公众号，再填回素材图片 URL`:`图片 ${index+1} · 请上传或填写图片地址`}</section>`;
      return `<section style="${inlineCSS(gallerySlide(index===c.images.length-1))}"><section style="${inlineCSS(galleryFrame())}">${picture}</section>${caption(asset.caption)}</section>`;
    }).join('');
    return `<section style="${inlineCSS(horizontalViewport())}">${slides}</section>${c.showHint?caption(`← 左右滑动预览，点击查看完整原图（${c.images.length} 张） →`):''}${caption(c.caption)}`;
  },
  divider: b => `<section style="height:1px;background-color:${b.styles.borderColor};"></section>`,
};
export function serializeBlock(b: Block, preview = false): string {
  // Registry is keyed by the discriminant; correlation is preserved at this dispatch boundary.
  const fn = serializers[b.type] as (b: Block, p: boolean) => string;
  return `<section style="${styleString(b.styles,b.type)}">${fn(b,preview)}</section>`;
}
export function serializeArticle(a: Article, preview = false): string {
  return `<section style="width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:0;border:0;background-color:#FFFFFF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;">${a.blocks.map(b => serializeBlock(b,preview)).join('')}</section>`;
}
export function plainText(a: Article): string { const doc = new DOMParser().parseFromString(serializeArticle(a), 'text/html'); doc.querySelectorAll('p,section,tr,li').forEach(n=>n.append('\n')); return doc.body.textContent?.trim() || ''; }
export function localImages(a: Article) { return a.blocks.flatMap(b=>blockImages(b).filter(i=>i.src&&(i.local||!safeURL(i.src,true))).map(i=>({...i,blockId:b.id}))); }
export function hasScrollableImages(a:Article):boolean{return a.blocks.some(b=>b.type==='scrollImage'||b.type==='imageGallery');}
export function fullHTML(a: Article): string { return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(a.title)}</title></head><body style="margin:0;">${serializeArticle(a)}</body></html>`; }
