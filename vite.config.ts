import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',         // важно для путей на Vercel
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
