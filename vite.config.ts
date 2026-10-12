import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// 상대 경로를 기본값으로 사용해 GitHub Pages 하위 경로도 지원한다.
export default defineConfig({
  base: process.env.LIFE_BASE_PATH ?? './',
  build: { rollupOptions: { input: {
    game: fileURLToPath(new URL('./index.html', import.meta.url)),
    diagnostics: fileURLToPath(new URL('./diagnostics.html', import.meta.url)),
  } } },
});
