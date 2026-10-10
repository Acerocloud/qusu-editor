import type { Article } from '../types';
import { parseProject } from './project';
const KEY='qusu-editor-project-v1';
const WORKSPACE_KEY='qusu-editor-workspace-v1';
export interface Workspace { version:1; activeId:string; articles:Article[]; templates:Article[]; savedAt?:string }
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
  const value=raw as Workspace;
  if(!value||value.version!==1||!Array.isArray(value.articles)||!Array.isArray(value.templates)||!value.articles.length)throw new Error('文章库格式无效');
  const articles=value.articles.map(a=>parseProject(JSON.stringify(a)));
  const templates=value.templates.map(a=>parseProject(JSON.stringify(a)));
  if(new Set(articles.map(a=>a.id)).size!==articles.length||new Set(templates.map(a=>a.id)).size!==templates.length||!articles.some(a=>a.id===value.activeId))throw new Error('文章库索引无效');
  return {version:1,activeId:value.activeId,articles,templates,savedAt:value.savedAt};
}
export async function readWorkspace():Promise<Workspace|undefined>{
  let value:unknown;
  try{value=await read('workspace');}catch{/* Try the complete fallback below. */}
  const raw=localStorage.getItem(WORKSPACE_KEY);
  if(raw){const fallback=JSON.parse(raw) as Workspace;if(!value||(fallback.savedAt||'')>((value as Workspace).savedAt||''))value=fallback;}
  return value?parseWorkspace(value):undefined;
}
function mergeLibrary(current:Workspace|undefined,next:Workspace):Workspace{
  const merge=(previous:Article[],incoming:Article[])=>{const records=new Map(previous.map(a=>[a.id,a]));for(const a of incoming){const old=records.get(a.id);if(!old||a.updatedAt>=old.updatedAt)records.set(a.id,a);}return [...records.values()];};
  return current?{...next,articles:merge(current.articles,next.articles),templates:merge(current.templates,next.templates)}:next;
}
let writes:Promise<unknown>=Promise.resolve();
export function writeWorkspace(workspace:Workspace):Promise<Workspace>{
  const snapshot=structuredClone(workspace);
  const operation=writes.catch(()=>{}).then(async()=>{
    snapshot.savedAt=new Date().toISOString();
    try{
      const db=await database();
      await new Promise<void>((resolve,reject)=>{const tx=db.transaction('projects','readwrite');const store=tx.objectStore('projects');const request=store.get('workspace');request.onsuccess=()=>{const merged=mergeLibrary(request.result,snapshot);snapshot.articles=merged.articles;snapshot.templates=merged.templates;store.put(snapshot,'workspace');store.put(snapshot.articles.find(a=>a.id===snapshot.activeId),'current');};tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
    }catch{const raw=localStorage.getItem(WORKSPACE_KEY);const merged=mergeLibrary(raw?parseWorkspace(JSON.parse(raw)):undefined,snapshot);snapshot.articles=merged.articles;snapshot.templates=merged.templates;localStorage.setItem(WORKSPACE_KEY,JSON.stringify(snapshot));}
    const article=snapshot.articles.find(a=>a.id===snapshot.activeId)!;
    try{localStorage.setItem(KEY,JSON.stringify(article));}catch{/* The full workspace remains the durable copy. */}
    return snapshot;
  });
  writes=operation;
  return operation;
}
export function cacheOnExit(a:Article):void{try{localStorage.setItem(KEY,JSON.stringify(a));}catch{/* Completed autosaves include local images in IndexedDB. */}}
