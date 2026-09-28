/**
 * 把位图 Logo 矢量化：按颜色分层 → 逐层描摹 → 合成 SVG
 */
const sharp = require('sharp');
const ImageTracer = require('imagetracerjs');
const fs = require('fs');

const SRC = 'd:/dev/vibecoding/sanjie_web/web_material/01_品牌与VI/原始文件/logo-原始图.jpg';
const OUT = 'C:/Users/armstrong/AppData/Local/Temp/shots';

// 分类阈值
function classify(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const sat = mx - mn;

  // 接近白色 → 背景
  if (mn > 205 && sat < 30) return 'bg';

  // 红色：红通道明显高于绿蓝
  if (r > 140 && r - g > 60 && r - b > 60) return 'red';

  // 蓝色：蓝通道最高，且有一定饱和度
  if (b > 110 && b - r > 40 && sat > 40) return 'blue';

  // 其余视为深灰（文字）
  if (mx < 200) return 'dark';

  return 'bg';
}

(async () => {
  const { data, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;

  const sums = { blue: [0,0,0,0], dark: [0,0,0,0], red: [0,0,0,0] };
  const labels = new Uint8Array(W * H); // 0=bg 1=blue 2=dark 3=red
  const CODE = { bg: 0, blue: 1, dark: 2, red: 3 };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * C;
      const r = data[i], g = data[i+1], b = data[i+2];
      const cls = classify(r, g, b);
      labels[y * W + x] = CODE[cls];
      if (cls !== 'bg') {
        const s = sums[cls];
        s[0] += r; s[1] += g; s[2] += b; s[3]++;
      }
    }
  }

  console.log('=== 各类平均色 ===');
  const colors = {};
  for (const k of ['blue', 'dark', 'red']) {
    const s = sums[k];
    if (s[3] === 0) { console.log(`  ${k}: 未识别到像素`); continue; }
    const r = Math.round(s[0]/s[3]), g = Math.round(s[1]/s[3]), b = Math.round(s[2]/s[3]);
    const hex = '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
    colors[k] = hex;
    console.log(`  ${k.padEnd(5)} ${hex}   像素数 ${s[3]}`);
  }

  // 逐层描摹
  const pathsByLayer = {};
  for (const key of ['blue', 'dark', 'red']) {
    const code = CODE[key];
    // 生成二值掩膜：该层=黑，其余=白
    const mask = Buffer.alloc(W * H);
    for (let i = 0; i < W * H; i++) mask[i] = labels[i] === code ? 0 : 255;

    // 放大 3 倍并做轻微模糊，让描摹出的曲线更平滑
    const up = await sharp(mask, { raw: { width: W, height: H, channels: 1 } })
      .resize(W * 3, H * 3, { kernel: 'cubic' })
      .blur(1.2)
      .raw().toBuffer();

    const svg = ImageTracer.imagedataToSVG(
      { width: W * 3, height: H * 3, data: up },
      {
        ltres: 0.6, qtres: 0.6,
        pathomit: 12,
        rightangleenhance: true,
        colorsampling: 0,
        numberofcolors: 2,
        mincolorratio: 0,
        colorquantcycles: 1,
        strokewidth: 0,
        linefilter: true,
        scale: 1,
        // 已经放大 3 倍，坐标取整精度就够（相当于原图 1/3 像素），能显著减小文件体积
        roundcoords: 0,
        viewbox: true,
        desc: false,
      }
    );

    /*
      关键：imagetracerjs 会把背景也描成路径。
      如果无差别地把所有路径都填成图层色，背景路径就会盖住整个画布（试过一次，渲出一整块红）。
      所以必须解析每条路径的 fill，只保留「图形本身」那一层（掩膜里的黑色）。
    */
    const dAttrs = [...svg.matchAll(/<path\s+fill="rgb\((\d+),(\d+),(\d+)\)"[^>]*?\sd="([^"]+)"/g)]
      .filter((m) => {
        const sum = Number(m[1]) + Number(m[2]) + Number(m[3]);
        return sum < 380; // 暗色 = 图形；亮色 = 背景
      })
      .map((m) => m[4]);

    pathsByLayer[key] = dAttrs;
    console.log(`  ${key} 层描摹出 ${dAttrs.length} 条图形路径`);
  }

  // 合成：把三层路径按 z 序叠起来（先深灰文字，再蓝，再红）
  const S3 = 3;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W*S3} ${H*S3}" width="${W*S3}" height="${H*S3}">\n`;
  for (const key of ['dark', 'blue', 'red']) {
    const fill = colors[key];
    if (!fill) continue;
    out += `  <g fill="${fill}">\n`;
    for (const d of pathsByLayer[key]) out += `    <path d="${d}"/>\n`;
    out += `  </g>\n`;
  }
  out += `</svg>\n`;

  fs.writeFileSync(`${OUT}/logo-traced.svg`, out);
  console.log(`\n合成 SVG 已写出：${(out.length/1024).toFixed(1)} KB`);
})();
