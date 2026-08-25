import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Production is served from kimberlyminer.com/RootedUpright/, but the
  // dev server still runs at the domain root
  base: command === 'build' ? '/RootedUpright/' : '/',
  server: {
    port: 5174,
    strictPort: true,
  }
}))
