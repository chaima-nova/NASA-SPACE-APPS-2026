import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // GitHub Pages serves project sites from /<repo>/, so production builds need
  // relative asset paths. Dev keeps the normal root base.
  base: command === 'build' ? './' : '/',
  server: {
    port: 5173,
  },
}));
