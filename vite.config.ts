import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves a project site under /<repo>/, so the build needs that
// sub-path as its base. Local dev/preview (and the Cloudflare tunnel) stay at
// root. The deploy workflow sets GITHUB_PAGES=true to switch this on.
const base = process.env.GITHUB_PAGES ? '/WC-SweepStake/' : '/';

// The PWA manifest is defined here so the build emits manifest.webmanifest and
// registers a service worker. Replace the icons in /public/icons with final art.
export default defineConfig({
  base,
  // Accept any Host header on the preview server so a Cloudflare quick-tunnel
  // (random *.trycloudflare.com URL each run) can serve the app to a phone over
  // HTTPS — Web Crypto (randomUUID / subtle.digest) needs a secure context.
  preview: {
    allowedHosts: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'The Sweep — World Cup 26',
        short_name: 'The Sweep',
        description: 'A provably-fair 2026 World Cup sweepstake.',
        theme_color: '#0a0b0a',
        background_color: '#0a0b0a',
        display: 'standalone',
        orientation: 'portrait',
        // start_url/scope must respect the deploy base so "Add to Home Screen"
        // launches the app at the right path on GitHub Pages.
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // App shell is precached; the world geometry is bundled, so the reveal
        // map works fully offline once installed.
        globPatterns: ['**/*.{js,css,html,png,svg,json,woff2}']
      }
    })
  ]
});
