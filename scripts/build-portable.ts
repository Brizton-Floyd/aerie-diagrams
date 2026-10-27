// Build the portable reader independently so the authoring app can load it only on export.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'vite';

const root = resolve(import.meta.dirname, '..');
const outDir = resolve(root, '.portable');
await mkdir(outDir, { recursive: true });
await build({
  configFile: false,
  root,
  logLevel: 'warn',
  build: {
    outDir,
    emptyOutDir: true,
    target: 'es2023',
    cssCodeSplit: false,
    lib: {
      entry: resolve(root, 'src/portable.ts'),
      name: 'AerieReader',
      formats: ['iife'],
      fileName: () => 'reader.js',
      cssFileName: 'reader',
    },
    rolldownOptions: { output: { codeSplitting: false } },
  },
});
const [script, css] = await Promise.all([
  readFile(resolve(outDir, 'reader.js'), 'utf8'),
  readFile(resolve(outDir, 'reader.css'), 'utf8'),
]);
// Library builds inline their font assets; inject that CSS before the reader loads its fonts.
const style = JSON.stringify(css).replaceAll('<', '\\u003c');
await writeFile(
  resolve(outDir, 'reader.txt'),
  `// Aerie portable reader v1\n(()=>{const s=document.createElement('style');s.textContent=${style};document.head.append(s)})();\n${script}`,
);
