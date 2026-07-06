import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel/serverless';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel({
    webAnalytics: { enabled: false },
    maxDuration: 60,
  }),
  server: { port: 4321 },
  vite: {
    server: {
      // Don't pre-bundle the Stripe SDK; it has dynamic imports that confuse Vite.
      watch: { ignored: ['**/.vercel/**'] },
    },
  },
});
