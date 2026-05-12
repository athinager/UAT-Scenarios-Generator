import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages needs `/repo-name/`; Vercel serves from `/` (VERCEL=1 at build time).
const repoName = 'UAT-Scenarios-Generator';

function resolveBase(): string {
  const explicit = process.env.VITE_BASE_URL?.trim();
  if (explicit) {
    return explicit.endsWith('/') ? explicit : `${explicit}/`;
  }
  if (process.env.NODE_ENV !== 'production') return '/';
  if (process.env.VERCEL === '1') return '/';
  return `/${repoName}/`;
}

export default defineConfig({
  plugins: [react()],
  base: resolveBase(),
  build: {
    outDir: 'dist',
  },
});
