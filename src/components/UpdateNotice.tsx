import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, Download, X } from 'lucide-react';
import { prepareForUpdate, useEditorStore } from '../store/editor';
import { imagesAreLoading } from '../lib/images';

type UpdateStatus={current:string;latest?:string;phase:string;progress:number;token:string;error?:string;postponed:boolean;waiting?:number};
async function request(path:string,options?:RequestInit){
  const abort=new AbortController();const timer=setTimeout(()=>abort.abort(),path.endsWith('/check')?70000:4000);
  try{const response=await fetch(path,{...options,signal:abort.signal});if(!response.ok)throw new Error('更新服务暂不可用');return await response.json() as UpdateStatus;}
  finally{clearTimeout(timer);}
}
export function UpdateNotice(){
  const [status,setStatus]=useState<UpdateStatus>();const [saveError,setSaveError]=useState(false);const [manual,setManual]=useState(false);
  const [modal,setModal]=useState(false);const [checkingRequest,setCheckingRequest]=useState(false);const [requestError,setRequestError]=useState('');
  const dialog=useRef<HTMLDialogElement>(null);const trayChecked=useRef(false);
  const session=useRef({id:Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join(''),version:'',prepared:false,failed:false,composing:false,checking:false,disposed:false,status:undefined as UpdateStatus|undefined});
  const post=async(action:string,body:object={})=>{const current=session.current.status;if(!current)throw new Error('更新服务暂不可用');return request(`/.qusu-update/${action}`,{method:'POST',headers:{'Content-Type':'application/json','X-QUSU-Token':current.token},body:JSON.stringify(body)});};
  const checkUpdates=async()=>{
    setModal(true);setManual(true);setRequestError('');setCheckingRequest(true);
    try{const next=await post('check');session.current.status=next;setStatus(next);}
    catch{setRequestError('检查更新失败，请检查网络后重试。');}
    finally{setCheckingRequest(false);}
  };
  useEffect(()=>{if(modal&&!dialog.current?.open)dialog.current?.showModal();},[modal]);
  useEffect(()=>{
    if(!status||trayChecked.current)return;trayChecked.current=true;
    const url=new URL(window.location.href);
    if(url.searchParams.get('checkUpdate')==='1'){
      url.searchParams.delete('checkUpdate');history.replaceState(null,'',url);
      void checkUpdates();
    }
  },[status]);
  useEffect(()=>{
    const current=session.current;current.disposed=false;
    const compositionStart=()=>{current.composing=true;};const compositionEnd=()=>{current.composing=false;};
    document.addEventListener('compositionstart',compositionStart,true);document.addEventListener('compositionend',compositionEnd,true);
    const poll=async()=>{
      if(current.checking||current.disposed)return;current.checking=true;
      try{
        const next=await request('/.qusu-update');if(!next.current||!next.token||current.disposed)return;
        current.status=next;setStatus(next);if(!current.version)current.version=next.current;
        const restarted=current.version!==next.current;
        const preparing=restarted||next.phase==='ready'&&!next.postponed;
        if(preparing&&!current.prepared&&!current.failed){
          const editor=useEditorStore.getState();
          if(!current.composing&&!imagesAreLoading()&&!document.querySelector('[role="dialog"]')&&editor.hydrated&&!editor.libraryBusy){
            (document.activeElement as HTMLElement|null)?.blur();await Promise.resolve();
            current.prepared=await prepareForUpdate();current.failed=!current.prepared;setSaveError(current.failed);
          }
        }
        if(restarted&&current.prepared){const editor=useEditorStore.getState();try{sessionStorage.setItem('qusu-update-selection',JSON.stringify({mode:editor.activeMode,id:editor.article.id}));}catch{/* Document contents remain in IndexedDB. */}window.location.reload();return;}
        if(!preparing&&current.prepared&&next.phase!=='installing'){
          current.prepared=false;useEditorStore.setState({updating:false});
        }
        await post('client',{id:current.id,ready:current.prepared});
      }catch{/* The native service briefly restarts during an update; keep the loaded editor and its contents. */}
      finally{current.checking=false;}
    };
    void poll();const timer=setInterval(()=>void poll(),1500);
    return()=>{current.disposed=true;clearInterval(timer);document.removeEventListener('compositionstart',compositionStart,true);document.removeEventListener('compositionend',compositionEnd,true);};
  },[]);
  if(!status)return null;
  const retry=async()=>{session.current.failed=false;setSaveError(false);setManual(true);if(status.phase==='ready')return;await checkUpdates();};
  const install=async()=>{
    setRequestError('');
    try{const next=await post('install');session.current.status=next;setStatus(next);setModal(false);session.current.failed=false;setSaveError(false);}
    catch{setRequestError('无法开始更新，请重新检查后重试。');}
  };
  const postpone=async()=>{try{setStatus(await post('postpone'));session.current.prepared=false;useEditorStore.setState({updating:false});}catch{/* Keep the pending update visible for a later retry. */}};
  const resume=async()=>{try{setStatus(await post('resume'));session.current.failed=false;setSaveError(false);}catch{/* Retry remains available. */}};
  const checking=checkingRequest||status.phase==='checking';
  const show=saveError||['available','ready','installing','downloading'].includes(status.phase)||status.phase==='error'&&(manual||!!status.latest&&status.latest!==status.current);
  return <><span className="native-version"><span>v{status.current}</span><button aria-label="检查更新" disabled={checking||status.phase==='installing'} onClick={()=>void checkUpdates()}><RefreshCw size={11}/>{checking?'检查中…':status.phase==='error'?'更新重试':'检查更新'}</button></span>{show&&createPortal(<aside className={`update-notice ${saveError||status.phase==='error'?'update-error':''}`} role="status" aria-label="软件自动更新"><Download size={18}/><div><strong>{saveError?'当前内容保存失败，已暂停自动升级':status.phase==='error'?'更新未完成':status.phase==='available'?`发现新版本 v${status.latest}`:status.phase==='downloading'?`正在下载 v${status.latest} · ${Math.min(status.progress,100)}%`:status.phase==='installing'?'正在升级，完成后自动恢复编辑器':status.postponed?'新版已下载，已推迟一小时':session.current.prepared&&(status.waiting||0)>0?'已保存，等待其他编辑窗口保存后升级':`v${status.latest} 已就绪，正在保存并自动升级`}</strong><small>{saveError?'当前内容已保留，可导出 JSON 备份后重试。':status.error||'文章、模板草稿和本地图片保留在当前浏览器。'}</small></div>{status.phase==='available'?<button onClick={()=>{setRequestError('');setModal(true);}}>查看更新</button>:saveError||status.phase==='error'?<button onClick={()=>void retry()}>重试</button>:status.phase==='ready'&&<button onClick={()=>void(status.postponed?resume():postpone())}>{status.postponed?'立即升级':'稍后升级'}</button>}</aside>,document.body)}{modal&&createPortal(<dialog ref={dialog} className="update-dialog" aria-labelledby="update-dialog-title" onCancel={()=>setModal(false)} onClose={()=>setModal(false)}>
    <header><h2 id="update-dialog-title">软件更新</h2><button aria-label="关闭更新弹窗" onClick={()=>setModal(false)}><X size={18}/></button></header>
    <div className="update-dialog-content" role="status">
      <strong>{requestError?'检查更新失败':checking?'正在检查更新…':status.phase==='current'?'已是最新版本':status.phase==='available'?'发现新版本':status.phase==='error'?'更新未完成':status.phase==='downloading'?'正在下载更新':status.phase==='ready'?'更新已就绪':status.phase==='installing'?'正在安装更新':'检查软件更新'}</strong>
      <p>当前版本：v{status.current}</p>
      {!checking&&status.latest&&<p>最新版本：v{status.latest}</p>}
      {(requestError||status.phase==='error')&&<p className="update-dialog-error">{requestError||status.error}</p>}
      {status.phase==='available'&&!checking&&<p>是否立即更新？确认后将下载新版，保存所有编辑窗口的内容并重启。</p>}
    </div>
    <footer>{(requestError||status.phase==='error')&&<a href="https://github.com/Acerocloud/qusu-editor/releases/latest" target="_blank" rel="noopener noreferrer">手动下载安装</a>}<button onClick={()=>setModal(false)}>{!checking&&status.phase==='available'?'暂不更新':'关闭'}</button>{!checking&&status.phase==='available'&&!requestError?<button className="update-dialog-primary" onClick={()=>void install()}>立即更新</button>:!checking&&(requestError||status.phase==='error')?<button className="update-dialog-primary" onClick={()=>void checkUpdates()}>重新检查</button>:null}</footer>
  </dialog>,document.body)}</>;
}
