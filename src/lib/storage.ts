import type { Article } from '../types';
const KEY='qusu-editor-project-v1';
let dbPromise:Promise<IDBDatabase>|undefined;
function database():Promise<IDBDatabase>{
  if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
    const request=indexedDB.open('qusu-editor',1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('projects'))request.result.createObjectStore('projects');};
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(new Error('本地数据库被其他窗口占用'));
  });
  return dbPromise;
}
export async function readDatabase():Promise<Article|undefined>{const db=await database();return new Promise((resolve,reject)=>{const request=db.transaction('projects','readonly').objectStore('projects').get('current');request.onsuccess=()=>resolve(request.result as Article|undefined);request.onerror=()=>reject(request.error);});}
function compact(a:Article):Article{return {...a,blocks:a.blocks.map(b=>{if(b.type==='image'&&b.content.local)return {...b,content:{...b.content,src:'',local:false}};if(b.type==='figure'&&b.content.local)return {...b,content:{...b.content,src:'',local:false}};if(b.type==='scrollImage'&&b.content.local)return {...b,content:{...b.content,src:'',local:false}};if(b.type==='imageGallery')return {...b,content:{...b.content,images:b.content.images.map(i=>i.local?{...i,src:'',local:false}:i)}};return b;})};}
export async function writeStorage(a:Article):Promise<void>{
  let databaseSaved=false;
  try{const db=await database();await new Promise<void>((resolve,reject)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(a,'current');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});databaseSaved=true;}catch{/* Fall back to a complete localStorage project if IndexedDB is disabled. */}
  if(databaseSaved){try{localStorage.setItem(KEY,JSON.stringify(compact(a)));}catch{/* IndexedDB remains the durable primary copy. */}return;}
  localStorage.setItem(KEY,JSON.stringify(a));
}
export function cacheOnExit(a:Article):void{try{localStorage.setItem(KEY,JSON.stringify(a));}catch{/* A normal completed autosave already stored images in IndexedDB. */}}
