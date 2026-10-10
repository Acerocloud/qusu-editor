import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { Article, Block, BlockType, ContentMap, Styles } from '../types';
import { createBlock, defaultStyles } from '../blocks/registry';
import { newArticle, parseProject, patchContent } from '../lib/project';
import { readDatabase, readWorkspace, writeWorkspace, cacheOnExit, type Workspace, type EditMode } from '../lib/storage';
const KEY='qusu-editor-project-v1';
let loadError='';
let validCache=false;
function load():Article { try { const data=localStorage.getItem(KEY);if(data){const a=parseProject(data);validCache=true;return a;}return newArticle(); } catch {loadError='本地记录无法恢复，已打开示范文章。原记录保留，首次修改前请导出备份。';return newArticle();} }
export interface EditorState {
  article:Article; selected:string|null; past:Article[]; future:Article[]; saved:'saved'|'saving'|'error'; error:string; hydrated:boolean;
  articles:Article[]; templates:Article[]; libraryBusy:boolean; activeMode:EditMode; templateDirty:boolean; deletedArticleIds:string[]; deletedTemplateIds:string[];
  saveArticle:()=>Promise<void>; createArticle:()=>Promise<void>; openArticle:(id:string)=>Promise<void>; deleteArticle:(id:string)=>Promise<void>;
  saveTemplate:()=>Promise<void>; createTemplate:()=>Promise<void>; articleToTemplate:(name:string)=>Promise<void>; openTemplate:(id:string)=>Promise<void>; useTemplate:()=>Promise<void>; deleteTemplate:(id:string)=>Promise<void>;
  select:(id:string|null)=>void; commit:(a:Article,key?:string)=>void;
  insert:(type:BlockType,index?:number)=>void; remove:(id:string)=>void; duplicate:(id:string)=>void; move:(id:string,index:number)=>void;
  content:<K extends BlockType>(id:string,type:K,patch:Partial<ContentMap[K]>,discrete?:boolean)=>void;
  style:(id:string,patch:Partial<Styles>)=>void; reset:(id:string)=>void; rename:(title:string)=>void;
  undo:()=>void; redo:()=>void; replace:(a:Article)=>void;
}
let lastKey='';let lastTime=0;
export const useEditorStore=create<EditorState>((set,get)=>({
  article:load(),articles:[],templates:[],libraryBusy:false,activeMode:'article',templateDirty:false,deletedArticleIds:[],deletedTemplateIds:[],selected:null,past:[],future:[],saved:'saved',error:loadError,hydrated:false,
  saveArticle:()=>persist(),
  createArticle:()=>transition('article',newArticle(true)),
  openArticle:id=>{const a=get().articles.find(a=>a.id===id);return a&&(get().activeMode!=='article'||a.id!==get().article.id)?transition('article',a):Promise.resolve();},
  saveTemplate:()=>get().activeMode==='template'?persist():Promise.resolve(),
  createTemplate:()=>transition('template',{...newArticle(true),title:'未命名模板'},true),
  articleToTemplate:name=>get().activeMode==='article'?transition('template',cloneArticle(get().article,name.trim()||'未命名模板'),true):Promise.resolve(),
  openTemplate:id=>{const a=get().templates.find(a=>a.id===id);return a&&(get().activeMode!=='template'||a.id!==get().article.id)?transition('template',a):Promise.resolve();},
  useTemplate:()=>get().activeMode==='template'?transition('article',cloneArticle(get().article,`${get().article.title} · 新文章`)):Promise.resolve(),
  deleteArticle:id=>transition(undefined,undefined,false,id),
  deleteTemplate:id=>transition(undefined,undefined,false,id,'template'),
  select:selected=>set({selected}),
  commit:(article,key)=>{
    const state=get();if(state.libraryBusy||state.activeMode==='empty')return;if(JSON.stringify(state.article)===JSON.stringify(article))return;
    const now=Date.now();const merge=!!key&&key===lastKey&&now-lastTime<900;
    lastKey=key||'';lastTime=now;
    set({article:{...article,updatedAt:new Date().toISOString()},past:merge?state.past:[...state.past,state.article].slice(-80),future:[],saved:'saving',templateDirty:state.activeMode==='template'});
  },
  insert:(type,index)=>{const s=get();const block=createBlock(type) as Block;const blocks=[...s.article.blocks];const selectedIndex=blocks.findIndex(b=>b.id===s.selected);blocks.splice(index??(selectedIndex<0?blocks.length:selectedIndex+1),0,block);s.commit({...s.article,blocks});set({selected:block.id});},
  remove:id=>{const s=get();s.commit({...s.article,blocks:s.article.blocks.filter(b=>b.id!==id)});if(s.selected===id)set({selected:null});},
  duplicate:id=>{const s=get();const i=s.article.blocks.findIndex(b=>b.id===id);if(i<0)return;const block={...structuredClone(s.article.blocks[i]),id:nanoid()};const blocks=[...s.article.blocks];blocks.splice(i+1,0,block);s.commit({...s.article,blocks});set({selected:block.id});},
  move:(id,index)=>{const s=get();const blocks=[...s.article.blocks];const old=blocks.findIndex(b=>b.id===id);if(old<0)return;const [b]=blocks.splice(old,1);blocks.splice(Math.max(0,Math.min(blocks.length,index>old?index-1:index)),0,b);s.commit({...s.article,blocks});},
  content:(id,type,patch,discrete=false)=>{const s=get();s.commit({...s.article,blocks:s.article.blocks.map(b=>b.id===id?patchContent(b,type,patch):b)},discrete?undefined:`content:${id}`);},
  style:(id,patch)=>{const s=get();s.commit({...s.article,blocks:s.article.blocks.map(b=>b.id===id?{...b,styles:{...b.styles,...patch}}:b)},`style:${id}`);},
  reset:id=>{const s=get();s.commit({...s.article,blocks:s.article.blocks.map(b=>b.id===id?{...b,styles:defaultStyles(b.type)}:b)});},
  rename:title=>{const s=get();s.commit({...s.article,title},'title');},
  undo:()=>{const s=get();const previous=s.past.at(-1);if(!previous)return;lastKey='';set({templateDirty:s.activeMode==='template',article:{...previous,updatedAt:new Date().toISOString()},past:s.past.slice(0,-1),future:[s.article,...s.future],saved:'saving'});},
  redo:()=>{const s=get();const next=s.future[0];if(!next)return;lastKey='';set({templateDirty:s.activeMode==='template',article:{...next,updatedAt:new Date().toISOString()},past:[...s.past,s.article],future:s.future.slice(1),saved:'saving'});},
  replace:article=>{const current=get().article;get().commit({...article,id:current.id,createdAt:current.createdAt});set({selected:null});},
}));
let saveTimer:ReturnType<typeof setTimeout>;
let applying=false;
const emptyArticle:Article={schemaVersion:1,id:'',title:'',blocks:[],createdAt:'',updatedAt:''};
const histories=new Map<string,{past:Article[];future:Article[];selected:string|null}>();
function historyKey(mode:EditMode,article:Article){return `${mode}:${article.id}`;}
function upsert(records:Article[],article:Article){return [...records.filter(a=>a.id!==article.id),article];}
function workspace(state:EditorState,finalizeTemplate=false):Workspace{
  let articles=state.articles;let templates=state.templates;let draft:Article|null=null;
  if(state.activeMode==='article')articles=upsert(articles,state.article);
  if(state.activeMode==='template'){
    if(state.templateDirty&&!finalizeTemplate)draft=state.article;
    else templates=upsert(templates,state.article);
  }
  return {version:2,activeMode:state.activeMode,activeId:state.activeMode==='empty'?null:state.article.id,articles,templates,draft,deletedArticleIds:state.deletedArticleIds,deletedTemplateIds:state.deletedTemplateIds};
}
function cloneArticle(source:Article,title:string):Article{const now=new Date().toISOString();return {...structuredClone(source),id:nanoid(),title,createdAt:now,updatedAt:now,blocks:source.blocks.map(b=>({...structuredClone(b),id:nanoid(),...('images' in b.content?{content:{...structuredClone(b.content),images:b.content.images.map(i=>({...i,id:nanoid()}))}}:{})})) as Block[]};}
function applyWorkspace(data:Workspace,restoreHistory=false){
  const article=data.activeMode==='empty'?emptyArticle:data.draft||(data.activeMode==='template'?data.templates:data.articles).find(a=>a.id===data.activeId)!;
  const history=histories.get(historyKey(data.activeMode,article))||{past:[],future:[],selected:null};
  applying=true;
  useEditorStore.setState({article,activeMode:data.activeMode,articles:data.articles,templates:data.templates,deletedArticleIds:data.deletedArticleIds,deletedTemplateIds:data.deletedTemplateIds,templateDirty:!!data.draft,libraryBusy:false,saved:data.draft?'saving':'saved',error:'',...(restoreHistory?history:{})});
  applying=false;
}
async function persist(){
  const state=useEditorStore.getState();if(state.libraryBusy)return;
  clearTimeout(saveTimer);useEditorStore.setState({libraryBusy:true});
  try{const stored=await writeWorkspace(workspace(state,true));applyWorkspace(stored,stored.activeMode!==state.activeMode||stored.activeId!==state.article.id);}
  catch{useEditorStore.setState({libraryBusy:false,saved:'error',error:'本地保存失败，当前内容已保留。请导出 JSON 备份后重试。'});}
}
async function transition(mode?:EditMode,article?:Article,isDraft=false,deleteId?:string,deleteMode:'article'|'template'='article'){
  const state=useEditorStore.getState();if(state.libraryBusy)return;
  if(deleteId&&!(deleteMode==='article'?state.articles:state.templates).some(a=>a.id===deleteId)&&!(state.activeMode===deleteMode&&state.article.id===deleteId))return;
  clearTimeout(saveTimer);useEditorStore.setState({libraryBusy:true});
  const data=workspace(state,true);
  if(deleteId){
    if(deleteMode==='article'){data.deletedArticleIds=[...new Set([...data.deletedArticleIds,deleteId])];data.articles=data.articles.filter(a=>a.id!==deleteId);}
    else{data.deletedTemplateIds=[...new Set([...data.deletedTemplateIds,deleteId])];data.templates=data.templates.filter(a=>a.id!==deleteId);}
    if(state.activeMode===deleteMode&&state.article.id===deleteId){
      const next=[...(deleteMode==='template'?data.templates:data.articles)].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
      const fallback=deleteMode==='template'?[...data.articles].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0]:undefined;
      mode=next?deleteMode:fallback?'article':'empty';article=next||fallback;
    }
  }
  if(mode){data.activeMode=mode;data.activeId=article?.id||null;data.draft=null;
    if(mode==='article'&&article)data.articles=upsert(data.articles,article);
    if(mode==='template'&&article){if(isDraft)data.draft=article;else data.templates=upsert(data.templates,article);}
  }
  try{
    const stored=await writeWorkspace(data);
    histories.set(historyKey(state.activeMode,state.article),{past:state.past,future:state.future,selected:state.selected});
    if(deleteId)histories.delete(`${deleteMode}:${deleteId}`);
    lastKey='';applyWorkspace(stored,!!mode);
  }catch{useEditorStore.setState({libraryBusy:false,saved:'error',error:'本地保存失败，未切换或删除文档，当前内容已保留。请导出 JSON 备份后重试。'});}
}
async function autosave(){
  const state=useEditorStore.getState();if(state.libraryBusy||!state.hydrated)return;
  try{
    const stored=await writeWorkspace(workspace(state));
    if(useEditorStore.getState().article===state.article&&!useEditorStore.getState().libraryBusy){
      if(stored.activeMode!==state.activeMode||stored.activeId!==state.article.id)applyWorkspace(stored,true);
      else useEditorStore.setState({articles:stored.articles,templates:stored.templates,deletedArticleIds:stored.deletedArticleIds,deletedTemplateIds:stored.deletedTemplateIds,saved:state.activeMode==='template'&&state.templateDirty?'saving':'saved',error:''});
    }
  }catch{useEditorStore.setState({saved:'error',error:'本地保存失败，当前内容已保留。请导出 JSON 备份后重试。'});}
}
useEditorStore.subscribe((state,prev)=>{if(state.article!==prev.article&&!applying&&!state.libraryBusy&&state.hydrated){clearTimeout(saveTimer);saveTimer=setTimeout(autosave,450);}});
window.addEventListener('pagehide',()=>{const state=useEditorStore.getState();if(state.saved!=='saved')cacheOnExit(workspace(state));});
void (async()=>{
  const library=await readWorkspace();
  if(library){
    const cached=useEditorStore.getState().article;
    const active=library.articles.find(a=>a.id===library.activeId);
    const newerCache=library.activeMode==='article'&&validCache&&active?.id===cached.id&&!library.deletedArticleIds.includes(cached.id)&&Date.parse(cached.updatedAt)>Date.parse(active.updatedAt);
    if(newerCache)library.articles=upsert(library.articles,cached);
    applyWorkspace(library,true);
    if(newerCache){useEditorStore.setState({saved:'saving'});saveTimer=setTimeout(autosave,450);}
    return;
  }
  const saved=await readDatabase().catch(()=>undefined);const current=useEditorStore.getState().article;
  if(saved&&(!validCache||Date.parse(saved.updatedAt)>=Date.parse(current.updatedAt)))useEditorStore.setState({article:parseProject(JSON.stringify(saved)),error:''});
  useEditorStore.setState({articles:[useEditorStore.getState().article]});
})().catch(()=>useEditorStore.setState({articles:[useEditorStore.getState().article],error:'文章库无法恢复，原记录保留。请先导出当前内容备份。'})).finally(()=>useEditorStore.setState({hydrated:true}));
