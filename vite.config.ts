import { defineConfig } from 'vite';

export default defineConfig(({ command }) => {
  return {
    // dynamically set base path for GitHub Pages
    base: command === 'build' ? '/number-snake-arena/' : '/',
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
    },
    server: {
      port: 3000,
    }
  };
});
