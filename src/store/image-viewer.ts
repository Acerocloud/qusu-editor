import { create } from 'zustand';
import { safeURL } from '../lib/sanitize';

export const useImageViewer = create<{src:string;caption:string;open:(src:string,caption:string)=>void;close:()=>void}>(set=>({
  src:'',caption:'',
  open:(src,caption)=>{const url=safeURL(src,true,true);if(url)set({src:url,caption});},
  close:()=>set({src:'',caption:''}),
}));
