import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/chat': 'http://localhost:3000',
    },
  },
  css: {
    postcss: './postcss.config.js',
  },
});
