// vite.config.mjs

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url' // <-- 1. Importa la utilidad necesaria
import tailwindcss from '@tailwindcss/vite'

// 2. Esta es la forma moderna de "recrear" __dirname en un entorno ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // Es una buena práctica colocar tailwindcss() antes que react()
    tailwindcss(),
    react()
  ],
  resolve: {
    alias: {
      // 3. Ahora tu alias funcionará porque __dirname está definido correctamente
      '@': path.resolve(__dirname, './src'),
    },
  },
})