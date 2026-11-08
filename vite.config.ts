import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import electron from 'vite-plugin-electron/simple';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    electron({
      main: { entry: 'src/main/index.ts' },
      preload: {
        input: 'src/main/preload.ts',
        vite: {
          build: {
            rollupOptions: {
              output: { format: 'cjs', entryFileNames: 'preload.cjs' },
            },
          },
        },
      },
      // Renderer uses the contextBridge API; Node integration stays disabled.
    }),
  ],
  resolve: {
    alias: {
      '@shared': path.resolve(import.meta.dirname, 'src/shared'),
      '@renderer': path.resolve(import.meta.dirname, 'src/renderer'),
    },
  },
});
