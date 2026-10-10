import { useState } from 'react';
import { FileText, LayoutTemplate, Blocks, Plus, Save, Search, PanelLeftClose } from 'lucide-react';
import { Library } from './Library';
import { useEditorStore } from '../store/editor';
export function LeftPanel({onClose}:{onClose:()=>void}){
  const state=useEditorStore();
  const [tab,setTab]=useState<'articles'|'templates'|'modules'>('articles');
  const [search,setSearch]=useState('');
  const [name,setName]=useState('');
  const [notice,setNotice]=useState('');
  const articles=state.articles.map(a=>a.id===state.article.id?state.article:a).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  const entries=(tab==='articles'?articles:state.templates).filter(a=>a.title.toLowerCase().includes(search.toLowerCase()));
  const saveTemplate=async()=>{await state.saveTemplate(name);if(useEditorStore.getState().saved==='saved'){setName('');setNotice('模板已保存，可从下方新建文章');}};
  return <aside className="left-panel" aria-label="文章和模板侧栏">
    <div className="collection-heading"><strong>我的工作空间</strong><button aria-label="收起左侧栏" title="收起左侧栏" onClick={onClose}><PanelLeftClose size={16}/></button></div>
    <div className="collection-tabs" role="tablist" aria-label="工作空间分类">
      {([['articles','文章',FileText],['templates','模板',LayoutTemplate],['modules','模块',Blocks]] as const).map(([key,label,Icon])=><button key={key} role="tab" aria-selected={tab===key} onClick={()=>{setTab(key);setSearch('');setNotice('');}}><Icon size={14}/>{label}</button>)}
    </div>
    {tab==='modules'?<Library/>:<>
      <div className="collection-tools">
        {tab==='articles'?<><button className="primary-button" onClick={()=>void state.createArticle()}><Plus size={14}/>新建文章</button><button className="collection-save" onClick={()=>void state.saveArticle()}><Save size={14}/>保存当前文章</button></>:<form onSubmit={e=>{e.preventDefault();void saveTemplate();}}><label htmlFor="template-name">将当前排版保存为模板</label><input id="template-name" aria-label="模板名称" placeholder="给模板起个名字" maxLength={100} value={name} onChange={e=>setName(e.target.value)}/><button className="primary-button" disabled={!name.trim()}><Save size={14}/>保存模板</button></form>}
        <div className="collection-search"><Search size={14}/><input aria-label={tab==='articles'?'搜索文章':'搜索模板'} placeholder={tab==='articles'?'搜索文章…':'搜索模板…'} value={search} onChange={e=>setSearch(e.target.value)}/></div>
        {notice&&<p className="collection-notice" role="status">{notice}</p>}
      </div>
      <div className="collection-list" aria-label={tab==='articles'?'已保存文章':'已保存模板'}>
        {entries.map(a=><button key={a.id} className={`collection-card ${tab==='articles'&&a.id===state.article.id?'active':''}`} aria-label={tab==='articles'?`打开文章：${a.title}`:`使用模板：${a.title}`} aria-current={tab==='articles'&&a.id===state.article.id?'page':undefined} onClick={()=>void (tab==='articles'?state.openArticle(a.id):state.useTemplate(a.id))}>
          <span className="collection-card-title">{tab==='articles'?<FileText size={15}/>:<LayoutTemplate size={15}/>}<b>{a.title||'未命名文章'}</b></span>
          <small>{a.blocks.length} 个模块 · {new Date(a.updatedAt).toLocaleDateString('zh-CN')}</small>
          <span className="collection-card-hint">{tab==='articles'?(a.id===state.article.id?'正在编辑':'点击继续编辑'):'以此模板新建文章'}</span>
        </button>)}
        {!entries.length&&<p className="collection-empty">{search?'没有找到匹配的内容':tab==='templates'?'还没有模板。将当前文章排版保存为模板，下次可直接套用。':'还没有文章。点击上方新建文章。'}</p>}
      </div>
      <p className="collection-foot">{tab==='articles'?'文章分开保存在当前浏览器 · 建议定期导出 JSON':'模板保留文字、样式和图片 · 使用时生成独立文章'}</p>
    </>}
  </aside>;
}