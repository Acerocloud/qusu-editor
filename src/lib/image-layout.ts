import type { CSSProperties } from 'react';
import type { Block, ImageAsset } from '../types';
// These values are shared by the editable canvas and standalone HTML serializer.
export function squareImageFrame(): CSSProperties { return { width: '100%' }; }
// Keep the image in normal flow: removing unsupported layout styles should
// reveal the full image rather than leave it inside a zero-height container.
export function verticalViewport(): CSSProperties { return { width: '100%', aspectRatio: '1 / 1', minHeight: 0, boxSizing: 'border-box', overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', border: '1px solid #D8DEE7', backgroundColor: '#F4F6F9' }; }
export const galleryWidth = 92;
export const galleryGap = 12;
export function horizontalViewport(): CSSProperties { return { width: '100%', overflowX: 'auto', overflowY: 'hidden', whiteSpace: 'nowrap', WebkitOverflowScrolling: 'touch', scrollSnapType: 'x mandatory' }; }
export function gallerySlide(last = false): CSSProperties { return { display: 'inline-block', verticalAlign: 'top', width: `${galleryWidth}%`, marginRight: `${last ? 0 : galleryGap}px`, whiteSpace: 'normal', scrollSnapAlign: 'start' }; }
export function galleryFrame(): CSSProperties { return { position: 'relative', width: '100%', height: 0, paddingBottom: '100%', overflow: 'hidden', backgroundColor: '#F4F6F9' }; }
export function galleryImage(): CSSProperties { return { position: 'absolute', top: 0, left: 0, display: 'block', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }; }
export function inlineCSS(styles: CSSProperties): string { return Object.entries(styles).map(([key,value])=>`${key.replace(/[A-Z]/g,c=>`-${c.toLowerCase()}`)}:${value};`).join(''); }
export function blockImages(block: Block): Pick<ImageAsset,'src'|'caption'|'local'>[] {
  if(block.type==='imageGallery') return block.content.images;
  if(block.type==='image'||block.type==='figure'||block.type==='scrollImage')return [block.content];
  return [];
}
export const scrollCompatibilityNote = '公众号保存会重新处理结构和样式，后台能滑动不代表手机端也能滑动。请保存草稿后重新打开，并发送手机预览确认。本地图片需先上传公众号，再将素材图片 URL 填回右侧面板后重新复制排版。';
