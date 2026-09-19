import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg', 'see fish logo.png', 'notebook_pen_favicon.jpg'],
      manifest: {
        name: 'সামুদ্রিক মাছ নোটবুক',
        short_name: 'নোটবুক',
        description: 'হিসাব নিকাশের নোটবুক - Samudrik Mach Notebook',
        theme_color: '#00311f',
        background_color: '#00311f',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
});
