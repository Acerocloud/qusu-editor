import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { sanitizeRich } from '../lib/sanitize';
import { InlineStyle } from '../lib/inline-style';
import { useTextSelection } from '../store/text-selection';
import { useEditorStore } from '../store/editor';

export function RichText({blockId,value,onChange,label}:{blockId:string;value:string;onChange:(html:string,discrete?:boolean)=>void;label:string}) {
  const editor=useEditor({
    extensions:[StarterKit.configure({undoRedo:false,link:{openOnClick:false},heading:false,codeBlock:false,code:false,horizontalRule:false}),InlineStyle],
    content:sanitizeRich(value),
    editorProps:{attributes:{'aria-label':label,'class':'rich-text'},transformPastedHTML:sanitizeRich},
    onFocus:({editor})=>{useEditorStore.getState().select(blockId);useTextSelection.getState().activate(blockId,editor);},
    onSelectionUpdate:({editor})=>useTextSelection.getState().sync(editor,true),
    onTransaction:({editor})=>useTextSelection.getState().sync(editor),
    onUpdate:({editor,transaction})=>onChange(editor.getHTML(),transaction.getMeta('qusu-discrete')===true),
  });
  useEffect(()=>{
    if(!editor || editor.getHTML()===value || editor.view.composing)return;
    const current=useTextSelection.getState();
    const saved=current.editor===editor?current.range:null;
    editor.commands.setContent(sanitizeRich(value),{emitUpdate:false});
    if(saved){const limit=editor.state.doc.content.size;const from=Math.min(saved.from,limit);const to=Math.min(saved.to,limit);if(from<to)editor.commands.setTextSelection({from,to});useTextSelection.getState().setScope(current.scope);}
  },[value,editor]);
  useEffect(()=>()=>{if(editor)useTextSelection.getState().release(editor);},[editor]);
  return <div className="rich-wrap"><EditorContent editor={editor}/></div>;
}
