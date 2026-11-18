import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

// jsPDF loads these only for features this app does not use (HTML and SVG rendering).
// Pointing them at an empty module keeps them out of the single file.
const empty = fileURLToPath(new URL('./src/empty.ts', import.meta.url));

export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  resolve: { alias: { html2canvas: empty, dompurify: empty, canvg: empty } },
  build: { target: 'es2022' },
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
});
