import type { ImageAsset } from '../types';
export function mergeGalleryUploads(existing:ImageAsset[],uploaded:ImageAsset[]):ImageAsset[]{
  const remaining=[...uploaded];
  const filled=existing.map(item=>{if(item.src||!remaining.length)return item;const next=remaining.shift()!;return {...next,id:item.id,caption:item.caption||next.caption};});
  const images=[...filled,...remaining];
  if(images.length>20)throw new Error('每个相册最多 20 张图片。');
  return images;
}
