import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { Article, Block, BlockType, ContentMap, Styles } from '../types';
import { createBlock, defaultStyles } from '../blocks/registry';
import { newArticle, parseProject, patchContent } from '../lib/project';
import { readDatabase, writeStorage, cacheOnExit } from '../lib/storage';
const KEY='qusu-editor-project-v1';
let loadError='';
let validCache=false;
function load():Article { try { const data=localStorage.getItem(KEY);if(data){const a=parseProject(data);validCache=true;return a;}return newArticle(); } catch {loadError='本地记录无法恢复，已打开示范文章。原记录保留，首次修改前请导出备份。';return newArticle();} }
export interface EditorState {
  article:Article; selected:string|null; past:Article[]; future:Article[]; saved:'saved'|'saving'|'error'; error:string; hydrated:boolean;
  select:(id:string|null)=>void; commit:(a:Article,key?:string)=>void;
  insert:(type:BlockType,index?:number)=>void; remove:(id:string)=>void; duplicate:(id:string)=>void; move:(id:string,index:number)=>void;
  content:<K extends BlockType>(id:string,type:K,patch:Partial<ContentMap[K]>,discrete?:boolean)=>void;
  style:(id:string,patch:Partial<Styles>)=>void; reset:(id:string)=>void; rename:(title:string)=>void;
  undo:()=>void; redo:()=>void; replace:(a:Article)=>void;
}
let lastKey='';let lastTime=0;
export const useEditorStore=create<EditorState>((set,get)=>({
  article:load(),selected:null,past:[],future:[],saved:'saved',error:loadError,hydrated:false,
  select:selected=>set({selected}),
  commit:(article,key)=>{
    const state=get();if(JSON.stringify(state.article)===JSON.stringify(article))return;
    const now=Date.now();const merge=!!key&&key===lastKey&&now-lastTime<900;
    lastKey=key||'';lastTime=now;
    set({article:{...article,updatedAt:new Date().toISOString()},past:merge?state.past:[...state.past,state.article].slice(-80),future:[],saved:'saving'});
  },
  insert:(type,index)=>{const s=get();const block=createBlock(type) as Block;const blocks=[...s.article.blocks];const selectedIndex=blocks.findIndex(b=>b.id===s.selected);blocks.splice(index??(selectedIndex<0?blocks.length:selectedIndex+1),0,block);s.commit({...s.article,blocks});set({selected:block.id});},
  remove:id=>{const s=get();s.commit({...s.article,blocks:s.article.blocks.filter(b=>b.id!==id)});if(s.selected===id)set({selected:null});},
  duplicate:id=>{const s=get();const i=s.article.blocks.findIndex(b=>b.id===id);if(i<0)return;const block={...structuredClone(s.article.blocks[i]),id:nanoid()};const blocks=[...s.article.blocks];blocks.splice(i+1,0,block);s.commit({...s.article,blocks});set({selected:block.id});},
  move:(id,index)=>{const s=get();const blocks=[...s.article.blocks];const old=blocks.findIndex(b=>b.id===id);if(old<0)return;const [b]=blocks.splice(old,1);blocks.splice(Math.max(0,Math.min(blocks.length,index>old?index-1:index)),0,b);s.commit({...s.article,blocks});},
  content:(id,type,patch,discrete=false)=>{const s=get();s.commit({...s.article,blocks:s.article.blocks.map(b=>b.id===id?patchContent(b,type,patch):b)},discrete?undefined:`content:${id}`);},
  style:(id,patch)=>{const s=get();s.commit({...s.article,blocks:s.article.blocks.map(b=>b.id===id?{...b,styles:{...b.styles,...patch}}:b)},`style:${id}`);},
  reset:id=>{const s=get();s.commit({...s.article,blocks:s.article.blocks.map(b=>b.id===id?{...b,styles:defaultStyles(b.type)}:b)});},
  rename:title=>{const s=get();s.commit({...s.article,title},'title');},
  undo:()=>{const s=get();const previous=s.past.at(-1);if(!previous)return;lastKey='';set({article:previous,past:s.past.slice(0,-1),future:[s.article,...s.future],saved:'saving'});},
  redo:()=>{const s=get();const next=s.future[0];if(!next)return;lastKey='';set({article:next,past:[...s.past,s.article],future:s.future.slice(1),saved:'saving'});},
  replace:article=>{get().commit(article);set({selected:null});},
}));
let saveTimer:ReturnType<typeof setTimeout>;
async function save(){const article=useEditorStore.getState().article;try{await writeStorage(article);if(useEditorStore.getState().article===article)useEditorStore.setState({saved:'saved',error:''});}catch{useEditorStore.setState({saved:'error',error:'本地存储空间不足或不可用，请立即保存 JSON 备份。'});}}
useEditorStore.subscribe((state,prev)=>{if(state.article!==prev.article){clearTimeout(saveTimer);saveTimer=setTimeout(save,450);}});
window.addEventListener('pagehide',()=>{if(useEditorStore.getState().saved==='saving')cacheOnExit(useEditorStore.getState().article);});
void readDatabase().then(saved=>{
  const current=useEditorStore.getState().article;
  if(saved&&(!validCache||Date.parse(saved.updatedAt)>=Date.parse(current.updatedAt)))useEditorStore.setState({article:parseProject(JSON.stringify(saved)),error:''});
}).catch(()=>{/* localStorage provides the fallback project. */}).finally(()=>useEditorStore.setState({hydrated:true}));
