import { useEffect, useRef, useState } from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, pointerWithin, useSensor, useSensors, type DragEndEvent, type CollisionDetection } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { ArrowDownToLine, ArrowUpFromLine, Check, ChevronDown, ClipboardCheck, Code2, FileJson, Monitor, Smartphone, Eye, Undo2, Redo2, X, CheckCheck, Circle, Plus, PanelLeftClose, PanelLeftOpen, PanelRightClose } from 'lucide-react';
import { useEditorStore } from './store/editor';
import { Canvas } from './components/Canvas';
import { LeftPanel } from './components/LeftPanel';
import { Inspector } from './components/Inspector';
import { ImageViewer } from './components/ImageViewer';
import { useImageViewer } from './store/image-viewer';
import { registry } from './blocks/registry';
import type { BlockType } from './types';
import { fullHTML, localImages, plainText, serializeArticle, hasScrollableImages } from './lib/serializer';
import { scrollCompatibilityNote } from './lib/image-layout';
import { copyRich, copySource, download } from './lib/clipboard';
import { editableHTMLComment, importHTML, parseProject } from './lib/project';

const collision:CollisionDetection=args=>{const hits=pointerWithin(args);return hits.length?(hits.filter(h=>String(h.id).startsWith('gap:')).length?hits.filter(h=>String(h.id).startsWith('gap:')):hits):closestCenter(args);};
export default function App(){
  const state=useEditorStore();const [mobile,setMobile]=useState(false);const [modal,setModal]=useState<'preview'|'export'|'import'|'manual'|null>(null);const [message,setMessage]=useState('');const [importText,setImportText]=useState('');const [importError,setImportError]=useState('');const [insertion,setInsertion]=useState<number|null>(null);const [dragName,setDragName]=useState('');const [left,setLeft]=useState(true);const [right,setRight]=useState(true);const fileInput=useRef<HTMLInputElement>(null);const copyArea=useRef<HTMLDivElement>(null);const sensors=useSensors(useSensor(PointerSensor,{activationConstraint:{distance:7}}),useSensor(KeyboardSensor,{coordinateGetter:sortableKeyboardCoordinates}));
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      if(useImageViewer.getState().src||useEditorStore.getState().libraryBusy)return;
      const target=e.target as HTMLElement;
      const editing=target.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(target.tagName);
      if(e.key==='Escape')setModal(null);
      if(modal)return;
      const shortcut=e.ctrlKey||e.metaKey;
      const name=e.key.toLowerCase();
      const s=useEditorStore.getState();
      // Rich text and its controls share the same article history as the top bar.
      if(shortcut&&(name==='z'||name==='y')&&(!editing||target.closest('.rich-wrap,.color-picker,.inspector'))){
        e.preventDefault();e.stopPropagation();name==='y'||e.shiftKey?s.redo():s.undo();return;
      }
      if(editing)return;
      if(shortcut&&name==='d'&&s.selected){e.preventDefault();s.duplicate(s.selected);}
      if((e.key==='Delete'||e.key==='Backspace')&&s.selected){e.preventDefault();s.remove(s.selected);}
    };
    window.addEventListener('keydown',key,true);
    return()=>window.removeEventListener('keydown',key,true);
  },[modal]);
  useEffect(()=>{if(!message)return;const timer=setTimeout(()=>setMessage(''),6500);return()=>clearTimeout(timer);},[message]);
  const dragEnd=(e:DragEndEvent)=>{setDragName('');setInsertion(null);if(!e.over)return;const s=useEditorStore.getState();const over=String(e.over.id);let index=s.article.blocks.length;if(over.startsWith('gap:'))index=Number(over.slice(4));else{const at=s.article.blocks.findIndex(b=>b.id===over);if(at<0)return;const rect=e.active.rect.current.translated;index=at+(rect&&rect.top+rect.height/2>e.over.rect.top+e.over.rect.height/2?1:0);}const id=String(e.active.id);if(id.startsWith('library:'))s.insert(id.slice(8) as BlockType,index);else s.move(id,index);};
  const html=serializeArticle(state.article);const unresolved=localImages(state.article);const scrollImages=hasScrollableImages(state.article);
  const publishCopy=async()=>{try{const result=await copyRich(html,plainText(state.article));if(result==='manual')setModal('manual');else setMessage(`已复制富文本排版${result==='fallback'?'（兼容模式）':''}${unresolved.length?` · ${unresolved.length} 张本地图片需上传公众号并填回图片 URL`:''}${scrollImages?' · 滚动效果请手机预览确认':''}`);}catch(err){setMessage((err as Error).message);}};
  const filename=state.article.title.replace(/[<>:"/\\|?*]/g,'_');
  const importFile=async(file:File)=>{try{if(file.size>25*1024*1024)throw new Error('文件过大，请选择小于 25MB 的项目文件。');const text=await file.text();setImportText(text);setImportError('');}catch(err){setImportError((err as Error).message);}};
  if(!state.hydrated)return <div className="loading-workspace">正在恢复本地工作空间…</div>;
  return <div inert={state.libraryBusy} className={`app-shell ${!left?'hide-left':''} ${!right?'hide-right':''}`}>
    {!left&&<button className="reopen-left-sidebar" aria-label="打开左侧栏" title="打开文章、模板和模块侧栏" onClick={()=>setLeft(true)}><PanelLeftOpen size={18}/><span>文章与模板</span></button>}
    <header className="topbar"><div className="brand"><span className="brand-symbol">Q<span/></span><div><b>QUSU<span> Editor</span></b><small>RESEARCH, WELL COMPOSED.</small></div></div><div className="document-title"><input aria-label="当前文章名称" value={state.article.title} onChange={e=>state.rename(e.target.value)}/><span className={`save-state ${state.saved==='error'?'error':''}`}>{state.saved==='saved'?<CheckCheck size={12}/>:<Circle size={10}/>}<span>{state.saved==='saved'?'已自动保存':state.saved==='saving'?'保存中…':'保存失败'}</span></span></div><div className="history-buttons"><button aria-label="撤销" title="撤销 Ctrl+Z" disabled={!state.past.length} onClick={state.undo}><Undo2 size={16}/></button><button aria-label="重做" title="重做 Ctrl+Shift+Z" disabled={!state.future.length} onClick={state.redo}><Redo2 size={16}/></button></div><div className="topbar-actions"><button aria-label="导入" onClick={()=>{setImportError('');setImportText('');setModal('import');}}><ArrowUpFromLine size={14}/><span>导入</span></button><button aria-label="导出" onClick={()=>setModal('export')}><ArrowDownToLine size={14}/><span>导出</span><ChevronDown size={12}/></button><button aria-label="保存 JSON" title="保存可编辑 JSON 项目" onClick={()=>{download(`${filename}.qusu.json`,JSON.stringify(state.article,null,2),'application/json');setMessage('可编辑项目已下载');}}><FileJson size={14}/><span>保存 JSON</span></button><button className="primary-button" onClick={publishCopy}><ClipboardCheck size={14}/><span>复制公众号排版</span></button></div></header>
    <DndContext sensors={sensors} collisionDetection={collision} onDragStart={e=>{const id=String(e.active.id);setDragName(id.startsWith('library:')?registry[id.slice(8) as BlockType].name:registry[state.article.blocks.find(b=>b.id===id)!.type].name);}} onDragMove={e=>{if(!e.over){setInsertion(null);return;}const over=String(e.over.id);if(over.startsWith('gap:'))setInsertion(Number(over.slice(4)));else{const index=state.article.blocks.findIndex(b=>b.id===over);const rect=e.active.rect.current.translated;setInsertion(index+(rect&&rect.top+rect.height/2>e.over.rect.top+e.over.rect.height/2?1:0));}}} onDragEnd={dragEnd} onDragCancel={()=>{setDragName('');setInsertion(null);}}>
      <LeftPanel onClose={()=>setLeft(false)}/>
      <main className="workspace"><div className="workspace-toolbar"><div className="workspace-title"><span className="status-dot"/><strong>文章画布</strong><span className="workspace-subtitle"> / {state.article.blocks.length} 个模块</span></div><div className="workspace-controls"><button aria-label="切换左侧栏" title="切换文章、模板与模块侧栏" onClick={()=>setLeft(!left)} className={!left?'active':''}><PanelLeftClose size={15}/></button><div className="view-switch"><button aria-label="桌面视图" className={!mobile?'active':''} onClick={()=>setMobile(false)}><Monitor size={14}/><span>桌面</span></button><button aria-label="手机视图" className={mobile?'active':''} onClick={()=>setMobile(true)}><Smartphone size={14}/><span>手机</span></button></div><button onClick={()=>setModal('preview')}><Eye size={14}/><span>预览</span></button><button title="切换属性面板" onClick={()=>setRight(!right)} className={!right?'active':''}><PanelRightClose size={15}/></button></div></div><div className="canvas-scroll" onClick={e=>{if(e.target===e.currentTarget)state.select(null);}}><div className="canvas-meta"><span>WECHAT ARTICLE</span><span>{mobile?'375':'677'} PX <span className="meta-divider">·</span> {mobile?'移动端':'桌面端'}视图</span></div><Canvas mobile={mobile} insertion={insertion}/><div className="canvas-end"><span/><span>每一个观点，都值得被清晰表达。</span><span/></div></div><footer className="workspace-footer"><span><span className="status-dot"/>本地工作空间</span><span>{plainText(state.article).replace(/\s/g,'').length} 字 <span className="meta-divider">·</span> 自动保存已开启</span><button onClick={()=>void state.createArticle()}><Plus size={12}/>新建文章</button></footer></main>
      <Inspector/><DragOverlay>{dragName&&<div className="drag-preview"><Plus size={16}/>{dragName}<small>拖放至目标位置</small></div>}</DragOverlay>
    </DndContext>
    {(state.error||message)&&<div className={`toast ${state.error?'error':''}`} role="status"><Check size={16}/>{message||state.error}<button aria-label="关闭消息" onClick={()=>{setMessage('');useEditorStore.setState({error:''});}}><X size={13}/></button></div>}
    {modal&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(null);}}><section role="dialog" aria-modal="true" aria-label={modal==='import'?'导入文章':modal==='export'?'导出文章':'文章预览'} className={`modal ${modal==='preview'||modal==='manual'?'preview-modal':''}`}>
      <div className="modal-header"><div><h2>{modal==='preview'?'文章预览':modal==='import'?'导入文章':modal==='manual'?'手动复制富文本':'导出你的研究文章'}</h2><p>{modal==='import'?'支持 QUSU JSON、可编辑 HTML 和外部 HTML':modal==='preview'?'使用微信序列化器呈现最终排版':modal==='manual'?'浏览器未允许自动复制，请选中下方文章后按 Ctrl+C':'保留排版，让研究观点被准确传递。'}</p></div><button aria-label="关闭弹窗" onClick={()=>setModal(null)}><X size={20}/></button></div>
      {modal==='import'&&<div className="modal-body"><input hidden ref={fileInput} type="file" accept=".json,.html,.htm,text/html,application/json" onChange={e=>{if(e.target.files?.[0])void importFile(e.target.files[0]);e.target.value='';}}/><button className="file-drop" onClick={()=>fileInput.current?.click()}><ArrowUpFromLine size={26}/><b>选择 HTML / JSON 文件</b><small>或在下方粘贴 HTML 源码</small></button><textarea className="import-text" aria-label="导入 HTML 或 JSON" placeholder="粘贴 HTML 或 JSON…" value={importText} onChange={e=>setImportText(e.target.value)}/>{importError&&<p className="error-text" role="alert">{importError}</p>}<p className="property-note">导入将替换画布，可撤销恢复。外部 HTML 会进行安全清理，原有样式不保证完整保留。</p><button className="primary-button" disabled={!importText.trim()} onClick={()=>{try{const text=importText.trim();state.replace(text.startsWith('{')?parseProject(text):importHTML(text));setModal(null);setMessage('文章已导入，可继续编辑');}catch(error){setImportError((error as Error).message);}}}>导入并编辑</button></div>}
      {modal==='export'&&<div className="modal-body export-options">
        {scrollImages&&<div className="image-warning"><b>文章包含滚动图片</b><p>{scrollCompatibilityNote}</p></div>}
        {unresolved.length>0&&<div className="image-warning"><b>{unresolved.length} 张本地图片尚未上传公众号</b><p>灰框只是文字占位，公众号没有针对它的图片替换按钮。普通图片：删除占位框后，在公众号重新插入图片。滚动相册：先在公众号上传图片，将素材图片 URL 填回本编辑器的相册图片 URL，再重新复制排版。</p></div>}
        <button onClick={publishCopy}><ClipboardCheck/><span><b>复制富文本排版</b><small>直接粘贴到微信公众号编辑器</small></span></button>
        <button onClick={async()=>{try{await copySource(html);setMessage('已复制 HTML 源码（普通文本）');}catch(error){setMessage((error as Error).message);}}}><Code2/><span><b>复制 HTML 源码</b><small>用于开发、查看或存档，复制的是代码</small></span></button>
        <button onClick={()=>{download(`${filename}.html`,fullHTML(state.article),'text/html;charset=utf-8');setMessage('微信发布版 HTML 已下载');}}><ArrowDownToLine/><span><b>下载微信发布版 HTML</b><small>纯净内联样式，包含 UTF-8 文件头</small></span></button>
        <button onClick={()=>{download(`${filename}.editable.html`,fullHTML(state.article)+editableHTMLComment(state.article),'text/html;charset=utf-8');setMessage('可编辑 HTML 已下载，可再次导入');}}><ArrowDownToLine/><span><b>下载可编辑 HTML</b><small>带项目恢复信息，支持无损重新导入</small></span></button>
        <button onClick={()=>download(`${filename}.qusu.json`,JSON.stringify(state.article,null,2),'application/json')}><FileJson/><span><b>保存 JSON 项目</b><small>保留模块、样式与本地图片 · schema v1</small></span></button>
        <p className="property-note">公众号后台可能调整部分样式及外链图片，请粘贴后检查并使用素材库图片。可编辑 HTML 的恢复信息仅用于本工具，发布请使用微信发布版。</p>
      </div>}
      {(modal==='preview'||modal==='manual')&&<><div className="preview-actions"><div className="view-switch"><button className={!mobile?'active':''} onClick={()=>setMobile(false)}><Monitor size={14}/>桌面</button><button className={mobile?'active':''} onClick={()=>setMobile(true)}><Smartphone size={14}/>手机</button></div>{modal==='manual'&&<button className="primary-button" onClick={()=>{if(copyArea.current){const range=document.createRange();range.selectNodeContents(copyArea.current);const sel=window.getSelection();sel?.removeAllRanges();sel?.addRange(range);setMessage('已选中排版文章，请按 Ctrl+C 复制富文本');}}}>选中全部排版</button>}</div><div className="preview-scroll"><div ref={copyArea} className={`preview-article ${mobile?'mobile':''}`} onClick={e=>{const anchor=(e.target as HTMLElement).closest('a[title="点击查看完整原图"]');const img=anchor?.querySelector('img');if(img){e.preventDefault();useImageViewer.getState().open(img.getAttribute('src')||'',img.alt);}}} dangerouslySetInnerHTML={{__html:serializeArticle(state.article,modal==='preview')}}/></div></>}
    </section></div>}
    <ImageViewer/>
  </div>;
}
