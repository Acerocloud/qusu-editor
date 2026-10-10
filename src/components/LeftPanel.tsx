import { useEffect, useState } from 'react';
import { FileText, LayoutTemplate, Blocks, Plus, Save, Search, PanelLeftClose, Trash2 } from 'lucide-react';
import { Library } from './Library';
import { useEditorStore } from '../store/editor';
export function LeftPanel({onClose}:{onClose:()=>void}){
  const state=useEditorStore();
  const [tab,setTab]=useState<'articles'|'templates'|'modules'>('articles');
  const [search,setSearch]=useState('');const [name,setName]=useState('');
  useEffect(()=>{setTab(state.activeMode==='template'?'templates':'articles');setSearch('');},[state.activeMode]);
  const live=(records:typeof state.articles,mode:'article'|'template')=>records.map(a=>state.activeMode===mode&&a.id===state.article.id?state.article:a).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  const articles=live(state.articles,'article');
  const templates=live(state.templates,'template');
  if(state.activeMode==='template'&&!templates.some(a=>a.id===state.article.id))templates.unshift(state.article);
  const entries=(tab==='articles'?articles:templates).filter(a=>a.title.toLowerCase().includes(search.toLowerCase()));
  return <aside className="left-panel" aria-label="文章和模板侧栏">
    <div className="collection-heading"><strong>我的工作空间</strong><button aria-label="收起左侧栏" title="收起左侧栏" onClick={onClose}><PanelLeftClose size={16}/></button></div>
    <div className="collection-tabs" role="tablist" aria-label="工作空间分类">
      {([['articles','文章',FileText],['templates','模板',LayoutTemplate],['modules','模块',Blocks]] as const).map(([key,label,Icon])=><button key={key} role="tab" disabled={key==='modules'&&state.activeMode==='empty'} aria-selected={tab===key} onClick={()=>{setTab(key);setSearch('');}}><Icon size={14}/>{label}</button>)}
    </div>
    {tab==='modules'?<Library/>:<>
      <div className="collection-tools">
        {tab==='articles'?<><button className="primary-button" onClick={()=>void state.createArticle()}><Plus size={14}/>新建文章</button><button className="collection-save" disabled={state.activeMode!=='article'} onClick={()=>void state.saveArticle()}><Save size={14}/>保存当前文章</button></>:<>
          <button className="primary-button" onClick={()=>void state.createTemplate()}><Plus size={14}/>新建模板</button>
          {state.activeMode==='article'&&<form onSubmit={e=>{e.preventDefault();void state.articleToTemplate(name);setName('');}}><label htmlFor="template-name">将当前文章保存为模板</label><input id="template-name" aria-label="模板名称" placeholder="给模板起个名字" maxLength={100} value={name} onChange={e=>setName(e.target.value)}/><button className="collection-save" disabled={!name.trim()}><LayoutTemplate size={14}/>进入模板编辑</button></form>}
        </>}
        <div className="collection-search"><Search size={14}/><input aria-label={tab==='articles'?'搜索文章':'搜索模板'} placeholder={tab==='articles'?'搜索文章…':'搜索模板…'} value={search} onChange={e=>setSearch(e.target.value)}/></div>
      </div>
      <div className="collection-list" aria-label={tab==='articles'?'已保存文章':'已保存模板'}>
        {entries.map(a=>{const current=state.activeMode===(tab==='articles'?'article':'template')&&a.id===state.article.id;return <div key={a.id} className={`collection-card collection-row ${current?'active':''}`}>
          <button className="collection-open" aria-label={tab==='articles'?`打开文章：${a.title}`:`打开模板：${a.title}`} aria-current={current?'page':undefined} onClick={()=>void (tab==='articles'?state.openArticle(a.id):state.openTemplate(a.id))}>
            <span className="collection-card-title">{tab==='articles'?<FileText size={15}/>:<LayoutTemplate size={15}/>}<b>{a.title||'未命名文档'}</b></span>
            <small>{a.blocks.length} 个模块 · {new Date(a.updatedAt).toLocaleDateString('zh-CN')}</small>
            <span className="collection-card-hint">{current?(tab==='articles'?'正在编辑':'正在编辑模板'):'点击继续编辑'}</span>
          </button>
          {tab==='articles'&&<button className="collection-delete" title="删除文章" aria-label={`删除文章：${a.title}`} onClick={e=>{e.stopPropagation();if(window.confirm(`删除文章「${a.title||'未命名文章'}」？此操作无法撤销。`))void state.deleteArticle(a.id);}}><Trash2 size={15}/></button>}
        </div>;})}
        {!entries.length&&<p className="collection-empty">{search?'没有找到匹配的内容':tab==='templates'?'还没有模板。点击新建模板开始排版。':'还没有文章。点击上方新建文章。'}</p>}
      </div>
      <p className="collection-foot">{tab==='articles'?'文章分开保存在当前浏览器 · 建议定期导出 JSON':'点击模板进入独立编辑 · 确认排版后保存模板'}</p>
    </>}
  </aside>;
}