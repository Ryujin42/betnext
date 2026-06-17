import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: Number(process.env.ADMIN_PORT ?? 5174),
    proxy: {
      // Le gateway BetNext expose les routes JSON sous `/auth/*`, `/admin/*`, etc.
      // En dev on les relaie pour éviter les CORS.
      '/auth': process.env.VITE_GATEWAY_URL ?? 'http://localhost:3000',
      '/admin': process.env.VITE_GATEWAY_URL ?? 'http://localhost:3000',
      '/events': process.env.VITE_GATEWAY_URL ?? 'http://localhost:3000',
      '/users': process.env.VITE_GATEWAY_URL ?? 'http://localhost:3000',
      '/me': process.env.VITE_GATEWAY_URL ?? 'http://localhost:3000',
    },
  },
});
