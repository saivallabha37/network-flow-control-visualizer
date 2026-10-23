import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@agent': path.resolve(__dirname, '../agent/src'),
    },
  },
  server: {
    port: 5173,
  },
});

