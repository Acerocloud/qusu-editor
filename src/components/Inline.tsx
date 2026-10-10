export function Inline({value,onChange,label,multiline=false}:{value:string;onChange:(v:string)=>void;label:string;multiline?:boolean}) {
  return multiline?<textarea aria-label={label} className="inline-field multiline" rows={1} value={value} onChange={e=>onChange(e.target.value)} />:<input aria-label={label} className="inline-field" value={value} onChange={e=>onChange(e.target.value)} />;
}
