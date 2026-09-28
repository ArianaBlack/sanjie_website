import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';
import { SERVICE_SLUGS } from './data/services';

/*
  ⚠️ Astro 7 的内容集合定义注意事项：
    - 本文件位置是 src/content.config.ts，**不是** src/content/config.ts（后者已在 Astro 6 移除）
    - 集合必须显式声明 loader
    - 条目没有 slug 字段，一律用 entry.id；glob() 下 id 即相对路径去扩展名
    - 渲染用 import { render } from 'astro:content' 后 render(entry)，不再是 entry.render()
    - 模板文件靠 pattern 的排除项过滤：以 _ 开头的 md 文件不会成为一条真实内容
      （注意：这条注释里不能直接写那个 glob，因为其中的结束符会提前闭合块注释）
*/

/** 只在生产构建时过滤草稿；本地开发可以看到 draft: true 的内容 */
const publishedOnly = ({ data }: { data: { draft?: boolean } }) =>
  import.meta.env.PROD ? !data.draft : true;

const serviceSlug = z.enum(SERVICE_SLUGS);

/** 各集合共用的 SEO 字段 */
const seoSchema = z
  .object({
    title: z.string().optional(),
    description: z.string().max(200).optional(),
    keywords: z.array(z.string()).default([]),
    noindex: z.boolean().default(false),
  })
  .default({ keywords: [], noindex: false });

/* ---------------------------------------------------------------- 业务 */

const services = defineCollection({
  loader: glob({
    pattern: ['**/*.md', '!**/_*.md'],
    base: './src/content/services',
  }),
  schema: ({ image }) =>
    z.object({
      /** 页面大标题 */
      title: z.string(),
      /** 导航栏短名，≤8 字 */
      navLabel: z.string().max(8),
      /** 导航与列表顺序，1–5 */
      order: z.number().int(),
      /** 一句话卖点，卡片与首屏用 */
      tagline: z.string(),
      /** 摘要，用于卡片与 SEO description 兜底 */
      summary: z.string().min(20).max(240),
      /** 首屏图（可选 —— 没图时用品牌色渐变兜底） */
      hero: image().optional(),
      /** 适用场所 / 服务对象 */
      audience: z.array(z.string()).default([]),
      /** 服务内容清单 */
      scope: z
        .array(z.object({ title: z.string(), desc: z.string().optional() }))
        .default([]),
      /** 服务优势 */
      advantages: z
        .array(z.object({ title: z.string(), desc: z.string() }))
        .default([]),
      /** 服务流程 */
      process: z
        .array(
          z.object({
            title: z.string(),
            desc: z.string(),
            duration: z.string().optional(),
          })
        )
        .default([]),
      /** 依据的国家标准编号 —— 消防行业含金量最高的信任信号 */
      standards: z.array(z.string()).default([]),
      /**
       * 标准区块的标题与副标题。
       * 默认是「依据的标准规范 / 按现行国家标准执行」，
       * 但技术咨询类业务依据的是政策法规而非国标，需要单独覆盖措辞。
       */
      standardsTitle: z.string().optional(),
      standardsSubtitle: z.string().optional(),
      /** 常见问题 */
      faqs: z
        .array(z.object({ q: z.string(), a: z.string() }))
        .default([]),
      /** 报价方式 */
      pricing: z
        .object({ mode: z.string(), note: z.string().optional() })
        .optional(),
      /** 关联案例的 id */
      relatedCases: z.array(z.string()).default([]),
      /** 是否在页面里嵌入「维保合作中心」模块（仅消防维保为 true） */
      showCenters: z.boolean().default(false),
      centersIntro: z.string().optional(),
      draft: z.boolean().default(false),
      seo: seoSchema,
    }),
});

/* ---------------------------------------------------------- 合作中心 */

const centers = defineCollection({
  loader: glob({
    pattern: ['**/*.md', '!**/_*.md'],
    base: './src/content/centers',
  }),
  schema: ({ image }) =>
    z.object({
      /** 中心全称，如「三杰消防·杭州维保合作中心」 */
      name: z.string(),
      /** 卡片上显示的短名，如「杭州中心」 */
      shortName: z.string().optional(),
      /** 省 —— 必须写标准全称，如「浙江省」 */
      province: z.string(),
      /** 市 —— 标准名称，如「杭州市」 */
      city: z.string(),
      /** 区县 */
      district: z.string().optional(),
      /** 极少数跨区归属异常时的逃生口 */
      regionOverride: z.string().optional(),

      address: z.string(),
      /** 经纬度，格式 "120.123456,30.123456" */
      coordinates: z.string().optional(),

      phone: z.string(),
      hotline: z.string().optional(),
      contact: z.string().optional(),
      hours: z.string().default('周一至周日 08:30–18:00'),

      /** 能力标签，取自五大业务 */
      services: z.array(serviceSlug).min(1),
      /** 覆盖城市，用于「就近服务」文案 */
      serviceArea: z.array(z.string()).default([]),
      /** 成立年份 */
      since: z.number().int().optional(),
      /** 该中心的资质说明 */
      qualifications: z.array(z.string()).default([]),

      /** 中心简介正文（Markdown 正文渲染） */
      cover: image().optional(),
      gallery: z.array(image()).default([]),

      featured: z.boolean().default(false),
      /** 排序权重，越小越靠前；省会可设 10 */
      weight: z.number().default(100),
      draft: z.boolean().default(false),
      seo: seoSchema,
    }),
});

/* ---------------------------------------------------------- 工程案例 */

const cases = defineCollection({
  loader: glob({
    pattern: ['**/*.md', '!**/_*.md'],
    base: './src/content/cases',
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      /** 所属业务 */
      category: serviceSlug,
      /** 甲方名称。未获授权时必须脱敏，如「某大型商业综合体」 */
      client: z.string(),
      /** 甲方名称是否已获公开授权 */
      clientPublic: z.boolean().default(false),
      province: z.string(),
      city: z.string(),
      projectType: z.enum([
        '住宅',
        '商业综合体',
        '写字楼',
        '酒店',
        '医院',
        '学校',
        '厂房工业',
        '仓储物流',
        '数据中心',
        '地下车库',
        '市政公共',
        '其他',
      ]),
      /** 项目规模，如「8.5 万平方米」 */
      scale: z.string().optional(),
      /** 合同金额，可写区间或「面议」 */
      amount: z.string().optional(),
      /**
       * 竣工时间 —— 可选。
       * ⚠️ 宁可留空也不要为了填满字段而估一个日期：案例页会公开展示，
       *    写错的竣工时间属于虚假宣传。拿不准就空着，页面上自动不显示这一行。
       */
      completedAt: z.coerce.date().optional(),
      durationDays: z.number().optional(),

      scope: z.array(z.string()).default([]),
      /** 项目难点 */
      challenge: z.string().optional(),
      /** 解决方案 */
      solution: z.string().optional(),
      /** 成果与验收结论 */
      result: z.string().optional(),
      /** 甲方评价 */
      testimonial: z
        .object({ quote: z.string(), author: z.string() })
        .optional(),

      cover: image().optional(),
      gallery: z.array(image()).default([]),

      /**
       * 改造前后对比 —— 消防改造业务最有力的素材。
       * 拍摄要求：同机位、同角度、同焦段，光线条件尽量接近。
       */
      beforeAfter: z
        .array(
          z.object({
            before: image(),
            after: image(),
            caption: z.string().optional(),
          })
        )
        .default([]),

      featured: z.boolean().default(false),
      weight: z.number().default(100),
      draft: z.boolean().default(false),
      seo: seoSchema,
    }),
});

/* ---------------------------------------------------------- 新闻资讯 */

const news = defineCollection({
  loader: glob({
    pattern: ['**/*.md', '!**/_*.md'],
    base: './src/content/news',
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      category: z.enum(['公司动态', '行业政策', '消防知识']),
      publishedAt: z.coerce.date(),
      updatedAt: z.coerce.date().optional(),
      summary: z.string().max(200),
      cover: image().optional(),
      author: z.string().default('三杰消防'),
      /** 转载必须注明来源 */
      source: z
        .object({ name: z.string(), url: z.url().optional() })
        .optional(),
      tags: z.array(z.string()).default([]),
      featured: z.boolean().default(false),
      draft: z.boolean().default(false),
      seo: seoSchema,
    }),
});

/* ------------------------------------------------------ 资质与荣誉 */

/*
  用单个 YAML 而非 Markdown —— 这是「一堆图片 + 几个字段」的扁平清单，不需要正文。
  file() loader 下，YAML 的顶层键即为 entry.id。
*/
const qualifications = defineCollection({
  loader: file('./src/content/qualifications/certificates.yaml'),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      /** 发证机关 */
      issuer: z.string(),
      number: z.string().optional(),
      /** 有效期至，可写「长期」 */
      validUntil: z.string().optional(),
      category: z.enum([
        '主体资质',
        '行业资质',
        '体系认证',
        '人员证书',
        '荣誉奖项',
        '协会会员',
      ]),
      image: image().optional(),
      /** 是否可公开展示。false 则前台不展示，仅内部留档 */
      publicOk: z.boolean().default(true),
      weight: z.number().default(100),
    }),
});

export const collections = {
  services,
  centers,
  cases,
  news,
  qualifications,
};

export { publishedOnly };
