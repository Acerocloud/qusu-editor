export async function copyRich(html:string,text:string):Promise<'api'|'fallback'|'manual'> {
  try { if(navigator.clipboard?.write && typeof ClipboardItem!=='undefined'){await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([text],{type:'text/plain'})})]);return 'api';} } catch { /* Try the synchronous copy event fallback. */ }
  const focused=document.activeElement as HTMLElement|null;const selection=window.getSelection();const ranges=selection?Array.from({length:selection.rangeCount},(_,i)=>selection.getRangeAt(i).cloneRange()):[];
  const area=document.createElement('div');area.contentEditable='true';area.innerHTML=html;area.style.cssText='position:fixed;left:-9999px;top:0;';document.body.append(area);const range=document.createRange();range.selectNodeContents(area);selection?.removeAllRanges();selection?.addRange(range);let written=false;
  const listener=(event:ClipboardEvent)=>{if(event.clipboardData){event.clipboardData.setData('text/html',html);event.clipboardData.setData('text/plain',text);event.preventDefault();written=true;}};
  document.addEventListener('copy',listener);let ok=false;
  try {ok=document.execCommand('copy');}catch{ok=false;}finally{document.removeEventListener('copy',listener);area.remove();selection?.removeAllRanges();ranges.forEach(r=>selection?.addRange(r));focused?.focus();}
  return ok&&written?'fallback':'manual';
}
export async function copySource(text:string){if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return;}const input=document.createElement('textarea');input.value=text;document.body.append(input);input.select();const ok=document.execCommand('copy');input.remove();if(!ok)throw new Error('浏览器不允许复制源码，请下载 HTML 文件。');}
export function download(name:string,content:string,type:string){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
