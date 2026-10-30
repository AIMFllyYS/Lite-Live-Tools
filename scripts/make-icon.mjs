// 生成 build/icon.png（256×256），与托盘图标同一套发光小球算法。纯 Node，无依赖。
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const S = 256;
const raw = Buffer.alloc((S * 4 + 1) * S);
const c = (S - 1) / 2;
for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0; // filter: none
  for (let x = 0; x < S; x++) {
    const d = Math.hypot(x - c, y - c) / c;
    const core = d < 0.5 ? 1 : d < 0.56 ? (0.56 - d) / 0.06 : 0;
    const glow = Math.max(0, 1 - d) ** 1.6 * 0.85;
    const a = Math.min(1, core + glow * (1 - core));
    const hl = Math.max(0, 1 - Math.hypot(x - c * 0.75, y - c * 0.7) / (c * 0.45));
    // 核心：深蓝玻璃 + 左上高光；外圈：青色光晕
    const r = core * (40 + 200 * hl) + (1 - core) * 120;
    const g = core * (70 + 180 * hl) + (1 - core) * 225;
    const b = core * (120 + 135 * hl) + (1 - core) * 255;
    const i = y * (S * 4 + 1) + 1 + x * 4;
    raw[i] = Math.round(r); raw[i + 1] = Math.round(g); raw[i + 2] = Math.round(b); raw[i + 3] = Math.round(255 * a);
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => { let k = n; for (let j = 0; j < 8; j++) k = k & 1 ? 0xedb88320 ^ (k >>> 1) : k >>> 1; return k >>> 0; });
const crc = (buf) => { let v = 0xffffffff; for (const b of buf) v = crcTable[(v ^ b) & 255] ^ (v >>> 8); return (v ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, cr]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
]);
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'build', 'icon.png');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, png);
console.log('icon ok', out);
