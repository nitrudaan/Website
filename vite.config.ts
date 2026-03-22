import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isDev = mode === 'development';
    return {
      server: {
        port: 3000,
        host: 'localhost',
      },
      build: {
        sourcemap: isDev ? true : false,
        minify: isDev ? false : 'terser',
        // Production security settings
        terserOptions: isDev ? undefined : {
          compress: {
            drop_console: true,      // Remove all console.* calls
            drop_debugger: true,     // Remove debugger statements
            pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
          },
          mangle: {
            safari10: true,
          },
          format: {
            comments: false,         // Remove all comments
          },
        },
        rollupOptions: {
          output: {
            // Obfuscate chunk names in production
            chunkFileNames: isDev ? '[name]-[hash].js' : 'assets/[hash].js',
            entryFileNames: isDev ? '[name]-[hash].js' : 'assets/[hash].js',
            assetFileNames: isDev ? '[name]-[hash].[ext]' : 'assets/[hash].[ext]',
          }
        }
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
