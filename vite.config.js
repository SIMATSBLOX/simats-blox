import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/simats-blox/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('/blockly/')) return 'vendor-blockly';
          if (id.includes('/recharts/')) return 'vendor-charts';
          if (id.includes('/socket.io-client/')) return 'vendor-socket';
          if (id.includes('/@supabase/')) return 'vendor-supabase';
          // Let Rollup choose optimal default chunking for everything else.
          return;
        },
      },
    },
  },
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
