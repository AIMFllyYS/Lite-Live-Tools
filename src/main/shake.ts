/**
 * 晃动检测（macOS "摇动鼠标指针以定位"）。
 * 在最近 WINDOW_MS 内统计方向反转次数和移动路程：来回甩动 → 反转多、路程长。
 * 返回目标放大倍数，0 表示没在晃。
 */
const WINDOW_MS = 450;
const MIN_REVERSALS = 3;
const MIN_PATH = 650; // DIP

interface Sample { x: number; y: number; t: number }

export class ShakeDetector {
  private s: Sample[] = [];

  push(x: number, y: number, t: number): number {
    const s = this.s;
    s.push({ x, y, t });
    while (s.length && t - s[0]!.t > WINDOW_MS) s.shift();
    if (s.length < 6) return 0;

    let path = 0, revX = 0, revY = 0, sx = 0, sy = 0;
    for (let i = 1; i < s.length; i++) {
      const dx = s[i]!.x - s[i - 1]!.x, dy = s[i]!.y - s[i - 1]!.y;
      path += Math.hypot(dx, dy);
      if (Math.abs(dx) > 3) { const g = Math.sign(dx); if (sx && g !== sx) revX++; sx = g; }
      if (Math.abs(dy) > 3) { const g = Math.sign(dy); if (sy && g !== sy) revY++; sy = g; }
    }
    if (Math.max(revX, revY) < MIN_REVERSALS || path < MIN_PATH) return 0;
    return Math.min(4, 1.8 + (path - MIN_PATH) / 450);
  }

  reset(): void { this.s.length = 0; }
}
