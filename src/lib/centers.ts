import { getCollection, type CollectionEntry } from 'astro:content';
import {
  REGION_ANCHOR,
  regionIndex,
  regionOf,
  type Region,
} from '../data/regions';

export type CenterEntry = CollectionEntry<'centers'>;

export interface CityGroup {
  city: string;
  centers: CenterEntry[];
}

export interface RegionGroup {
  region: Region;
  /** 页面锚点 id */
  anchor: string;
  /** 该大区下的中心总数 */
  total: number;
  cities: CityGroup[];
}

/** 取已发布的合作中心（生产构建时过滤 draft） */
export async function getPublishedCenters(): Promise<CenterEntry[]> {
  return getCollection('centers', ({ data }) =>
    import.meta.env.PROD ? !data.draft : true
  );
}

/**
 * 取一家中心所属的大区。
 * 允许用 regionOverride 覆盖（极少数跨区归属异常的情况）。
 */
export function centerRegion(center: CenterEntry): Region {
  const override = center.data.regionOverride;
  if (override) return override as Region;
  return regionOf(center.data.province, center.data.name);
}

/** 同城内中心的排序：featured 优先 → weight 升序 → 名称 */
function compareCenters(a: CenterEntry, b: CenterEntry): number {
  if (a.data.featured !== b.data.featured) return a.data.featured ? -1 : 1;
  if (a.data.weight !== b.data.weight) return a.data.weight - b.data.weight;
  return a.data.name.localeCompare(b.data.name, 'zh-Hans-CN');
}

/**
 * 按「大区 → 城市 → 中心」三级分组。
 *
 * 排序规则：
 *   大区  按 REGION_ORDER 固定顺序
 *   城市  按该市最小 weight 升序（省会可设 weight: 10 让它排前面）→ 中心数降序 → 名称
 *   中心  featured → weight → 名称
 */
export function groupByRegion(centers: CenterEntry[]): RegionGroup[] {
  const byRegion = new Map<Region, CenterEntry[]>();

  for (const center of centers) {
    const region = centerRegion(center);
    const bucket = byRegion.get(region);
    if (bucket) bucket.push(center);
    else byRegion.set(region, [center]);
  }

  return [...byRegion.entries()]
    .map(([region, regionCenters]): RegionGroup => {
      const byCity = new Map<string, CenterEntry[]>();
      for (const center of regionCenters) {
        const bucket = byCity.get(center.data.city);
        if (bucket) bucket.push(center);
        else byCity.set(center.data.city, [center]);
      }

      const cities: CityGroup[] = [...byCity.entries()]
        .map(([city, cityCenters]) => ({
          city,
          centers: [...cityCenters].sort(compareCenters),
        }))
        .sort((a, b) => {
          const wa = Math.min(...a.centers.map((c) => c.data.weight));
          const wb = Math.min(...b.centers.map((c) => c.data.weight));
          if (wa !== wb) return wa - wb;
          if (a.centers.length !== b.centers.length) {
            return b.centers.length - a.centers.length;
          }
          return a.city.localeCompare(b.city, 'zh-Hans-CN');
        });

      return {
        region,
        anchor: REGION_ANCHOR[region],
        total: regionCenters.length,
        cities,
      };
    })
    .sort((a, b) => regionIndex(a.region) - regionIndex(b.region));
}

/** 覆盖到的省份/直辖市/自治区数量，用于统计条 */
export function countProvinces(centers: CenterEntry[]): number {
  return new Set(centers.map((c) => c.data.province)).size;
}

/** 覆盖到的城市数量，用于统计条 */
export function countCities(centers: CenterEntry[]): number {
  return new Set(centers.map((c) => c.data.city)).size;
}

/** 同城的其他中心（用于详情页内链） */
export function siblingCenters(
  center: CenterEntry,
  all: CenterEntry[]
): CenterEntry[] {
  return all
    .filter((c) => c.id !== center.id && c.data.city === center.data.city)
    .sort(compareCenters);
}

/**
 * 该中心是否属于「多城市」布局。
 *
 * 列表页据此决定要不要渲染大区锚点导航和分组标题：
 * 只有 1 个大区时（比如当前只有 2 家中心），页面直接平铺，
 * 避免出现「一条孤零零的锚点导航」。
 */
export function needsRegionChrome(groups: RegionGroup[]): boolean {
  return groups.length >= 2;
}
