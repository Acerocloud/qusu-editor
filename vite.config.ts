import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({ plugins: [react(), tailwindcss()], build: { rollupOptions: { output: { manualChunks: { editor: ['@tiptap/react','@tiptap/starter-kit'], vendor: ['react','react-dom','@dnd-kit/core','@dnd-kit/sortable','zustand'] } } } } });
