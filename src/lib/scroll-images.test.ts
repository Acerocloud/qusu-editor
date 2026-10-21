import { describe,it,expect } from 'vitest';
import { createBlock } from '../blocks/registry';
import { newArticle,parseProject,importHTML,editableHTMLComment } from './project';
import { serializeBlock,serializeArticle,fullHTML,localImages } from './serializer';
import { mergeGalleryUploads } from './gallery';
const data='data:image/png;base64,AAAA';
describe('scrolling image modules',()=>{
  it('exports constrained vertical and horizontal scroll regions with inline styles',()=>{
    const long=createBlock('scrollImage');long.content.src='https://example.com/long.png';long.content.height=280;
    const html=serializeBlock(long);expect(html).toContain('aspect-ratio:1 / 1');expect(html).not.toMatch(/position:absolute|(?:[";])height:0(?:px)?;/);expect(html).not.toContain('height:280px');expect(html).toContain('overflow-y:auto');expect(html).toContain('width:100%;height:auto');expect(html).toContain('-webkit-overflow-scrolling:touch');
    const gallery=createBlock('imageGallery');gallery.content.images=gallery.content.images.map((i,index)=>({...i,src:`https://example.com/${index}.png`,caption:`图 ${index+1}`}));gallery.content.slideWidth=80;
    const output=serializeBlock(gallery);expect(output).toContain('overflow-x:auto');expect(output).toContain('white-space:nowrap');expect(output).toContain('display:inline-block');expect(output).toContain('width:92%');expect(output).not.toContain('width:80%');expect(output).toContain('width:100%;height:auto');expect(output).not.toMatch(/padding-bottom:100%|object-fit:cover|position:absolute|(?:[";])height:0(?:px)?;/);expect(output).toContain('href="https://example.com/0.png"');expect(output).not.toMatch(/<button|input|class=|display:flex|display:grid|<script/);
  });
  it('roundtrips both modules and sanitizes every gallery URL',()=>{
    const a=newArticle();const long=createBlock('scrollImage');long.content.src=data;long.content.local=true;const gallery=createBlock('imageGallery');gallery.content.images[0]={...gallery.content.images[0],src:data,local:true};a.blocks=[long,gallery];
    expect(parseProject(JSON.stringify(a))).toEqual(a);expect(importHTML(fullHTML(a)+editableHTMLComment(a))).toEqual(a);
    gallery.content.images[1].src='javascript:alert(1)';const parsed=parseProject(JSON.stringify(a));const b=parsed.blocks[1];if(b.type==='imageGallery')expect(b.content.images[1].src).toBe('');
  });
  it('counts local gallery images individually and publishes no local data or blob URLs',()=>{
    const a=newArticle();const long=createBlock('scrollImage');long.content.src=data;long.content.local=true;const gallery=createBlock('imageGallery');gallery.content.images=gallery.content.images.map(i=>({...i,src:data,local:true}));a.blocks=[long,gallery];expect(localImages(a)).toHaveLength(3);expect(serializeArticle(a)).not.toMatch(/data:image|blob:/);expect(serializeArticle(a,true).match(/<img/g)).toHaveLength(3);
  });
  it('rejects malformed or duplicate gallery entries and bounds dimensions',()=>{
    const a={...newArticle(),blocks:[createBlock('imageGallery')]};a.blocks[0].content.images[1].id=a.blocks[0].content.images[0].id;expect(()=>parseProject(JSON.stringify(a))).toThrow();a.blocks[0]=createBlock('imageGallery');a.blocks[0].content.height=99999;a.blocks[0].content.slideWidth=-1;a.blocks[0].content.gap=999;const b=parseProject(JSON.stringify(a)).blocks[0];if(b.type==='imageGallery'){expect(b.content.height).toBe(800);expect(b.content.slideWidth).toBe(30);expect(b.content.gap).toBe(40);}
  });
  it('fills empty positions on bulk upload and preserves stable IDs',()=>{
    const slots=createBlock('imageGallery').content.images;const uploads=Array.from({length:3},(_,i)=>({id:`upload${i}`,src:data,local:true,caption:`图${i}`}));const merged=mergeGalleryUploads(slots,uploads);expect(merged).toHaveLength(3);expect(merged[0].id).toBe(slots[0].id);expect(merged[2].id).toBe('upload2');expect(()=>mergeGalleryUploads(Array.from({length:20},()=>uploads[0]),uploads)).toThrow();
  });
});
