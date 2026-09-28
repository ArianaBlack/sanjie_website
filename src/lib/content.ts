import { getCollection, type CollectionEntry } from 'astro:content';
import type { ServiceSlug } from '../data/services';

/**
 * 内容查询的统一入口。
 *
 * 所有查询都在这里统一过滤草稿（生产构建才过滤，本地开发能看到 draft: true 的内容），
 * 避免每个组件各写一遍过滤条件、漏掉某处。
 */

export type ServiceEntry = CollectionEntry<'services'>;
export type CaseEntry = CollectionEntry<'cases'>;
export type NewsEntry = CollectionEntry<'news'>;
export type QualificationEntry = CollectionEntry<'qualifications'>;

const visible = ({ data }: { data: { draft?: boolean } }) =>
  import.meta.env.PROD ? !data.draft : true;

/**
 * 生产构建时缓存查询结果。
 *
 * 两个原因：
 *   1. Header 和 Footer 在每个页面都会查一次，16 个页面就是 32 次重复查询
 *   2. 内容集合为空时 Astro 会打警告，不缓存的话这个警告会按页刷屏，
 *      把 Cloudflare 的构建日志淹掉
 *
 * 开发模式下**不缓存** —— 否则新增内容后要重启 dev server 才能看到。
 */
const cache = new Map<string, Promise<unknown>>();

function memo<T>(key: string, factory: () => Promise<T>): Promise<T> {
  if (!import.meta.env.PROD) return factory();

  const hit = cache.get(key);
  if (hit) return hit as Promise<T>;

  const promise = factory();
  cache.set(key, promise);
  return promise;
}

/** 五大业务，按 order 排序 —— 导航与列表都以此为准 */
export async function getServices(): Promise<ServiceEntry[]> {
  return memo('services', async () => {
    const services = await getCollection('services', visible);
    return services.sort((a, b) => a.data.order - b.data.order);
  });
}

/** slug → 导航短名，用于合作中心的能力标签 */
export async function getServiceLabels(): Promise<Map<ServiceSlug, string>> {
  return memo('serviceLabels', async () => {
    const services = await getServices();
    // glob() loader 下 entry.id 即文件名（不含扩展名），正好就是 slug
    return new Map(services.map((s) => [s.id as ServiceSlug, s.data.navLabel]));
  });
}

export async function getCases(): Promise<CaseEntry[]> {
  return memo('cases', async () => {
    const cases = await getCollection('cases', visible);
    return cases.sort((a, b) => {
      if (a.data.featured !== b.data.featured) return a.data.featured ? -1 : 1;
      if (a.data.weight !== b.data.weight) return a.data.weight - b.data.weight;
      // 未填竣工时间的排在后面，不参与时间比较
      const at = a.data.completedAt?.valueOf() ?? -Infinity;
      const bt = b.data.completedAt?.valueOf() ?? -Infinity;
      return bt - at;
    });
  });
}

export async function getNews(): Promise<NewsEntry[]> {
  return memo('news', async () => {
    const news = await getCollection('news', visible);
    return news.sort(
      (a, b) => b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf()
    );
  });
}

/** 可公开展示的资质 */
export async function getQualifications(): Promise<QualificationEntry[]> {
  return memo('qualifications', async () => {
    const list = await getCollection('qualifications');
    return list
      .filter((q) => q.data.publicOk)
      .sort((a, b) => a.data.weight - b.data.weight);
  });
}

/**
 * 新闻栏目是否显示在导航里。
 *
 * 少于 6 篇时隐藏 —— 一个长期不更新的新闻栏目反而会拉低网站可信度，
 * 不如先不显示。文章数够了会自动出现，不需要改代码。
 */
export async function shouldShowNews(): Promise<boolean> {
  const news = await getNews();
  return news.length >= 6;
}
