import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/console/',
  server: {
    port: 5173,
    proxy: {
      '/admin': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
