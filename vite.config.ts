/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // Relative base so the build works under the GitHub Pages sub-path.
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    // Emit CSVs as separate files (no base64 inlining) so `npm run check:dist` can see them.
    assetsInlineLimit: (filePath) => (filePath.endsWith('.csv') ? false : undefined),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
})
