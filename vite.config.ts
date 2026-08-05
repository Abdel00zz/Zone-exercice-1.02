
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// FIX: Polyfill __dirname for ESM compatibility in Vite config
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// NOTE : le `define` qui injectait GEMINI_API_KEY dans le bundle a été retiré.
// Aucun code ne l'utilisait, et une clé présente dans le .env se serait
// retrouvée en clair dans le JavaScript servi aux navigateurs.
export default defineConfig({
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    }
  }
});
