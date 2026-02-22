import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 4000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-recharts': ['recharts'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-radix': [
              '@radix-ui/react-dialog',
              '@radix-ui/react-tabs',
              '@radix-ui/react-select',
              '@radix-ui/react-tooltip',
              '@radix-ui/react-switch',
              '@radix-ui/react-separator',
              '@radix-ui/react-scroll-area',
              '@radix-ui/react-avatar',
              '@radix-ui/react-label',
              '@radix-ui/react-slot',
            ],
          },
        },
      },
    },
  };
});
