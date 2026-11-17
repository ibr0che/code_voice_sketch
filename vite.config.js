import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Tauri expects a fixed port
  server: {
    port: 1420,
    strictPort: true,
  },
  // Tauri needs relative paths in production
  base: '/',
  build: {
    outDir: 'dist',
    // Don't minify for easier debugging; Tauri will bundle anyway
    minify: !process.env.TAURI_DEBUG,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
})
