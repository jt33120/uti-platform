import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const DEPLOYED_BACKEND_URL = 'https://vps-cc93f2a8.vps.ovh.net';

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
