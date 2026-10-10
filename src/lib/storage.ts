import type { Article } from '../types';
import { parseProject } from './project';
const KEY='qusu-editor-project-v1';
const WORKSPACE_KEY='qusu-editor-workspace-v1';
export type EditMode='article'|'template'|'empty';
export interface Workspace { version:2; activeId:string|null; activeMode:EditMode; articles:Article[]; templates:Article[]; draft:Article|null; deletedArticleIds:string[]; savedAt?:string }
let dbPromise:Promise<IDBDatabase>|undefined;
function database():Promise<IDBDatabase>{
  if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
    const request=indexedDB.open('qusu-editor',1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('projects'))request.result.createObjectStore('projects');};
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>{dbPromise=undefined;reject(request.error);};request.onblocked=()=>reject(new Error('本地数据库被其他窗口占用'));
  });
  return dbPromise;
}
async function read(key:string):Promise<unknown>{const db=await database();return new Promise((resolve,reject)=>{const request=db.transaction('projects','readonly').objectStore('projects').get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
export async function readDatabase():Promise<Article|undefined>{return await read('current') as Article|undefined;}
export function parseWorkspace(raw:unknown):Workspace {
  const value=raw as Omit<Workspace,'version'> & {version:number};
  if(!value||![1,2].includes(value.version)||!Array.isArray(value.articles)||!Array.isArray(value.templates))throw new Error('文章库格式无效');
  const articles=value.articles.map(a=>parseProject(JSON.stringify(a)));
  const templates=value.templates.map(a=>parseProject(JSON.stringify(a)));
  const legacy=value.version===1;
  const activeMode=legacy?'article':value.activeMode;
  const draft=legacy||!value.draft?null:parseProject(JSON.stringify(value.draft));
  const deletedArticleIds=legacy?[]:value.deletedArticleIds;
  if(!Array.isArray(deletedArticleIds)||!deletedArticleIds.every(id=>typeof id==='string')||new Set(articles.map(a=>a.id)).size!==articles.length||new Set(templates.map(a=>a.id)).size!==templates.length||!['article','template','empty'].includes(activeMode))throw new Error('文章库索引无效');
  if(activeMode==='article'&&!articles.some(a=>a.id===value.activeId)||activeMode==='template'&&!templates.some(a=>a.id===value.activeId)&&draft?.id!==value.activeId||activeMode==='empty'&&value.activeId!==null||draft&&draft.id!==value.activeId)throw new Error('当前文档索引无效');
  return {version:2,activeId:value.activeId,activeMode,articles,templates,draft,deletedArticleIds,savedAt:value.savedAt};
}
export async function readWorkspace():Promise<Workspace|undefined>{
  let value:unknown;
  try{value=await read('workspace');}catch{/* Read the complete fallback when IndexedDB is unavailable. */}
  const raw=localStorage.getItem(WORKSPACE_KEY);
  const stored=value?parseWorkspace(value):undefined;
  const fallback=raw?parseWorkspace(JSON.parse(raw)):undefined;
  if(stored&&fallback)return (fallback.savedAt||'')>(stored.savedAt||'')?mergeLibrary(stored,fallback):mergeLibrary(fallback,stored);
  return stored||fallback;
}
export function mergeLibrary(current:Workspace|undefined,next:Workspace):Workspace{
  const deletedArticleIds=[...new Set([...(current?.deletedArticleIds||[]),...next.deletedArticleIds])];
  const merge=(previous:Article[],incoming:Article[])=>{const records=new Map(previous.map(a=>[a.id,a]));for(const a of incoming){const old=records.get(a.id);if(!old||a.updatedAt>=old.updatedAt)records.set(a.id,a);}return [...records.values()];};
  const articles=merge(current?.articles||[],next.articles).filter(a=>!deletedArticleIds.includes(a.id));
  const result={...next,articles,templates:merge(current?.templates||[],next.templates),deletedArticleIds};
  if(result.activeMode==='article'&&!articles.some(a=>a.id===result.activeId)){
    const article=[...articles].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
    result.activeMode=article?'article':'empty';result.activeId=article?.id||null;
  }
  return result;
}
let writes:Promise<unknown>=Promise.resolve();
export function writeWorkspace(workspace:Workspace):Promise<Workspace>{
  let snapshot=structuredClone(workspace);
  const operation=writes.catch(()=>{}).then(async()=>{
    snapshot.savedAt=new Date().toISOString();
    try{
      const db=await database();
      await new Promise<void>((resolve,reject)=>{
        const tx=db.transaction('projects','readwrite');const store=tx.objectStore('projects');const request=store.get('workspace');
        request.onsuccess=()=>{try{snapshot=mergeLibrary(request.result?parseWorkspace(request.result):undefined,snapshot);store.put(snapshot,'workspace');if(snapshot.activeMode==='article')store.put(snapshot.articles.find(a=>a.id===snapshot.activeId),'current');else store.delete('current');}catch(error){reject(error);tx.abort();}};
        tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('本地保存已中止'));
      });
    }catch{const raw=localStorage.getItem(WORKSPACE_KEY);snapshot=mergeLibrary(raw?parseWorkspace(JSON.parse(raw)):undefined,snapshot);localStorage.setItem(WORKSPACE_KEY,JSON.stringify(snapshot));}
    try{if(snapshot.activeMode==='article')localStorage.setItem(KEY,JSON.stringify(snapshot.articles.find(a=>a.id===snapshot.activeId)));else localStorage.removeItem(KEY);}catch{/* The full workspace remains the durable copy. */}
    return snapshot;
  });
  writes=operation;
  return operation;
}
export function cacheOnExit(workspace:Workspace):void{try{localStorage.setItem(WORKSPACE_KEY,JSON.stringify({...workspace,savedAt:new Date().toISOString()}));}catch{/* Completed autosaves include local images in IndexedDB. */}}
