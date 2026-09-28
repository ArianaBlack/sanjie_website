import type { APIRoute } from 'astro';

/**
 * robots.txt 在构建时生成，Sitemap 地址直接取自 astro.config.mjs 的 `site`。
 *
 * ⚠️ 不要再改回 public/robots.txt —— 静态文件里的域名是写死的，
 *    换域名（或从 workers.dev 换成自有域名）时极容易漏改，导致搜索引擎
 *    抓到一串 404 的 sitemap 地址。
 */
export const GET: APIRoute = ({ site }) => {
  const sitemap = site ? new URL('sitemap-index.xml', site).href : '';

  const body = [
    'User-agent: *',
    'Allow: /',
    ...(sitemap ? ['', `Sitemap: ${sitemap}`] : []),
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
