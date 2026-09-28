/**
 * 五大业务的固定标识。
 *
 * 这里的 slug 会同时用于：
 *   1. 业务页路由     /services/construction/
 *   2. 导航排序       由各业务 md 文件里的 order 字段决定
 *   3. 合作中心的能力标签
 *
 * ⚠️ 一旦上线就不要改这里的值 —— 改了等于换了网址，已收录的页面会失效。
 *    新增业务才需要在这里加一项（同时要在 navLabel 等处补上对应文案）。
 */
export const SERVICE_SLUGS = [
  'construction',
  'retrofit',
  'maintenance',
  'consulting',
  'refill',
] as const;

export type ServiceSlug = (typeof SERVICE_SLUGS)[number];
