import { Bold, Italic, Underline, Link, List, ListOrdered, RemoveFormatting } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ChainedCommands } from '@tiptap/core';
import type { Block, Styles } from '../types';
import { useEditorStore } from '../store/editor';
import { useTextSelection } from '../store/text-selection';
import { safeURL } from '../lib/sanitize';
import { ColorPicker } from './ColorPicker';

function FontSizeInput({value,onChange,scopeKey}:{value:number;onChange:(value:number)=>void;scopeKey:string}) {
  const [draft,setDraft]=useState(String(value));
  useEffect(()=>setDraft(String(value)),[value,scopeKey]);
  return <input aria-label="字号 / px" type="number" min="10" max="60" value={draft} onChange={e=>{setDraft(e.target.value);const number=Number(e.target.value);if(e.target.value&&number>=10&&number<=60)onChange(number);}} onBlur={()=>{const number=draft?Math.min(60,Math.max(10,Number(draft))):value;setDraft(String(number));if(number!==value)onChange(number);}}/>;
}

export function TextStyleInspector({b}:{b:Block}) {
  const selection=useTextSelection();
  const current=selection.blockId===b.id&&!selection.editor?.isDestroyed?selection:null;
  const editor=current?.editor;
  const partial=!!current?.range&&current.scope==='selection';
  const attrs=partial?editor?.getAttributes('inlineStyle')||{}:{};
  const selectedText=current?.range&&editor?editor.state.doc.textBetween(current.range.from,current.range.to,' '):'';
  const update=(key:keyof Styles,value:string|number)=>{
    if(partial){selection.apply(chain=>chain.setMark('inlineStyle',{[key==='background'?'backgroundColor':key]:String(value)+(key==='fontSize'?'px':'')}));return;}
    const state=useEditorStore.getState();
    // A whole-paragraph font/color change also replaces previous inline overrides.
    state.commit({...state.article,blocks:state.article.blocks.map(block=>{
      if(block.id!==b.id)return block;
      let content=block.content;
      if('html' in content&&['color','fontSize','fontWeight'].includes(key)){
        const doc=new DOMParser().parseFromString(content.html,'text/html');
        doc.querySelectorAll<HTMLElement>('span').forEach(span=>{span.style.removeProperty(key.replace(/[A-Z]/g,c=>`-${c.toLowerCase()}`));if(!span.getAttribute('style'))span.removeAttribute('style');});
        if(key==='fontWeight')doc.querySelectorAll('strong,b').forEach(mark=>mark.replaceWith(...mark.childNodes));
        content={...content,html:doc.body.innerHTML};
      }
      return {...block,content,styles:{...block.styles,[key]:value}} as Block;
    })},`style:${b.id}`);
  };
  const format=(command:(chain:ChainedCommands)=>ChainedCommands)=>{
    if(!editor)return;
    if(partial)selection.apply(command);
    else{
      command(editor.chain().selectAll()).setMeta('qusu-discrete',true).run();
      selection.setScope('block');
    }
  };
  const color=(name:string,key:'color'|'background')=><div className="property"><span>{name}</span><ColorPicker label={name} value={partial?(attrs[key==='background'?'backgroundColor':key]||String(b.styles[key])):String(b.styles[key])} onChange={value=>update(key,value)}/></div>;
  const fontSize=partial?parseFloat(attrs.fontSize)||b.styles.fontSize:b.styles.fontSize;
  const fontWeight=partial?Number(attrs.fontWeight)||(editor?.isActive('bold')?700:b.styles.fontWeight):b.styles.fontWeight;
  return <section className="property-section text-style-panel">
    <h4>文字与颜色</h4>
    {'html' in b.content&&<><div className="text-scope" role="group" aria-label="文字样式作用范围"><button aria-pressed={!partial} onMouseDown={e=>e.preventDefault()} onClick={()=>selection.setScope('block')}>整段文字</button><button aria-pressed={partial} disabled={!current?.range} onMouseDown={e=>e.preventDefault()} onClick={()=>selection.setScope('selection')}>选中文字</button></div><p className="property-note text-scope-note">{partial?`正在调整所选文字：“${selectedText.slice(0,28)}${selectedText.length>28?'…':''}”`:'正在调整整个模块。选中几个字后可切换为局部设置。'}</p></>}
    {color('文字颜色','color')}{color('背景颜色','background')}
    {partial&&<p className="property-note">选中文字的背景颜色用于文字高亮。</p>}
    <label className="property"><span>字号 / px</span><FontSizeInput value={fontSize} scopeKey={`${b.id}:${partial}`} onChange={value=>update('fontSize',value)}/></label>
    <label className="property"><span>字重</span><select aria-label="字重" value={fontWeight} onChange={e=>update('fontWeight',Number(e.target.value))}>{[400,500,600,700].map(weight=><option key={weight} value={weight}>{weight}</option>)}</select></label>
    {editor&&<div className="inspector-text-toolbar" role="toolbar" aria-label="文字格式">{[
      {Icon:Bold,name:'加粗',active:partial?editor.isActive('bold'):b.styles.fontWeight>=700,run:()=>partial?format(chain=>chain.toggleMark('bold')):update('fontWeight',b.styles.fontWeight>=700?400:700)},
      {Icon:Italic,name:'斜体',active:editor.isActive('italic'),run:()=>format(chain=>chain.toggleMark('italic'))},
      {Icon:Underline,name:'下划线',active:editor.isActive('underline'),run:()=>format(chain=>chain.toggleMark('underline'))},
      {Icon:Link,name:'链接',active:editor.isActive('link'),run:()=>{const url=window.prompt('输入链接 URL（留空移除）',String(editor.getAttributes('link').href||''));if(url===null)return;if(!url)format(chain=>chain.unsetMark('link'));else if(safeURL(url))format(chain=>chain.setMark('link',{href:safeURL(url)}));else window.alert('请使用有效的 https / http 链接。');}},
      {Icon:List,name:'无序列表',active:editor.isActive('bulletList'),run:()=>format(chain=>chain.toggleList('bulletList','listItem'))},
      {Icon:ListOrdered,name:'有序列表',active:editor.isActive('orderedList'),run:()=>format(chain=>chain.toggleList('orderedList','listItem'))},
      {Icon:RemoveFormatting,name:'清除格式',active:false,run:()=>format(chain=>chain.unsetAllMarks())},
    ].map(({Icon,name,active,run})=><button key={name} title={name} aria-label={name} aria-pressed={active} className={active?'active':''} onMouseDown={e=>e.preventDefault()} onClick={run}><Icon size={14}/></button>)}</div>}
    <label className="property"><span>行高 · 整段</span><input aria-label="行高" type="number" min="1" max="3" step="0.05" value={b.styles.lineHeight} onChange={e=>{if(e.target.value)useEditorStore.getState().style(b.id,{lineHeight:Math.min(3,Math.max(1,Number(e.target.value)))});}}/></label>
    <label className="property"><span>对齐 · 整段</span><select value={b.styles.textAlign} onChange={e=>useEditorStore.getState().style(b.id,{textAlign:e.target.value as Styles['textAlign']})}><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option></select></label>
    <div className="property"><span>装饰颜色 · 模块</span><ColorPicker label="装饰颜色" value={b.styles.accent} onChange={value=>useEditorStore.getState().style(b.id,{accent:value})}/></div>
  </section>;
}
