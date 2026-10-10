import { useRef } from 'react';
import { nanoid } from 'nanoid';
import { ImagePlus, ArrowDown, ArrowLeft, ArrowRight, Expand } from 'lucide-react';
import type { BlockOf } from '../types';
import { useEditorStore } from '../store/editor';
import { Inline } from '../components/Inline';
import { imageAccept, readImage } from '../lib/images';
import { safeURL } from '../lib/sanitize';
import { galleryImage, galleryFrame, galleryWidth, galleryGap, gallerySlide, horizontalViewport, squareImageFrame, verticalViewport } from '../lib/image-layout';
import { mergeGalleryUploads } from '../lib/gallery';
import { useImageViewer } from '../store/image-viewer';

export function ScrollImageView({b}:{b:BlockOf<'scrollImage'>}){
  const update=useEditorStore(s=>s.content);const src=safeURL(b.content.src,true,true);
  return <><div style={{width:`${b.content.width}%`,margin:'0 auto'}}>
    <div style={squareImageFrame()}>{src?<div className="long-image-viewport" aria-label="长图滚动区域" role="region" tabIndex={0} style={verticalViewport()}><img src={src} alt={b.content.caption||'上下滑动查看长图'} style={{display:'block',width:'100%',height:'auto'}} draggable={false}/></div>:<label className="image-upload long-image-empty" style={{...verticalViewport(),minHeight:0}}><input aria-label="上传长图" type="file" accept={imageAccept} onChange={async e=>{const f=e.target.files?.[0];if(!f)return;try{update(b.id,b.type,{src:await readImage(f),local:true},true);}catch(error){window.alert((error as Error).message);}e.target.value='';}}/><span><ImagePlus size={26}/><b>上传单张长图</b><small>1:1 正方形窗口 · 上下滑动查看完整内容</small><ArrowDown size={16}/></span></label>}</div>
    {b.content.showHint&&<p className="scroll-image-hint"><ArrowDown size={12}/>在图片内上下滑动，查看完整长图</p>}
  </div>{b.content.local&&<div className="local-image-badge">本地预览 · 发布前请上传公众号并填回图片 URL</div>}<div style={{fontSize:12,color:'#78828E',marginTop:8}}><Inline label="长图说明" multiline value={b.content.caption} onChange={caption=>update(b.id,b.type,{caption})}/></div></>;
}

export function ImageGalleryView({b}:{b:BlockOf<'imageGallery'>}){
  const update=useEditorStore(s=>s.content);const viewport=useRef<HTMLDivElement>(null);
  const move=(direction:number)=>viewport.current?.scrollBy({left:direction*(viewport.current.clientWidth*(galleryWidth/100)+galleryGap),behavior:'smooth'});
  return <><div className="gallery-shell"><div ref={viewport} className="gallery-viewport" style={horizontalViewport()} role="region" aria-label="多图横向滑动区域" tabIndex={0}>{b.content.images.map((image,index)=>{
    const src=safeURL(image.src,true,true);
    return <div key={image.id} className="gallery-slide" style={gallerySlide(index===b.content.images.length-1)}>
      <div className="gallery-image-frame" style={galleryFrame()}>
        {src&&<button className="gallery-open-original" aria-label={`查看相册图片 ${index+1} 原图`} onClick={()=>useImageViewer.getState().open(src,image.caption||`相册图片 ${index+1}`)}><img src={src} alt={image.caption||`相册图片 ${index+1}`} draggable={false} style={galleryImage()}/><span className="gallery-expand"><Expand size={14}/>查看原图</span></button>}
        <label className={`image-upload gallery-upload ${src?'gallery-replace':'gallery-empty'}`} title={`上传或替换相册图片 ${index+1}`}><input aria-label={`上传相册图片 ${index+1}`} type="file" accept={imageAccept} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{const src=await readImage(file);const latest=useEditorStore.getState().article.blocks.find(x=>x.id===b.id);if(latest?.type==='imageGallery')update(b.id,b.type,{images:latest.content.images.map(x=>x.id===image.id?{...x,src,local:true}:x)},true);}catch(error){window.alert((error as Error).message);}e.target.value='';}}/>{src?<><ImagePlus size={13}/>替换</>:<span><ImagePlus size={24}/><b>图片 {index+1}</b><small>点击上传 · 1:1 预览</small></span>}</label>
      </div>
      <div className="gallery-caption"><Inline label={`相册图片 ${index+1} 说明`} value={image.caption} multiline onChange={caption=>update(b.id,b.type,{images:b.content.images.map(x=>x.id===image.id?{...x,caption}:x)})}/></div>
    </div>;
  })}</div>{b.content.images.length>1&&<div className="gallery-navigation"><button aria-label="相册向左滑动" onClick={()=>move(-1)}><ArrowLeft size={14}/></button><button aria-label="相册向右滑动" onClick={()=>move(1)}><ArrowRight size={14}/></button></div>}</div>
  {b.content.showHint&&<p className="scroll-image-hint"><ArrowLeft size={12}/>左右滑动预览 · 点击查看完整原图（{b.content.images.length} 张）<ArrowRight size={12}/></p>}
  <label className="gallery-add upload-button"><ImagePlus size={14}/>批量添加图片<input aria-label="批量添加相册图片" type="file" multiple accept={imageAccept} onChange={async e=>{const files=Array.from(e.target.files||[]);if(!files.length)return;try{if(b.content.images.filter(i=>!!i.src).length+files.length>20)throw new Error('每个相册最多 20 张图片。');const assets=await Promise.all(files.map(async f=>({id:nanoid(),src:await readImage(f),local:true,caption:''})));const latest=useEditorStore.getState().article.blocks.find(x=>x.id===b.id);if(latest?.type==='imageGallery')update(b.id,b.type,{images:mergeGalleryUploads(latest.content.images,assets)},true);}catch(error){window.alert((error as Error).message);}e.target.value='';}}/></label>
  {b.content.images.some(i=>i.local)&&<div className="local-image-badge">本地预览 · 发布前请上传公众号并填回图片 URL</div>}<div style={{fontSize:12,color:'#78828E',marginTop:8}}><Inline label="相册整体说明" value={b.content.caption} multiline onChange={caption=>update(b.id,b.type,{caption})}/></div></>;
}

