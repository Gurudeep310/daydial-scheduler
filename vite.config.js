// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // Updates the app automatically when you push to GitHub
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'DayDial',
        short_name: 'DayDial',
        description: 'Plan your day, own your time.',
        theme_color: '#f8fafc', // Matches your light mode bg
        background_color: '#f8fafc',
        display: 'standalone', // Hides the browser URL bar
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png', // You need to add these icons to your public folder
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
})