import 'dotenv/config'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    tanstackStart({
      customViteReactPlugin: true,
      tsr: {
        srcDirectory: './app',
        routesDirectory: './app/routes',
        generatedRouteTree: './app/routeTree.gen.ts',
      },
    }),
    react(),
    tailwindcss(),
    tsConfigPaths({ projects: ['./tsconfig.json'] }),
  ],
})
