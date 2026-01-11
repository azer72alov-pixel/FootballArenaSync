import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: '.', // Explicitly set root to current directory
  base: '/',
  resolve: {
    alias: {
      '@': resolve(__dirname, './')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html') // Force use of root index.html
      }
    }
  },
  server: {
    host: true
  }
})