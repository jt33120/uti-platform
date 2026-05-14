import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const DEPLOYED_BACKEND_URL = 'https://git-production-af3c.up.railway.app';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
