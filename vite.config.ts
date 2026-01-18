import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages deployment: use repo name as base path
// Update this if your repo name is different
const repoName = 'UAT-Scenarios-Generator';

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? `/${repoName}/` : '/',
  build: {
    outDir: 'dist',
  },
});
