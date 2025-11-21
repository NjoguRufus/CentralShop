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
          { src: "/icons/CentalDarkmode.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/CentalDarkmode.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/CentalDarkmode.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
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
            urlPattern: ({ request }) => request.mode === "navigate",
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
            urlPattern: ({ request }) => request.destination === "script" || request.destination === "style",
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
        enabled: true,
        type: 'module'
      }
    })
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['html2pdf.js'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Code splitting for better performance
          // Keep all React-related packages together to avoid forwardRef issues
          if (id.includes('node_modules')) {
            // Bundle all React ecosystem together
            if (
              id.includes('react') || 
              id.includes('react-dom') || 
              id.includes('react/jsx-runtime') ||
              id.includes('react-router') ||
              id.includes('scheduler')
            ) {
              return 'vendor-react';
            }
            if (id.includes('firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('@google/generative-ai')) {
              return 'vendor-ai';
            }
            return 'vendor';
          }
        },
      },
    },
    commonjsOptions: {
      include: [/html2pdf\.js/, /node_modules/],
    },
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    // Ensure proper module resolution
    target: 'esnext',
    minify: 'esbuild',
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
