import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth':     { target: 'http://localhost:8000', changeOrigin: true },
      '/sessions': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
  build: {
    // Drop the compiled bundle straight into the folder FastAPI already serves
    outDir: '../backend/static',
    emptyOutDir: true,
  },
});
