import { Fragment, type CSSProperties } from 'react';
import { ImagePlus } from 'lucide-react';
import type { Block, BlockOf, BlockType, ContentMap } from '../types';
import { useEditorStore } from '../store/editor';
import { RichText } from '../components/RichText';
import { safeURL } from '../lib/sanitize';
import { styleString } from '../lib/serializer';
import { readImage } from '../lib/images';
import { ScrollImageView, ImageGalleryView } from './scroll-images';
import { Inline } from '../components/Inline';
function Field<K extends BlockType>({b,field,label,multi=false}:{b:BlockOf<K>;field:keyof ContentMap[K];label:string;multi?:boolean}){const update=useEditorStore(s=>s.content);return <Inline label={label} multiline={multi} value={String((b.content as ContentMap[K])[field])} onChange={value=>update(b.id,b.type,{[field]:value} as Partial<ContentMap[K]>)}/>;}
function Rich<K extends 'paragraph'|'quoteParagraph'|'abstract'|'keyQuote'|'insightBox'|'caveatBox'|'takeaway'>({b}:{b:BlockOf<K>}){const update=useEditorStore(s=>s.content);return <RichText blockId={b.id} label="正文内容" value={b.content.html} onChange={(html,discrete)=>update(b.id,b.type,{html} as Partial<ContentMap[K]>,discrete)}/>;}
const titleStyle:CSSProperties={fontWeight:700,fontSize:14,color:'#05183B',marginBottom:8};
function LabeledRich<K extends 'abstract'|'insightBox'|'caveatBox'|'takeaway'>({b}:{b:BlockOf<K>}){return <><div style={{...titleStyle,...(b.type==='caveatBox'?{fontSize:12,color:'#8C6A0D'}:{})}}><Field b={b} field="heading" label="模块标题"/></div><Rich b={b}/></>;}
function ImageView({b}:{b:BlockOf<'image'>|BlockOf<'figure'>}){const update=useEditorStore(s=>s.content);const c=b.content;const src=safeURL(c.src,true,true);return <><label className={`image-upload ${src?'has-image':''}`} style={{width:`${c.width}%`}} title="点击上传或替换图片"><input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{const src=await readImage(file);update(b.id,b.type,{src,local:true});}catch(err){window.alert((err as Error).message);}e.target.value='';}}/>{src?<img src={src} alt={c.caption}/>:<span><ImagePlus size={24}/><b>添加图片</b><small>点击上传 · 或在右侧填写图片地址</small></span>}</label>{c.local&&<div className="local-image-badge">本地预览 · 发布前请上传公众号并填回图片 URL</div>}<div style={{fontSize:12,color:'#78828E',marginTop:8}}><Field b={b} field="caption" label="图片说明" multi/></div></>;}
type Renderers={ [K in BlockType]:(props:{b:BlockOf<K>})=>React.ReactNode };
export const renderers:Renderers={
  articleHeader:({b})=><><div style={{width:52,height:3,background:b.styles.accent,marginBottom:16}}/><div className="header-fields"><span style={{width:`${Math.max(10,b.content.label.length)}ch`,maxWidth:'80%'}}><Field b={b} field="label" label="栏目文字"/></span><span>·</span><span style={{width:67}}><Field b={b} field="date" label="栏目日期"/></span></div></>,
  articleTitle:({b})=><><Field b={b} field="title" label="文章主标题" multi/><div style={{marginTop:12,fontSize:14,color:'#626B77',fontWeight:400,lineHeight:1.75}}><Field b={b} field="subtitle" label="文章副标题" multi/></div></>,
  authorInfo:({b})=><div><Field b={b} field="author" label="作者"/></div>,
  abstract:LabeledRich,
  sectionHeading:({b})=><Field b={b} field="title" label="章节标题" multi/>,
  subsectionHeading:({b})=><Field b={b} field="title" label="小节标题" multi/>,
  categoryLabel:({b})=><Field b={b} field="text" label="分类标签"/>,
  keyQuote:Rich,
  insightBox:LabeledRich,
  caveatBox:LabeledRich,
  metrics:({b})=><MetricView b={b}/>,
  figure:({b})=><><div className="figure-heading"><span className="figure-tag">FIG. <span style={{width:20,display:'inline-block'}}><Field b={b} field="number" label="图片编号"/></span></span><Field b={b} field="title" label="图片标题" multi/></div><ImageView b={b}/></>,
  comparisonTable:({b})=><TableView b={b}/>,
  takeaway:LabeledRich,
  references:({b})=><><div style={titleStyle}><Field b={b} field="heading" label="参考资料标题"/></div><ReferenceView b={b}/><div style={{marginTop:8}}><Field b={b} field="note" label="参考资料备注" multi/></div></>,
  brandFooter:({b})=><><div style={{width:34,height:3,background:b.styles.accent,marginBottom:16}}/><Field b={b} field="title" label="品牌名称"/><div style={{marginTop:8,fontSize:11,fontWeight:400,color:'#CDD6E6',letterSpacing:1}}><Field b={b} field="subtitle" label="品牌副标题" multi/></div></>,
  paragraph:Rich,
  quoteParagraph:Rich,
  image:ImageView,
  scrollImage:ScrollImageView,
  imageGallery:ImageGalleryView,
  divider:({b})=><div style={{height:1,background:b.styles.borderColor}}/>,
};
function MetricView({b}:{b:BlockOf<'metrics'>}){const update=useEditorStore(s=>s.content);return <table className="metrics-table"><tbody><tr>{b.content.items.map((item,i)=><Fragment key={i}><td style={{width:b.content.items.length===3?'32%':'49%'}}><div style={{fontSize:24,color:'#05183B',fontWeight:700}}><Inline label={`指标 ${i+1} 数值`} value={item.value} onChange={value=>update(b.id,b.type,{items:b.content.items.map((x,j)=>i===j?{...x,value}:x)})}/></div><div className="metric-description"><Inline label={`指标 ${i+1} 描述`} value={item.description} onChange={description=>update(b.id,b.type,{items:b.content.items.map((x,j)=>i===j?{...x,description}:x)})}/><span> / </span><Inline label={`指标 ${i+1} 单位`} value={item.unit} onChange={unit=>update(b.id,b.type,{items:b.content.items.map((x,j)=>i===j?{...x,unit}:x)})}/></div></td>{i<b.content.items.length-1&&<td style={{width:'2%',padding:0,background:'transparent'}}/>}</Fragment>)}</tr></tbody></table>;}
function TableView({b}:{b:BlockOf<'comparisonTable'>}){const update=useEditorStore(s=>s.content);return <table className="comparison-table"><tbody>{b.content.rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j} style={{background:i===0?b.content.headerColor:i%2===0?'#F4F6F9':'#FFF',color:i===0?'#FFF':b.styles.color,fontWeight:i===0?700:400}}><Inline label={`表格 ${i+1} 行 ${j+1} 列`} multiline value={cell} onChange={value=>update(b.id,b.type,{rows:b.content.rows.map((r,k)=>k===i?r.map((v,l)=>l===j?value:v):r)})}/></td>)}</tr>)}</tbody></table>;}
function ReferenceView({b}:{b:BlockOf<'references'>}){const update=useEditorStore(s=>s.content);return <>{b.content.items.map((item,i)=><div key={i} style={{marginBottom:6}}><Inline label={`引用 ${i+1}`} value={item} onChange={value=>update(b.id,b.type,{items:b.content.items.map((x,j)=>j===i?value:x)})}/></div>)}</>;}
export function blockCSS(b:Block):CSSProperties {const pairs=styleString(b.styles,b.type).split(';').filter(Boolean).map(s=>{const [key,...value]=s.split(':');return [key.replace(/-([a-z])/g,(_,letter:string)=>letter.toUpperCase()),value.join(':')];});return Object.fromEntries(pairs) as CSSProperties;}
export function BlockContent({block}:{block:Block}){const Renderer=renderers[block.type] as (props:{b:Block})=>React.ReactNode;return <div className="block-content" style={blockCSS(block)}><Renderer b={block}/></div>;}

