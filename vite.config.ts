import path from 'path';
/* eslint-disable import/no-extraneous-dependencies */
import checker from 'vite-plugin-checker';
import { loadEnv, defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// ----------------------------------------------------------------------

const PORT = 5001;

const _env = loadEnv('all', process.cwd());

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';

  return {
    // base: env.VITE_BASE_PATH,
    plugins: [
      react(),
      !isProd &&
        checker({
          typescript: true,
          eslint: {
            lintCommand: 'eslint "./src/**/*.{js,jsx,ts,tsx}"',
          },
          overlay: {
            position: 'tl',
            initialIsOpen: false,
          },
        }),
    ].filter(Boolean),
  resolve: {
    alias: [
      {
        find: /^~(.+)/,
        replacement: path.join(process.cwd(), 'node_modules/$1'),
      },
      {
        find: /^src(.+)/,
        replacement: path.join(process.cwd(), 'src/$1'),
      },
    ],
  },
  server: { port: PORT, host: true },
  preview: { port: PORT, host: true },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('@mui')) return 'vendor_mui';
            if (id.includes('react')) return 'vendor_react';
            return 'vendor';
          }
        },
      },
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
  },
  };
});
