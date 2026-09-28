#!/usr/bin/env node
/**
 * 《广告法》合规扫描
 *
 * 《广告法》第九条禁止使用「国家级」「最高级」「最佳」等绝对化用语。
 * 消防行业官网是举报高发区，上线前必须逐句过一遍。
 *
 * 分两级：
 *   BLOCK  —— 明确违规，命中即退出码 1，必须改掉
 *   REVIEW —— 需要人工判断（「最」这类字在「最近」「最多」里是正常用法）
 *
 * 用法：
 *   node scripts/check-compliance.mjs          # 扫源码（src）
 *   node scripts/check-compliance.mjs --dist   # 扫构建产物（dist），这是真正的门禁
 *
 * 实现说明：必须正确识别注释，否则「⚠️ 禁止写『包过』」这类警告文案本身
 * 会被扫成违规——扫描器命中自己的警告是这类工具最常见的假阳性来源，
 * 而假阳性多了就会被无视，工具也就失去意义了。
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const useDist = process.argv.includes('--dist');
const ROOT = process.cwd();
const TARGET = join(ROOT, useDist ? 'dist' : 'src');

/** 明确违规：绝对化用语、结果承诺、暗示关系 */
const BLOCK = [
  '国家级',
  '最高级',
  '最佳',
  '最好',
  '最优',
  '最强',
  '最先进',
  '最专业',
  '最便宜',
  '最低价',
  '顶级',
  '顶尖',
  '第一品牌',
  '全国第一',
  '行业第一',
  '唯一一家',
  '独家',
  '100%',
  '百分之百',
  '包过',
  '保证通过',
  '必过',
  '绝对保证',
  '永久有效',
  '彻底解决',
  '与消防部门有关系',
  '内部渠道',
];

/** 需要人工复核：「最」「第一」等字在正常语句里也会出现 */
const REVIEW = ['最', '第一', '唯一', '领先', '保证', '承诺'];

/**
 * 占位文案 —— 只在扫构建产物（--dist）时作为**阻断项**。
 *
 * 源码里出现「待填写」是正常的（模板、采集表、给公司留的空），
 * 但构建产物里出现，说明有占位内容真的上线了，客户会看到「【待填写】」这几个字。
 * 这是实际踩过的坑：一页业务 FAQ 漏改，直接渲染到了页面上。
 */
const PLACEHOLDERS = ['待填写', '待补充', '待确认', '【】'];

/**
 * 剥掉 HTML 注释，保留换行以维持行号。
 *
 * 扫描构建产物时必须先做这一步：Astro 会把源码里的 HTML 注释原样输出，
 * 而压缩后注释常常不在行首（前面还有别的内容），
 * 上面那套「行首判断」的注释识别就失效了 ——
 * 结果是 `<!-- 这是最能体现专业度的地方 -->` 这类给开发者看的提示
 * 被当成正文报了出来。注释不会渲染给用户看，扫它没有意义。
 */
const stripHtmlComments = (s) => s.replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ''));

/** 截取命中词前后的上下文。构建产物是压缩过的，只取行首会看不到重点 */
function context(line, word) {
  const i = line.indexOf(word);
  if (i < 0) return line.trim().slice(0, 120);
  const start = Math.max(0, i - 60);
  const end = Math.min(line.length, i + word.length + 60);
  return `${start > 0 ? '…' : ''}${line.slice(start, end).trim()}${end < line.length ? '…' : ''}`;
}

const SCAN_EXT = useDist
  ? new Set(['.html', '.xml', '.txt'])
  : new Set(['.astro', '.md', '.ts', '.mjs', '.yaml', '.yml']);

const SKIP_DIRS = new Set([
  'node_modules',
  '.astro',
  '.git',
  'web_material',
  '_astro',
  'images',
  'scripts', // 本脚本自身
]);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;

  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (SCAN_EXT.has(extname(entry))) out.push(full);
  }
  return out;
}

/**
 * 逐行判定是否为注释，需要跨行维护状态。
 *
 * 关键差异：
 *   .md   —— 只有 <!-- --> 是注释。**「#」是标题，是正文内容，绝不能当注释跳过**
 *   .yaml —— 「#」是注释
 *   .ts / .mjs —— 「//」行注释 + 块注释
 *   .astro —— 两者都有（frontmatter 是 TS，模板部分是 HTML）
 */
function makeCommentTracker(ext) {
  const allowHash = ext === '.yaml' || ext === '.yml' || ext === '.ts' || ext === '.mjs';
  const allowSlash = ext === '.ts' || ext === '.mjs' || ext === '.astro';
  const allowHtml = ext === '.astro' || ext === '.html' || ext === '.md';

  let inHtml = false;
  let inBlock = false;

  return (line) => {
    const t = line.trim();
    const wasInComment = inHtml || inBlock;

    // 先判断本行是否被注释覆盖
    let isComment = wasInComment;

    if (!isComment) {
      if (allowSlash && (t.startsWith('//') || t.startsWith('/*') || t.startsWith('*'))) {
        isComment = true;
      }
      if (allowHash && t.startsWith('#')) isComment = true;
      if (allowHtml && t.startsWith('<!--')) {
        isComment = true;
        if (!t.includes('-->')) inHtml = true;
      }
      if (allowSlash && (t.startsWith('/*') || t.startsWith('/**'))) {
        if (!t.includes('*/')) inBlock = true;
      }
    } else {
      // 已在注释块中：检查是否在此行结束
      if (inHtml && t.includes('-->')) inHtml = false;
      if (inBlock && t.includes('*/')) inBlock = false;
    }

    return isComment;
  };
}

/** 占位文案不是要发布的正式内容，不参与复核清单 */
const isPlaceholderLine = (line) => line.includes('待填写');

const files = walk(TARGET);
const blockHits = [];
const reviewHits = [];

for (const file of files) {
  const rel = relative(ROOT, file);
  const base = rel.split(/[\\/]/).pop() ?? '';
  // 以 _ 开头的模板文件不会被发布
  if (base.startsWith('_')) continue;

  const ext = extname(file);
  const trackComment = makeCommentTracker(ext);
  const raw = readFileSync(file, 'utf8');
  const lines = (useDist ? stripHtmlComments(raw) : raw).split(/\r?\n/);

  lines.forEach((line, i) => {
    if (trackComment(line)) return;

    for (const word of BLOCK) {
      if (line.includes(word)) {
        blockHits.push({ rel, line: i + 1, word, text: context(line, word) });
      }
    }

    // 构建产物里不允许残留占位文案
    if (useDist) {
      for (const mark of PLACEHOLDERS) {
        if (line.includes(mark)) {
          blockHits.push({
            rel,
            line: i + 1,
            word: `占位文案「${mark}」`,
            text: context(line, mark),
          });
        }
      }
    }

    if (isPlaceholderLine(line)) return;
    for (const word of REVIEW) {
      if (line.includes(word)) {
        reviewHits.push({ rel, line: i + 1, word, text: line.trim().slice(0, 120) });
      }
    }
  });
}

const report = (title, hits, icon) => {
  if (hits.length === 0) return;
  console.log(`\n${icon} ${title}（${hits.length} 处）\n`);
  for (const hit of hits) {
    console.log(`  ${hit.rel}:${hit.line}  [${hit.word}]`);
    console.log(`    ${hit.text}`);
  }
};

console.log(`扫描范围：${relative(ROOT, TARGET)}/ （${files.length} 个文件）`);

report('阻断项 — 必须修改', blockHits, '❌');
report('需人工复核', reviewHits, '⚠️ ');

if (blockHits.length === 0 && reviewHits.length === 0) {
  console.log('\n✅ 未发现问题。');
} else if (blockHits.length === 0) {
  console.log('\n✅ 无明确违规。以上复核项确认语境无误即可。');
}

process.exit(blockHits.length > 0 ? 1 : 0);
