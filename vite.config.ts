import { defineConfig } from 'vite';

// Relative base so the same build serves both the Dokploy VPS root and
// GitHub Pages subpath (/-outpost-trainer/).
export default defineConfig({
  base: './',
});
