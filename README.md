# 三杰消防官网

消防工程公司的展示网站。五大业务独立子页，维保合作中心按地区分组展示。

---

## 技术栈

| 项 | 版本 | 说明 |
|---|---|---|
| Astro | 7.3.3 | 静态站点生成，SEO 与首屏性能优先 |
| Tailwind CSS | 4.3.3 | 通过 `@tailwindcss/vite` 接入 |
| Cloudflare Workers Static Assets | — | 静态托管（Pages 已进入维护模式） |
| Node | 22（CI 固定） | Astro 6 起已放弃 Node 18/20 |

**架构约束：零 Cloudflare 专有依赖。** 全站纯静态，不使用 Workers Functions / KV / D1。
将来若要做 ICP 备案迁往境内，只需上传 `dist/` 并改 DNS，**代码不用改**。

---

## 常用命令

```bash
npm install          # 安装依赖
npm run dev          # 本地开发，默认 http://localhost:4321
npm run build        # 构建到 dist/
npm run preview      # 预览构建产物

npm run check            # TypeScript / Astro 类型检查
npm run check:compliance # 《广告法》禁用词扫描
npm run verify           # 上面两个 + 构建，发布前跑这个

npm run deploy       # 本地构建并部署到 Cloudflare（需先 wrangler login）
```

---

## 目录结构

```
src/
├─ content.config.ts        内容集合的 schema 定义（注意：不在 src/content/ 内）
├─ content/                 所有内容都在这里，一个文件 = 一条内容
│  ├─ services/             五大业务页
│  ├─ centers/              维保合作中心
│  ├─ cases/                工程案例
│  ├─ news/                 新闻资讯
│  └─ qualifications/       资质证书（单个 YAML）
├─ data/
│  ├─ site.ts               ⭐ 公司基本信息填这里
│  ├─ regions.ts            省份 → 大区映射
│  └─ services.ts           五大业务的固定 slug
├─ lib/
│  ├─ content.ts            内容查询（统一过滤草稿 + 生产环境缓存）
│  └─ centers.ts            合作中心的大区/城市分组与排序
├─ layouts/ components/ pages/ assets/
└─ styles/global.css        设计系统（配色、字体、排版）

public/                     静态文件：favicon、robots.txt、_headers、_redirects
scripts/check-compliance.mjs 《广告法》合规扫描
web_material/               素材收件箱（已 gitignore，只在本地）
```

---

## 关于内容维护

**改内容不需要懂代码。** 详见 [CONTENT_GUIDE.md](./CONTENT_GUIDE.md)。

几个关键设计：

- **加一家合作中心 = 加一个 md 文件**，列表页、详情页、分组全部自动生成
- **导航从内容自动派生**，加业务只需加一个 md 文件
- **新闻栏目按文章数自动显示/隐藏**（少于 6 篇时隐藏，避免展示一个荒废的栏目）
- **合作中心数量少时自动降级**：只有 1 个大区时不显示锚点导航和分组标题
- 文件名一律用小写英文/拼音，中文只写在文件内容里（中文 URL 分享到微信会变成乱码）

---

## 部署

Workers Builds 连接 GitHub 仓库，push 到 `main` 自动构建上线。

| 配置项 | 值 |
|---|---|
| 构建命令 | `npm run build` |
| 部署命令 | `npx wrangler deploy` |
| 输出目录 | `dist` |
| 环境变量 | `NODE_VERSION=22` |

### 环境变量（在 Cloudflare 后台设置）

| 变量 | 说明 | 为空时 |
|---|---|---|
| `SITE_URL` | 正式域名，canonical 与 sitemap 依赖它 | 用 `astro.config.mjs` 里的默认值 |
| `PUBLIC_ICP_NO` | ICP 备案号 | 页脚整行不渲染 |
| `PUBLIC_POLICE_NO` | 公安联网备案号 | 同上 |
| `PUBLIC_BAIDU_TONGJI_ID` | 百度统计 ID | 不加载统计脚本 |
| `PUBLIC_FORM_ENDPOINT` | 留言表单接收地址 | 表单降级为「请打电话/加微信」提示卡 |

> ⚠️ **绝不要填写假的或借用他人的备案号**，那是违法行为。

### 关于 ICP 备案

Cloudflare 不是境内接入商，**部署在 Cloudflare 上的站点无法办理 ICP 备案**。
且免费版会把大陆访客调度到海外节点（首屏常在 300–800ms 起步），这是架构层面无解的。

因此代码严格保持「零 Cloudflare 绑定」——将来若要备案，把同一份 `dist/` 传到境内
对象存储 + CDN 并改 DNS 即可。

---

## ⚠️ 上线前检查清单

已完成：

- [x] 公司信息、对外电话已换成真实信息（`src/data/site.ts`）
- [x] 已删除 `src/content/centers/` 下的示例数据
- [x] `certificates.yaml` 已换成真实证书（消防设施工程专业承包壹级）
- [x] `robots.txt` 改为构建时生成，Sitemap 域名自动跟随 `site` 配置
- [x] 31 个工程案例已录入，29 张配图已优化

上线前仍需确认：

- [ ] **在 Cloudflare 设置 `SITE_URL` 为正式域名。** 不设的话 canonical / sitemap /
      og:url 会全部写成 `sanjie-fire.workers.dev`（这个域名在大陆被 DNS 污染，且不是你的真实地址）
- [ ] `npm run verify` 通过（0 错误 + 0 合规阻断项）
- [ ] 确认公司实际持有的资质与 `qualifications` 一致（**没有的不能写**）
- [ ] 确认 `site.ts` 里 `stats` 的数字真实可核查
- [ ] 合作中心的电话与名称已获得书面公开授权
- [ ] 组织架构图里「装修事业部 / 智能化事业部 / 电力事业部」与公司实际经营范围不冲突
- [ ] 团建照片已取得出镜同事（含已离职者）的肖像使用同意
- [ ] 湘乡合作中心（`src/content/centers/xiangxiang.md`）补齐信息后把 `draft` 改为 `false`
