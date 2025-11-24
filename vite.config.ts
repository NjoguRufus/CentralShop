import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  plugins: [
    react({
      // Ensure React is properly handled
      jsxRuntime: 'automatic',
    }),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Central Shop POS",
        short_name: "Central POS",
        description: "Central Shop Point of Sale System",
        display: "standalone",
        theme_color: "#4A90A4",
        background_color: "#ffffff",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        // In dev mode, files are served from memory, so glob patterns may not match
        // This warning is harmless - precaching only matters in production
        globPatterns: mode === 'production'
          ? ['**/*.{js,css,html,ico,png,svg,woff2,webp}']
          : ['index.html'], // Minimal pattern for dev mode to avoid warnings
        globIgnores: [
          '**/node_modules/**',
          '**/.git/**',
          '**/dist/**',
          '**/dev-dist/**',
          'sw.js',
          'workbox-*.js'
        ],
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024, // 20 MB
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) => {
              // Exclude Vite dev server paths
              if (url.pathname.startsWith('/@') || 
                  url.pathname.startsWith('/src/') ||
                  url.pathname.startsWith('/node_modules/')) {
                return false;
              }
              return request.mode === "navigate";
            },
            handler: "NetworkFirst",
            options: { 
              cacheName: "pages-cache",
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 24 * 60 * 60 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: ({ request, url }) => {
              // Exclude Vite dev server paths
              if (url.pathname.startsWith('/@') || 
                  url.pathname.startsWith('/src/') ||
                  url.pathname.startsWith('/node_modules/') ||
                  url.pathname.includes('@react-refresh') ||
                  url.pathname.includes('@vite-plugin-pwa')) {
                return false;
              }
              return request.destination === "script" || request.destination === "style";
            },
            handler: "StaleWhileRevalidate",
            options: { 
              cacheName: "assets-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 7 * 24 * 60 * 60 // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: { 
              cacheName: "image-cache",
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 365 * 24 * 60 * 60 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "firestore-cache",
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 5 * 60 // 5 minutes
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.cloudinary\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "cloudinary-cache",
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/_/, /\/[^/?]+\.[^/]+$/, /^\/api/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false
      },
      devOptions: {
        enabled: false, // Disable PWA in dev mode to avoid interfering with Vite dev server
        type: 'module',
        navigateFallback: 'index.html'
      },
      // Enable PWA in production
      injectRegister: 'auto'
    })
  ],
  optimizeDeps: {
    exclude: ['lucide-react', 'react-window'],
    include: ['html2pdf.js', 'styled-components', 'xlsx', 'file-saver'],
  },
  build: {
    rollupOptions: {
      output: {
        // Simplified chunking - let Vite handle React automatically to avoid issues
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            // Only split large libraries, keep React ecosystem together
            if (id.includes('firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('@google/generative-ai')) {
              return 'vendor-ai';
            }
            if (id.includes('styled-components')) {
              return 'vendor-styled';
            }
            if (id.includes('recharts')) {
              return 'vendor-recharts';
            }
            if (id.includes('react-window')) {
              return 'vendor-react-window';
            }
            // Let Vite automatically handle React and other dependencies
            return 'vendor';
          }
        },
      },
    },
    worker: {
      format: 'es'
    },
    commonjsOptions: {
      include: [/html2pdf\.js/, /node_modules/, /styled-components/, /@zxing\/library/, /xlsx/],
    },
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false,
  },
  publicDir: 'public',
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        secure: false
      }
    }
  }
}));
