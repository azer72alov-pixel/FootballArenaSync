
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Crucial for Capacitor/Android to load assets correctly
  resolve: {
    alias: {
      '@': '/' // Maps @ to root since there is no src folder
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Ensure manifest is copied if it's in root
    rollupOptions: {
      input: {
        main: './components/index.html'
      }
    }
  },
  // Serve static files from root
  publicDir: '.' 
})