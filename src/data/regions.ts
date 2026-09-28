/**
 * 中国行政区划 → 地理大区映射。
 *
 * 合作中心按大区分组展示，大区由中心所在省份推导，**不在内容文件里冗余字段** ——
 * 少一个字段就少一类填错的机会。
 *
 * ⚠️ 省份必须写标准全称（「浙江省」而不是「浙江」，写错会在构建时直接报错，
 *    这是刻意设计的：宁可构建失败，也不要让某家中心静默地从网站上消失。
 */

export const REGION_ORDER = [
  '华北',
  '东北',
  '华东',
  '华中',
  '华南',
  '西南',
  '西北',
  '港澳台',
] as const;

export type Region = (typeof REGION_ORDER)[number];

/** 大区在页面上的锚点 id（ASCII，避免中文锚点在部分浏览器里跳转异常） */
export const REGION_ANCHOR: Record<Region, string> = {
  华北: 'huabei',
  东北: 'dongbei',
  华东: 'huadong',
  华中: 'huazhong',
  华南: 'huanan',
  西南: 'xinan',
  西北: 'xibei',
  港澳台: 'gang-aotai',
};

export const REGION_BY_PROVINCE: Record<string, Region> = {
  // 华北
  北京市: '华北',
  天津市: '华北',
  河北省: '华北',
  山西省: '华北',
  内蒙古自治区: '华北',

  // 东北
  辽宁省: '东北',
  吉林省: '东北',
  黑龙江省: '东北',

  // 华东
  上海市: '华东',
  江苏省: '华东',
  浙江省: '华东',
  安徽省: '华东',
  福建省: '华东',
  江西省: '华东',
  山东省: '华东',

  // 华中
  河南省: '华中',
  湖北省: '华中',
  湖南省: '华中',

  // 华南
  广东省: '华南',
  广西壮族自治区: '华南',
  海南省: '华南',

  // 西南
  重庆市: '西南',
  四川省: '西南',
  贵州省: '西南',
  云南省: '西南',
  西藏自治区: '西南',

  // 西北
  陕西省: '西北',
  甘肃省: '西北',
  青海省: '西北',
  宁夏回族自治区: '西北',
  新疆维吾尔自治区: '西北',

  // 港澳台
  香港特别行政区: '港澳台',
  澳门特别行政区: '港澳台',
  台湾省: '港澳台',
};

/**
 * 由省份推导大区。
 *
 * 查不到时**直接抛错**而不是归入「其他」—— 这样在 Cloudflare 构建日志里
 * 一眼就能看到是哪个中心、哪个省名写错了，比在页面上发现少了一家中心要早得多。
 */
export function regionOf(province: string, centerName: string): Region {
  const region = REGION_BY_PROVINCE[province];
  if (!region) {
    throw new Error(
      `[合作中心] 「${centerName}」的省份「${province}」无法识别。` +
        `请在 src/content/centers/ 对应文件里使用标准行政区划全称，` +
        `例如「浙江省」「内蒙古自治区」「广西壮族自治区」。` +
        `如果确实需要新增省份，请补充到 src/data/regions.ts 的 REGION_BY_PROVINCE。`
    );
  }
  return region;
}

/** 按预设顺序给大区排序 */
export function regionIndex(region: Region): number {
  return REGION_ORDER.indexOf(region);
}
