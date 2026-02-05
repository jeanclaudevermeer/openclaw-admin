import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

const HOST = process.env.OPENCLAW_ADMIN_HOST || '127.0.0.1';
const PORT = parseInt(process.env.OPENCLAW_ADMIN_PORT || '5180', 10);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: PORT,
    host: HOST,
    proxy: {
      '/api': {
        target: `http://${HOST}:${PORT + 1}`,
        changeOrigin: true,
      },
    },
  },
});
