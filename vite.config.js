import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false, // if 5173 is busy, Vite tries the next free port — use the URL it prints
    /** Listen on all interfaces so phones / other laptops on the same Wi‑Fi can open http://<your-LAN-IP>:5173 */
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3847',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:3847',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
