import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const GATEWAY = process.env.VITE_GATEWAY_URL ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy: {
      '/auth': GATEWAY,
      '/events': GATEWAY,
      '/bets': GATEWAY,
      '/wallet': GATEWAY,
      '/me': GATEWAY,
      '/socket.io': {
        target: GATEWAY,
        ws: true,
      },
    },
  },
});
