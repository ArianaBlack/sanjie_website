// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// TODO: 域名确定后，把 SITE_URL 环境变量设为正式域名（如 https://www.example.com）
// 也可直接改下面的默认值。canonical、sitemap、og:url 全都依赖它。
const SITE = process.env.SITE_URL || 'https://sanjie-fire.workers.dev';

export default defineConfig({
  site: SITE,

  // 与目录式托管保持一致，避免 /about 与 /about/ 两份 URL 都被收录（技术 SEO 隐患）
  // 站内链接一律写带尾斜杠的形式
  trailingSlash: 'always',
  build: { format: 'directory' },

  integrations: [sitemap()],

  vite: {
    plugins: [tailwindcss()],
  },
});
