import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export default defineConfig(({ command, isPreview }) => {
  return {
    define: {
      __BUILD_INFO__: JSON.stringify({
        version: JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version,
        commit: process.env.GITHUB_SHA || execSync('git rev-parse HEAD').toString().trim(),
        builtAt: new Date().toISOString(),
      }),
    },
    // dynamically set base path for GitHub Pages
    base: command === 'build' || isPreview ? '/number-snake-arena/' : '/',
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
    },
    server: {
      port: 3000,
    }
  };
});
