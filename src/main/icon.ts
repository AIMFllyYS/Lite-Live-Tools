import { nativeImage, type NativeImage } from 'electron';

/** 代码生成托盘图标（32px@2x，发光小球），省掉一个资源文件。像素格式 BGRA，预乘 alpha。 */
export function makeTrayIcon(): NativeImage {
  const S = 32;
  const buf = Buffer.alloc(S * S * 4);
  const c = (S - 1) / 2;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x - c, y - c) / c; // 0 中心 → 1 边缘
      const core = d < 0.52 ? 1 : d < 0.62 ? (0.62 - d) / 0.1 : 0;
      const glow = Math.max(0, 1 - d) ** 1.6 * 0.85;
      const a = Math.min(1, core + glow * (1 - core));
      // 核心偏白，外圈青色
      const hl = Math.max(0, 1 - Math.hypot(x - c * 0.75, y - c * 0.7) / (c * 0.45)); // 左上高光
      const r = core * (200 + 55 * hl) + (1 - core) * 120;
      const g = core * (230 + 25 * hl) + (1 - core) * 225;
      const b = 255;
      const i = (y * S + x) * 4;
      buf[i] = Math.round(b * a);
      buf[i + 1] = Math.round(g * a);
      buf[i + 2] = Math.round(r * a);
      buf[i + 3] = Math.round(255 * a);
    }
  }
  return nativeImage.createFromBitmap(buf, { width: S, height: S, scaleFactor: 2 });
}
