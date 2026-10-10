import { Mark } from '@tiptap/core';

// One mark keeps independently edited attributes on the same selected text.
export const InlineStyle = Mark.create({
  name: 'inlineStyle',
  addAttributes() {
    return Object.fromEntries(['color', 'fontSize', 'fontWeight', 'backgroundColor'].map(key => [key, {
      default: null,
      parseHTML: (element: HTMLElement) => element.style[key as 'color' | 'fontSize' | 'fontWeight' | 'backgroundColor'] || null,
      renderHTML: () => ({}),
    }]));
  },
  parseHTML() { return [{ tag: 'span[style]', getAttrs: (element: HTMLElement) => {
    const style = (element as HTMLElement).style;
    return style.color || style.fontSize || style.fontWeight || style.backgroundColor ? {} : false;
  } }]; },
  renderHTML({ mark }) {
    const style = Object.entries(mark.attrs).filter(([,value]) => value).map(([key,value]) => `${key.replace(/[A-Z]/g,c=>`-${c.toLowerCase()}`)}:${value}`).join(';');
    return ['span', { style }, 0];
  },
});
