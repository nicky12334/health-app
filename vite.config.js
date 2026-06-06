import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Allow the dev server to be reached from a phone on the same network / tunnel.
  server: { host: true },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Nutrition Tracker',
        short_name: 'Nutrition',
        description: 'Track macros, micros and additives. Scan barcodes or quick-add.',
        theme_color: '#160f14',
        background_color: '#160f14',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        // Cache the app shell; Open Food Facts requests fall back to network.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://world.openfoodfacts.org',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'off-api',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ]
      }
    })
  ]
})
