/**
 * 从描摹结果生成品牌 Logo 三件套
 *   1. logo-full.svg     完整锁定版（标记 + 中文 + 英文），用于页头
 *   2. logo-reverse.svg  反白版，用于深色页脚
 *   3. logo-mark.svg     单独的盾形标记，用于方形图标
 */
const fs = require('fs');
const OUT = 'C:/Users/armstrong/AppData/Local/Temp/shots';
const BRAND = 'd:/dev/vibecoding/sanjie_web/src/assets/brand';

const traced = fs.readFileSync(`${OUT}/logo-traced.svg`, 'utf8');

/** 按 fill 色把描摹结果拆成三层 */
function splitLayers(svg) {
  const layers = { blue: [], dark: [], red: [] };
  for (const m of svg.matchAll(/<g fill="(#[0-9a-f]{6})">([\s\S]*?)<\/g>/g)) {
    const fill = m[1];
    const ds = [...m[2].matchAll(/<path d="([^"]+)"\/>/g)].map((p) => p[1]);
    if (fill === '#0c98d7') layers.blue.push(...ds);
    else if (fill === '#4a565d') layers.dark.push(...ds);
    else if (fill === '#dd3238') layers.red.push(...ds);
  }
  return layers;
}

/** 从路径数据估算边界框（控制点会略微超出实际形状，用于 viewBox 足够） */
function bbox(paths) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const d of paths) {
    // 提取所有数字，路径里坐标成对出现
    const nums = d.match(/-?\d+(?:\.\d+)?/g) || [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const x = Number(nums[i]), y = Number(nums[i + 1]);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, minY, maxX, maxY };
}

const layers = splitLayers(traced);
const markBox = bbox(layers.blue);
const textBox = bbox([...layers.dark, ...layers.red]);

console.log('盾形标记 bbox:', JSON.stringify(markBox));
console.log('文字部分 bbox:', JSON.stringify(textBox));

/** 生成 SVG 字符串 */
function buildSvg({ groups, viewBox, width, height }) {
  const body = groups
    .map(({ fill, paths }) =>
      `  <g fill="${fill}">\n` +
      paths.map((d) => `    <path d="${d}"/>`).join('\n') +
      `\n  </g>`
    )
    .join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}">\n${body}\n</svg>\n`;
}

const PAD = 8;

// ── 1. 完整版：所有三层的并集
const allBox = bbox([...layers.blue, ...layers.dark, ...layers.red]);
const fullVb = `${allBox.minX - PAD} ${allBox.minY - PAD} ${allBox.maxX - allBox.minX + PAD * 2} ${allBox.maxY - allBox.minY + PAD * 2}`;

const full = buildSvg({
  groups: [
    { fill: '#4A565D', paths: layers.dark },
    { fill: '#0C98D7', paths: layers.blue },
    { fill: '#DD3238', paths: layers.red },
  ],
  viewBox: fullVb,
  width: allBox.maxX - allBox.minX + PAD * 2,
  height: allBox.maxY - allBox.minY + PAD * 2,
});

// ── 2. 反白版：文字改白、标记提亮蓝、红字提亮，供深色背景使用
const reverse = buildSvg({
  groups: [
    { fill: '#FFFFFF', paths: layers.dark },
    { fill: '#3FB4EA', paths: layers.blue },
    { fill: '#FF5A60', paths: layers.red },
  ],
  viewBox: fullVb,
  width: allBox.maxX - allBox.minX + PAD * 2,
  height: allBox.maxY - allBox.minY + PAD * 2,
});

// ── 3. 单独标记：正方形 viewBox，标记居中
const mw = markBox.maxX - markBox.minX;
const mh = markBox.maxY - markBox.minY;
const side = Math.max(mw, mh) + PAD * 2;
const cx = (markBox.minX + markBox.maxX) / 2;
const cy = (markBox.minY + markBox.maxY) / 2;
const markVb = `${cx - side / 2} ${cy - side / 2} ${side} ${side}`;

const mark = buildSvg({
  groups: [{ fill: '#0C98D7', paths: layers.blue }],
  viewBox: markVb,
  width: side,
  height: side,
});

// ── 4. 反白标记（用于深色底上的方形图标）
const markReverse = buildSvg({
  groups: [{ fill: '#FFFFFF', paths: layers.blue }],
  viewBox: markVb,
  width: side,
  height: side,
});

fs.mkdirSync(BRAND, { recursive: true });
fs.writeFileSync(`${BRAND}/logo-full.svg`, full);
fs.writeFileSync(`${BRAND}/logo-reverse.svg`, reverse);
fs.writeFileSync(`${BRAND}/logo-mark.svg`, mark);
fs.writeFileSync(`${BRAND}/logo-mark-reverse.svg`, markReverse);

console.log('\n=== 已生成 ===');
for (const f of ['logo-full', 'logo-reverse', 'logo-mark', 'logo-mark-reverse']) {
  const size = fs.statSync(`${BRAND}/${f}.svg`).size;
  console.log(`  ${f}.svg  ${(size / 1024).toFixed(1)} KB`);
}
