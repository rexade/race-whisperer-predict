import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      // ATG racing data goes straight to the public API — the frontend works in
      // dev without the FastAPI backend running (matches production rewrites).
      '/api/atg': {
        target: 'https://www.atg.se/services/racinginfo/v1/api',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/atg/, ''),
      },
      // Everything else under /api (weights, MAE) still needs the local backend.
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Ensure consistent chunk naming for better caching
    rollupOptions: {
      output: {
        // Ensure assets are in the assets folder
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },
});
