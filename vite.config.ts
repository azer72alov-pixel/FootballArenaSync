import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Мы убрали привязку к .env, так как ключи теперь прописаны в lib/supabase.ts.
  // Приложение будет работать сразу после загрузки.
})