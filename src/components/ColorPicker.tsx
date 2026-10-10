import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { colorHex, standardPalette } from '../lib/palette';

export function ColorPicker({label,value,onChange,disabled=false,onBeforeChange,compact=false}:{label:string;value:string;onChange:(color:string)=>void;disabled?:boolean;onBeforeChange?:()=>void;compact?:boolean}) {
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(!open)return;const close=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[open]);
  useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
  const current=colorHex(value);
  return <div ref={root} className={`color-picker ${compact?'compact':''}`} onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);e.stopPropagation();}}}>
    <div className="color-picker-controls">
      <input type="color" aria-label={label} disabled={disabled} value={current} onPointerDown={onBeforeChange} onChange={e=>onChange(e.target.value)}/>
      {!compact&&<span className="color-hex">{current.toUpperCase()}</span>}
      <button type="button" className="palette-trigger" aria-label={`${label}标准配色`} title="标准配色" aria-expanded={open} disabled={disabled} onMouseDown={e=>{e.preventDefault();onBeforeChange?.();}} onClick={()=>setOpen(!open)}><ChevronDown size={12}/></button>
    </div>
    {open&&<div className="palette-popover" role="group" aria-label={`${label}标准配色选项`}>
      {standardPalette.map(group=><div className="palette-group" key={group.name}><div>{group.name}</div><div className="palette-swatches">{group.colors.map(color=><button type="button" key={color.value} title={`${color.name} ${color.value.toUpperCase()}`} aria-label={`${label}：${color.name}`} aria-pressed={current===color.value} className={current===color.value?'chosen':''} style={{backgroundColor:color.value}} onMouseDown={e=>{e.preventDefault();onBeforeChange?.();}} onClick={()=>{onChange(color.value);setOpen(false);}}/>)}</div></div>)}
      <p>自定义颜色：点击左侧色块</p>
    </div>}
  </div>;
}
