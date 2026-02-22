import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: 'https://wknd-trendsetters.pages.dev',
  trailingSlash: 'never',
  build: { format: 'file' },
});
