import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// App.js e os utilitários usam JSX em arquivos .js
export default defineConfig({
  // Caminhos relativos: funciona em usuario.github.io/qualquer-nome-de-repo/
  base: "./",
  plugins: [react({ include: /\.(js|jsx)$/ })],
  esbuild: {
    loader: "jsx",
    include: /src\/.*\.jsx?$/,
    exclude: []
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom"],
          icons: ["lucide-react"]
        }
      }
    }
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: { ".js": "jsx" }
    }
  }
});
