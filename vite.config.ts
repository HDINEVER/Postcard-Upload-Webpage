import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  server: {
    proxy: {
      '/v1': {
        target: 'https://appwrite1.hdinever.ccwu.cc',
        changeOrigin: true,
        secure: true,
        timeout: 600000,
        proxyTimeout: 600000,
      },
    },
  },
});