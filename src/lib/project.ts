import DOMPurify from 'dompurify';
import { nanoid } from 'nanoid';
import type { Article, Block, BlockType, ContentMap, Styles } from '../types';
import { blockTypes, createBlock, exampleBlocks, baseStyles } from '../blocks/registry';
import { safeURL, sanitizeRich } from './sanitize';
export function newArticle(blank=false): Article { const now = new Date().toISOString(); return { schemaVersion:1, id:nanoid(),title:blank?'未命名文章':'把想法写成一篇好文章',blocks:blank?[]:exampleBlocks(),createdAt:now,updatedAt:now }; }
function string(x: unknown): x is string { return typeof x==='string' && x.length<=5_000_000; }
function strings(x: unknown): x is string[] { return Array.isArray(x) && x.length<=1000 && x.every(string); }
function object(x: unknown): x is Record<string,unknown> { return !!x && typeof x==='object' && !Array.isArray(x); }
function validContent(type: BlockType, c: Record<string,unknown>): boolean {
  const defaults = createBlock(type).content;
  if (!Object.entries(defaults).every(([k,v]) => typeof v==='string' ? string(c[k]) : typeof v==='number' ? typeof c[k]==='number' && Number.isFinite(c[k]) : typeof v==='boolean' ? typeof c[k]==='boolean' : true)) return false;
  if (type==='metrics') return Array.isArray(c.items) && [2,3].includes(c.items.length) && c.items.every(i=>object(i) && string(i.value)&&string(i.unit)&&string(i.description));
  if (type==='comparisonTable') return Array.isArray(c.rows) && c.rows.length>0 && c.rows.length<=100 && c.rows.every(r=>strings(r) && r.length>0 && r.length<=20 && r.length===(c.rows as string[][])[0].length) && typeof c.headerColor==='string' && /^#[0-9a-f]{6}$/i.test(c.headerColor);
  if (type==='references') return strings(c.items);
  if (type==='imageGallery') { const ids=new Set<string>();return Array.isArray(c.images)&&c.images.length>=1&&c.images.length<=20&&c.images.every(i=>{if(!object(i)||!string(i.id)||!i.id||ids.has(i.id)||!string(i.src)||!string(i.caption)||typeof i.local!=='boolean')return false;ids.add(i.id);return true;}); }
  return true;
}
export function parseProject(raw: string): Article {
  const x: unknown = JSON.parse(raw);
  if (!object(x)||x.schemaVersion!==1||!string(x.id)||!string(x.title)||!string(x.createdAt)||!string(x.updatedAt)||!Array.isArray(x.blocks)||x.blocks.length>1000) throw new Error('项目格式无效或版本不受支持（需要 schemaVersion 1）。');
  const ids=new Set<string>();
  const blocks: Block[] = x.blocks.map((v: unknown)=>{
    if (!object(v)||!string(v.id)||ids.has(v.id)||!blockTypes.includes(v.type as BlockType)||!object(v.content)||!validContent(v.type as BlockType,v.content)||!object(v.styles)) throw new Error('模块数据无效，或存在重复 ID。');
    ids.add(v.id); const type=v.type as BlockType;
    const styles={...baseStyles};
    for (const [k,value] of Object.entries(v.styles)) {
      if (!(k in styles)) continue;
      const key=k as keyof Styles;
      if (typeof baseStyles[key]==='number') { if (typeof value!=='number'||!Number.isFinite(value)||value<0||value>1000) throw new Error('样式数值无效'); (styles as unknown as Record<string,unknown>)[k]=value; }
      else if (key==='textAlign') { if (!['left','center','right'].includes(String(value))) throw new Error('对齐方式无效'); styles.textAlign=value as Styles['textAlign']; }
      else { if (typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value)) throw new Error('颜色格式无效'); (styles as unknown as Record<string,unknown>)[k]=value; }
    }
    const content=structuredClone(v.content);
    if ('html' in content) content.html=sanitizeRich(String(content.html));
    if (type==='image'||type==='figure'||type==='scrollImage') { content.src=safeURL(String(content.src),true,true); content.local=String(content.src).startsWith('data:'); content.width=Math.min(100,Math.max(10,Number(content.width))); }
    if (type==='scrollImage'||type==='imageGallery')content.height=Math.min(800,Math.max(100,Number(content.height)));
    if (type==='imageGallery') { content.slideWidth=Math.min(100,Math.max(30,Number(content.slideWidth)));content.gap=Math.min(40,Math.max(0,Number(content.gap)));content.images=(content.images as ContentMap['imageGallery']['images']).map(i=>{const src=safeURL(i.src,true,true);return {id:i.id,src,caption:i.caption,local:src.startsWith('data:')};}); }
    return { id:v.id,type,content,styles,metadata:{createdAt:object(v.metadata)&&string(v.metadata.createdAt)?v.metadata.createdAt:new Date().toISOString()} } as Block;
  });
  return {schemaVersion:1,id:x.id,title:x.title,blocks,createdAt:x.createdAt,updatedAt:x.updatedAt};
}
export function importHTML(raw:string): Article {
  const embedded=raw.match(/<!--qusu-project:([^]*?)-->/);
  if (embedded) return parseProject(decodeURIComponent(embedded[1]));
  const html=DOMPurify.sanitize(raw,{ALLOWED_TAGS:['section','div','p','br','strong','em','b','i','a','ul','ol','li','h1','h2','h3','blockquote','img','table','tbody','tr','td','th','span'],ALLOWED_ATTR:['href','src','alt'],ALLOW_DATA_ATTR:false});
  const doc=new DOMParser().parseFromString(html,'text/html'); const a=newArticle(); a.title='导入的文章'; a.blocks=[];
  const visit=(node:Element)=>{
    if(node.tagName==='IMG') { const src=safeURL(node.getAttribute('src')||'',true,true); if(src){const b=createBlock('image');b.content={src,caption:node.getAttribute('alt')||'',width:100,local:src.startsWith('data:')};a.blocks.push(b);}return; }
    if(node.tagName==='TABLE') { const rows=Array.from(node.querySelectorAll('tr')).map(r=>Array.from(r.querySelectorAll('td,th')).map(c=>c.textContent||'')); if(rows.length&&rows[0].length){const count=Math.min(20,Math.max(...rows.map(r=>r.length))); const b=createBlock('comparisonTable'); b.content.rows=rows.slice(0,100).map(r=>Array.from({length:count},(_,i)=>r[i]||''));a.blocks.push(b);}return; }
    if(['SECTION','DIV'].includes(node.tagName)){Array.from(node.children).forEach(visit);if(!node.children.length&&node.textContent?.trim()){const b=createBlock('paragraph');b.content.html=sanitizeRich(node.innerHTML);a.blocks.push(b);}return;}
    if(node.querySelector('img')){Array.from(node.children).forEach(visit);return;}
    if(node.textContent?.trim()){const b=createBlock('paragraph');b.content.html=sanitizeRich(node.outerHTML);a.blocks.push(b);}
  };
  Array.from(doc.body.children).forEach(visit);
  if(!a.blocks.length){const text=doc.body.textContent?.trim();if(!text)throw new Error('未找到可导入的正文。');const b=createBlock('paragraph');b.content.html=sanitizeRich(doc.body.innerHTML);a.blocks=[b];}
  return a;
}
export function editableHTMLComment(a: Article): string { return `<!--qusu-project:${encodeURIComponent(JSON.stringify(a)).replace(/-/g,'%2D')}-->`; }
export function patchContent<K extends BlockType>(b: Block, type: K, patch: Partial<ContentMap[K]>): Block { if(b.type!==type)return b; return {...b,content:{...b.content,...patch}} as Block; }
