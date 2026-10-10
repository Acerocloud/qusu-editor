import { create } from 'zustand';
import type { Editor, ChainedCommands } from '@tiptap/core';

interface TextSelectionState {
  editor: Editor | null;
  blockId: string | null;
  range: { from: number; to: number } | null;
  scope: 'block' | 'selection';
  revision: number;
  activate: (blockId: string, editor: Editor) => void;
  sync: (editor: Editor, newSelection?: boolean) => void;
  setScope: (scope: 'block' | 'selection') => void;
  release: (editor: Editor) => void;
  apply: (command: (chain: ChainedCommands) => ChainedCommands) => void;
}

// The live editor and its selection are UI state, never part of saved projects.
export const useTextSelection = create<TextSelectionState>((set, get) => ({
  editor: null, blockId: null, range: null, scope: 'block', revision: 0,
  activate: (blockId, editor) => {
    const { from, to } = editor.state.selection;
    const range = from !== to ? { from, to } : null;
    const previous = get();
    set({ blockId, editor, range, scope: range ? (previous.editor === editor && previous.range ? previous.scope : 'selection') : 'block', revision: previous.revision + 1 });
  },
  sync: (editor, newSelection = false) => {
    const current = get();
    if (current.editor !== editor) return;
    const { from, to } = editor.state.selection;
    const range = from !== to ? { from, to } : null;
    set({ range, scope: range ? (newSelection || !current.range ? 'selection' : current.scope) : 'block', revision: current.revision + 1 });
  },
  setScope: scope => set({ scope: scope === 'selection' && !get().range ? 'block' : scope }),
  release: editor => { if (get().editor === editor) set({ editor: null, blockId: null, range: null, scope: 'block' }); },
  apply: command => {
    const { editor, range, scope } = get();
    if (!editor || editor.isDestroyed || !range || scope !== 'selection') return;
    // Keep focus in the inspector so number and color inputs remain usable.
    command(editor.chain().setTextSelection(range)).setMeta('qusu-discrete', true).run();
  },
}));
