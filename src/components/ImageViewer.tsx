import { useEffect, useRef } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';
import { useState } from 'react';
import { useImageViewer } from '../store/image-viewer';

export function ImageViewer(){
  const {src,caption,close}=useImageViewer();
  const dialog=useRef<HTMLDialogElement>(null);
  const [zoom,setZoom]=useState(false);
  useEffect(()=>{setZoom(false);const node=dialog.current;if(src&&!node?.open)node?.showModal();if(!src&&node?.open)node.close();},[src]);
  return <dialog ref={dialog} className="original-image-dialog" aria-label="查看完整原图" onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===e.currentTarget)close();}}>
    <div className="original-image-header"><div><b>完整原图</b><small>滑动预览的裁剪不会改变原始图片</small></div><button aria-label={zoom?'适应窗口':'放大查看'} onClick={()=>setZoom(!zoom)}>{zoom?<ZoomOut size={18}/>:<ZoomIn size={18}/>}</button><button aria-label="关闭原图" onClick={close}><X size={20}/></button></div>
    <div className={`original-image-content ${zoom?'zoomed':''}`}>{src&&<img src={src} alt={caption||'完整原图'}/>}</div>
    {caption&&<p className="original-image-caption">{caption}</p>}
  </dialog>;
}
