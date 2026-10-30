import type { FxModes } from '../../shared/types';

/**
 * 光标特效渲染：聚光灯 / 激光笔 / 晃动放大。
 *
 * 性能要点：
 * 1. 只在有变化时画一帧，光标静止、拖尾消失、缩放结束后 rAF 停止，空闲 0 帧；
 * 2. 脏矩形：每帧只清/画"上一帧画过的区域 ∪ 这一帧要画的区域"。
 *    聚光灯的暗幕在洞以外不会变，所以全屏只在开关时填一次，移动时只补洞附近一小块。
 *    软件渲染下这决定了 CPU 是 1% 还是 15%。
 */
const cv = document.getElementById('c') as HTMLCanvasElement;
const ctx = cv.getContext('2d')!;
const TAU = Math.PI * 2;
const SPOT_R = 150;
const TRAIL_MS = 320;
const DIM = 'rgba(4, 6, 12, 0.62)';

interface Rect { x: number; y: number; w: number; h: number }
const EMPTY: Rect = { x: 0, y: 0, w: 0, h: 0 };
const union = (a: Rect, b: Rect): Rect => {
  if (!a.w || !a.h) return b;
  if (!b.w || !b.h) return a;
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};
const box = (cx: number, cy: number, r: number): Rect => ({ x: cx - r, y: cy - r, w: r * 2, h: r * 2 });

let W = 0, H = 0;
let full = true;          // 下一帧整屏重画
let prev: Rect = EMPTY;   // 上一帧动过的区域

function resize(): void {
  const dpr = devicePixelRatio || 1;
  W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  full = true;
  kick();
}
addEventListener('resize', resize);

let modes: FxModes = { shake: false, spotlight: false, laser: false };
let x = -9999, y = -9999;
let trail: { x: number; y: number; t: number }[] = [];
let big = 1, bigTarget = 1;
let bigAt: { x: number; y: number } | null = null; // 自检时把放大光标画在别处
let raf = 0;

const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

window.lb.on('fx:modes', (m: FxModes) => { modes = m; if (!m.laser) trail = []; full = true; kick(); });
window.lb.on('fx:cursor', (nx: number, ny: number) => {
  x = nx; y = ny;
  bigAt = null;
  if (modes.laser) trail.push({ x, y, t: performance.now() });
  kick();
});
window.lb.on('fx:big', (s: number) => { bigTarget = s; kick(); });
window.lb.on('fx:test', () => {
  const now = performance.now();
  x = W * 0.42; y = H * 0.5;
  trail = Array.from({ length: 24 }, (_, i) => ({ x: x - 240 + i * 10, y: y + Math.sin(i / 4) * 40, t: now - (23 - i) * 12 }));
  trail.push({ x, y, t: now });
  big = bigTarget = 3.2;
  bigAt = { x: W * 0.62, y: H * 0.42 };
  full = true;
  frame(now);
});

function frame(now: number): void {
  raf = 0;
  const animBig = Math.abs(big - bigTarget) > 0.01;
  big = animBig ? big + (bigTarget - big) * (bigTarget > big ? 0.35 : 0.16) : bigTarget;
  trail = trail.filter((p) => now - p.t < TRAIL_MS);

  // 这一帧会画到的区域
  let cur: Rect = EMPTY;
  if (modes.spotlight) cur = union(cur, box(x, y, SPOT_R + 2));
  if (modes.laser) { cur = union(cur, box(x, y, 22)); for (const p of trail) cur = union(cur, box(p.x, p.y, 22)); }
  const bx = bigAt?.x ?? x, by = bigAt?.y ?? y;
  if (big > 1.02) cur = union(cur, { x: bx - 16, y: by - 16, w: 20 * big * 1.25 + 40, h: 24 * big * 1.25 + 40 });

  const dirty: Rect = full ? { x: 0, y: 0, w: W, h: H } : union(prev, cur);
  if (dirty.w && dirty.h) {
    // 对齐到设备像素：125% 缩放下小数坐标的 clear/fill 会留下半透明接缝
    const dpr = devicePixelRatio || 1;
    const dx = Math.max(0, Math.floor(dirty.x * dpr) - 2), dy = Math.max(0, Math.floor(dirty.y * dpr) - 2);
    const dw = Math.min(cv.width, Math.ceil((dirty.x + dirty.w) * dpr) + 2) - dx;
    const dh = Math.min(cv.height, Math.ceil((dirty.y + dirty.h) * dpr) + 2) - dy;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath(); ctx.rect(dx, dy, dw, dh); ctx.clip();
    ctx.clearRect(dx, dy, dw, dh);
    if (modes.spotlight) { ctx.fillStyle = DIM; ctx.fillRect(dx, dy, dw, dh); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (modes.spotlight) drawSpotHole();
    if (modes.laser) drawLaser(now);
    if (big > 1.02) drawBigCursor(bx, by, big);
    ctx.restore();
  }
  prev = cur;
  full = false;

  if (animBig || trail.length > 1) kick();
}

function drawSpotHole(): void {
  ctx.globalCompositeOperation = 'destination-out';
  const g = ctx.createRadialGradient(x, y, SPOT_R * 0.72, x, y, SPOT_R);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, SPOT_R, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = 'rgba(134, 233, 255, 0.28)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, SPOT_R * 0.86, 0, TAU); ctx.stroke();
}

function drawLaser(now: number): void {
  ctx.lineCap = 'round';
  // 拖尾：外层宽而淡的"光"，内层细而亮的"芯"，代替 shadowBlur（模糊在软件渲染下最贵）
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1]!, b = trail[i]!;
      const k = 1 - (now - b.t) / TRAIL_MS;
      ctx.strokeStyle = pass === 0 ? `rgba(255, 46, 85, ${(k * 0.22).toFixed(3)})` : `rgba(255, 110, 135, ${(k * 0.9).toFixed(3)})`;
      ctx.lineWidth = pass === 0 ? 6 + k * 12 : 1 + k * 4;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
  const g = ctx.createRadialGradient(x, y, 0, x, y, 20);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.22, 'rgba(255,90,120,0.95)');
  g.addColorStop(0.55, 'rgba(255,40,80,0.35)');
  g.addColorStop(1, 'rgba(255,40,80,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, 20, 0, TAU); ctx.fill();
}

// 标准箭头光标轮廓（热点在左上角），按倍数放大
const CURSOR = [[0, 0], [0, 17], [4.2, 13.2], [7, 19.5], [9.7, 18.4], [6.9, 12.3], [12.3, 12.3]] as const;
function drawBigCursor(cx: number, cy: number, s: number): void {
  const k = s * 1.25;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(k, k);
  ctx.beginPath();
  CURSOR.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  ctx.shadowColor = 'rgba(134, 233, 255, 0.7)';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.3 / Math.max(1, k * 0.6);
  ctx.strokeStyle = '#0b0f18';
  ctx.stroke();
  ctx.restore();
}

resize();
