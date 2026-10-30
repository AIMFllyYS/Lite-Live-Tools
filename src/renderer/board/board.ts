import '../shared/theme';
import { theme, type Theme } from '../shared/theme';
import { getStroke } from 'perfect-freehand';
import { clickThrough } from '../shared/clickthrough';
import { I } from '../shared/icons';
import type { BoardKind } from '../../shared/types';

// ---------------- 数据模型 ----------------
type Tool = 'pen' | 'rect' | 'ellipse' | 'arrow' | 'text' | 'eraser';
interface Base { color: string; w: number; born: number }
interface Pen extends Base { t: 'pen'; pts: number[][]; sim: boolean; path: Path2D | null }
interface Box extends Base { t: 'rect' | 'ellipse' | 'arrow'; x1: number; y1: number; x2: number; y2: number }
interface Txt extends Base { t: 'text'; x: number; y: number; text: string; size: number; tw: number }
type Shape = Pen | Box | Txt;

// 同一位置的颜色在两套主题里对应：浅色背景上用更深的色相，白色换成墨黑
const PALETTE: Record<Theme, string[]> = {
  dark: ['#ff5d73', '#ffb547', '#ffe066', '#7cf29a', '#86e9ff', '#b9a2ff', '#ffffff'],
  light: ['#ef4058', '#f08a00', '#e0b000', '#1fb35a', '#0e9ad8', '#7c5cf0', '#1f2937'],
};
const COLORS = [...PALETTE[theme()]];
const WIDTHS = [3, 6, 11];
const FADE_HOLD = 2200, FADE_DUR = 700;
const TAU = Math.PI * 2;
const PRESETS = [
  { label: '马上回来', text: '马上回来', min: 0 },
  { label: '休息 5 分钟', text: '休息一下', min: 5 },
  { label: '休息 10 分钟', text: '休息一下', min: 10 },
  { label: '调试中', text: '技术调试中，请稍候', min: 0 },
  { label: '自定义…', text: '', min: -1 },
];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const bg = $('bg'), bar = $('bar'), presets = $('presets'), card = $('card');
const cardText = $('cardText'), cardSub = $('cardSub');
const txt = $<HTMLInputElement>('txt');
const c0 = $<HTMLCanvasElement>('c0'), c1 = $<HTMLCanvasElement>('c1');
const ctx0 = c0.getContext('2d')!, ctx1 = c1.getContext('2d')!;
const ct = clickThrough('board:interactive');

const q = new URLSearchParams(location.search);
let kind: BoardKind = q.get('kind') === 'prompt' ? 'prompt' : 'annotate';
let savedBg = Math.min(0.9, Math.max(0, Number(q.get('bg') ?? 0.35) || 0));
let bgAlpha = 0;

let tool: Tool = 'pen';
let color = COLORS[4]!;
let width = WIDTHS[1]!;
let drawing = false;
let fade = false;
let editingCard = false;
let shapes: Shape[] = [];
const undoStack: Shape[][] = [];
let redoStack: Shape[][] = [];

// ---------------- 画布 ----------------
let W = 0, H = 0;
function resize(): void {
  const dpr = devicePixelRatio || 1;
  W = innerWidth; H = innerHeight;
  for (const c of [c0, c1]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
  ctx0.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx1.setTransform(dpr, 0, 0, dpr, 0, 0);
  renderAll();
}
addEventListener('resize', resize);

const fontOf = (size: number) => `700 ${size}px "Microsoft YaHei UI", "Segoe UI Variable Display", system-ui, sans-serif`;
const withAlpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

function penPath(s: Pen): Path2D {
  const o = getStroke(s.pts, { size: s.w * 2.2, thinning: 0.55, smoothing: 0.55, streamline: 0.45, simulatePressure: s.sim });
  const p = new Path2D();
  if (o.length < 2) return p;
  p.moveTo(o[0]![0]!, o[0]![1]!);
  for (let i = 1; i < o.length; i++) {
    const a = o[i]!, b = o[(i + 1) % o.length]!;
    p.quadraticCurveTo(a[0]!, a[1]!, (a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2);
  }
  p.closePath();
  return p;
}

function drawShape(ctx: CanvasRenderingContext2D, s: Shape, alpha = 1): void {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = ctx.fillStyle = s.color;
  ctx.lineWidth = s.w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // 柔光：浅色背景上同色大光晕会发脏，改成半透明的小光晕
  const light = document.documentElement.dataset.theme === 'light';
  ctx.shadowColor = light ? withAlpha(s.color, 0.38) : s.color;
  ctx.shadowBlur = light ? 7 : 12;
  switch (s.t) {
    case 'pen':
      if (!s.path) s.path = penPath(s);
      ctx.fill(s.path);
      break;
    case 'rect': {
      const x = Math.min(s.x1, s.x2), y = Math.min(s.y1, s.y2);
      const w = Math.abs(s.x2 - s.x1), h = Math.abs(s.y2 - s.y1);
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, Math.min(12, w / 4, h / 4));
      ctx.stroke();
      break;
    }
    case 'ellipse':
      ctx.beginPath();
      ctx.ellipse((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2, Math.abs(s.x2 - s.x1) / 2, Math.abs(s.y2 - s.y1) / 2, 0, 0, TAU);
      ctx.stroke();
      break;
    case 'arrow': {
      const a = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
      const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
      const head = Math.min(len * 0.45, 12 + s.w * 2.4);
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2);
      ctx.moveTo(s.x2 - head * Math.cos(a - 0.45), s.y2 - head * Math.sin(a - 0.45));
      ctx.lineTo(s.x2, s.y2);
      ctx.lineTo(s.x2 - head * Math.cos(a + 0.45), s.y2 - head * Math.sin(a + 0.45));
      ctx.stroke();
      break;
    }
    case 'text':
      ctx.font = fontOf(s.size);
      ctx.textBaseline = 'top';
      ctx.fillText(s.text, s.x, s.y);
      break;
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

// 已提交图形层：只在变化时重画；"自动淡出"时按需要推进动画
let fadeRaf = 0, fadeTimer = 0;
function renderAll(): void {
  ctx0.clearRect(0, 0, W, H);
  const now = performance.now();
  let nextWake = Infinity;
  if (fade) {
    const alive = shapes.filter((s) => now - s.born < FADE_HOLD + FADE_DUR);
    if (alive.length !== shapes.length) shapes = alive; // 淡出完的直接移除（不进撤销栈）
  }
  for (const s of shapes) {
    let a = 1;
    if (fade) {
      const age = now - s.born;
      if (age > FADE_HOLD) { a = 1 - (age - FADE_HOLD) / FADE_DUR; nextWake = 0; }
      else nextWake = Math.min(nextWake, FADE_HOLD - age);
    }
    drawShape(ctx0, s, Math.max(0, a));
  }
  cancelAnimationFrame(fadeRaf); clearTimeout(fadeTimer); fadeRaf = 0;
  if (nextWake === 0) fadeRaf = requestAnimationFrame(renderAll);
  else if (nextWake < Infinity) fadeTimer = window.setTimeout(renderAll, nextWake); // 静止期间不出帧
}

function commit(next: Shape[]): void {
  undoStack.push(shapes);
  if (undoStack.length > 100) undoStack.shift();
  redoStack = [];
  shapes = next;
  renderAll();
}
function undo(): void { const p = undoStack.pop(); if (!p) return; redoStack.push(shapes); shapes = p; renderAll(); }
function redo(): void { const n = redoStack.pop(); if (!n) return; undoStack.push(shapes); shapes = n; renderAll(); }
function clearAll(): void { if (shapes.length) commit([]); }

// ---------------- 橡皮命中 ----------------
function segDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1, dy = y2 - y1;
  const l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l)) : 0;
  return Math.hypot(px - x1 - t * dx, py - y1 - t * dy);
}
function hit(s: Shape, x: number, y: number, tol = 10): boolean {
  switch (s.t) {
    case 'pen': return s.pts.some((p) => Math.hypot(p[0]! - x, p[1]! - y) < s.w + tol);
    case 'rect': {
      const l = Math.min(s.x1, s.x2), r = Math.max(s.x1, s.x2), t = Math.min(s.y1, s.y2), b = Math.max(s.y1, s.y2);
      const k = tol + s.w / 2;
      return x > l - k && x < r + k && y > t - k && y < b + k && !(x > l + k && x < r - k && y > t + k && y < b - k);
    }
    case 'ellipse': {
      const rx = Math.abs(s.x2 - s.x1) / 2, ry = Math.abs(s.y2 - s.y1) / 2;
      if (rx < 1 || ry < 1) return false;
      const d = Math.hypot((x - (s.x1 + s.x2) / 2) / rx, (y - (s.y1 + s.y2) / 2) / ry);
      return Math.abs(d - 1) * Math.min(rx, ry) < tol + s.w / 2;
    }
    case 'arrow': return segDist(x, y, s.x1, s.y1, s.x2, s.y2) < tol + s.w;
    case 'text': return x > s.x - tol && x < s.x + s.tw + tol && y > s.y - tol && y < s.y + s.size * 1.25 + tol;
  }
}

// ---------------- 指针 ----------------
let cur: Pen | Box | null = null;
let erasing: Shape[] | null = null;
const isUi = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.('.bar, .presets, .card, .txt');

addEventListener('pointerdown', (e) => {
  if (!drawing || e.button !== 0 || isUi(e.target)) return;
  const x = e.clientX, y = e.clientY;
  if (tool === 'text') { e.preventDefault(); openText(x, y); return; }
  document.body.setPointerCapture(e.pointerId);
  if (tool === 'eraser') { erasing = shapes; eraseAt(x, y); return; }
  if (tool === 'pen') cur = { t: 'pen', pts: [[x, y, e.pressure || 0.5]], sim: e.pointerType !== 'pen', color, w: width, born: 0, path: null };
  else cur = { t: tool, x1: x, y1: y, x2: x, y2: y, color, w: width, born: 0 };
});

addEventListener('pointermove', (e) => {
  if (erasing) { eraseAt(e.clientX, e.clientY); return; }
  if (!cur) return;
  if (cur.t === 'pen') {
    for (const ev of e.getCoalescedEvents?.() ?? [e]) cur.pts.push([ev.clientX, ev.clientY, ev.pressure || 0.5]);
    cur.path = null;
  } else {
    let x = e.clientX, y = e.clientY;
    if (e.shiftKey) { // Shift：正方形 / 正圆 / 45° 箭头
      const dx = x - cur.x1, dy = y - cur.y1;
      if (cur.t === 'arrow') {
        const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4), l = Math.hypot(dx, dy);
        x = cur.x1 + Math.cos(a) * l; y = cur.y1 + Math.sin(a) * l;
      } else {
        const m = Math.max(Math.abs(dx), Math.abs(dy));
        x = cur.x1 + Math.sign(dx || 1) * m; y = cur.y1 + Math.sign(dy || 1) * m;
      }
    }
    cur.x2 = x; cur.y2 = y;
  }
  ctx1.clearRect(0, 0, W, H);
  drawShape(ctx1, cur);
});

const endPointer = () => {
  if (erasing) {
    if (erasing !== shapes) { undoStack.push(erasing); redoStack = []; }
    erasing = null;
    return;
  }
  if (!cur) return;
  const ok = cur.t === 'pen' ? cur.pts.length > 1 : Math.hypot(cur.x2 - cur.x1, cur.y2 - cur.y1) > 4;
  if (ok) { cur.born = performance.now(); commit([...shapes, cur]); }
  cur = null;
  ctx1.clearRect(0, 0, W, H);
};
addEventListener('pointerup', endPointer);
addEventListener('pointercancel', endPointer);

function eraseAt(x: number, y: number): void {
  const keep = shapes.filter((s) => !hit(s, x, y));
  if (keep.length !== shapes.length) { shapes = keep; renderAll(); }
}

// ---------------- 文字工具 ----------------
let textPos: { x: number; y: number; size: number } | null = null;
function openText(x: number, y: number): void {
  commitText();
  const size = 18 + width * 2.6;
  textPos = { x, y: y - size * 0.6, size };
  Object.assign(txt.style, { left: `${x - 4}px`, top: `${textPos.y - 2}px`, fontSize: `${size}px`, color, textShadow: `0 0 12px ${color}` });
  txt.value = '';
  txt.classList.remove('hidden');
  setTimeout(() => txt.focus(), 0);
}
function commitText(): void {
  if (!textPos) return;
  const v = txt.value.trim();
  const p = textPos;
  textPos = null;
  txt.classList.add('hidden');
  if (!v) return;
  ctx0.font = fontOf(p.size);
  const tw = ctx0.measureText(v).width;
  commit([...shapes, { t: 'text', x: p.x, y: p.y, text: v, size: p.size, tw, color, w: 0, born: performance.now() }]);
}
txt.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); commitText(); }
  else if (e.key === 'Escape') { e.preventDefault(); txt.value = ''; commitText(); }
  e.stopPropagation();
});
txt.addEventListener('blur', commitText);

// ---------------- 模式 ----------------
function setDraw(v: boolean): void {
  drawing = v;
  document.body.classList.toggle('drawing', v);
  if (!v) commitText();
  if (v) ct.lock(); else ct.unlock();      // 绘制时整窗接管；穿透时只有工具条/提示卡可点
  window.lb.send('board:focus', v || editingCard);
  syncBar();
}
function setTool(t: Tool): void {
  tool = t;
  document.body.classList.toggle('tool-text', t === 'text');
  document.body.classList.toggle('tool-eraser', t === 'eraser');
  if (!drawing) setDraw(true); else syncBar();
}
function setBg(a: number): void { bgAlpha = a; bg.style.opacity = String(a); syncBar(); }
function showCard(v: boolean): void {
  card.classList.toggle('hidden', !v);
  presets.classList.toggle('hidden', !v);
  ct.refresh();
  syncBar();
}
function applyKind(k: BoardKind): void {
  kind = k;
  if (k === 'prompt') { setBg(savedBg); showCard(true); setDraw(false); }
  else { setBg(0); showCard(false); setDraw(true); }
}

// ---------------- 提示卡 / 倒计时 ----------------
let cdTimer = 0;
function startCountdown(min: number): void {
  clearInterval(cdTimer);
  cardSub.textContent = '';
  if (min <= 0) return;
  const end = Date.now() + min * 60_000;
  const tick = () => {
    const left = Math.max(0, end - Date.now());
    const s = Math.ceil(left / 1000);
    cardSub.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    if (left <= 0) { clearInterval(cdTimer); cardText.textContent = '马上就回来～'; cardSub.textContent = ''; }
  };
  tick();
  cdTimer = window.setInterval(tick, 1000);
}
function editCard(): void {
  editingCard = true;
  window.lb.send('board:focus', true);
  setTimeout(() => {
    cardText.focus();
    const r = document.createRange(); r.selectNodeContents(cardText);
    const sel = getSelection(); sel?.removeAllRanges(); sel?.addRange(r);
  }, 40);
}
cardText.addEventListener('pointerdown', () => { if (!editingCard) editCard(); });
cardText.addEventListener('blur', () => { editingCard = false; if (!drawing) window.lb.send('board:focus', false); });
cardText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); cardText.blur(); }
  e.stopPropagation();
});
for (const p of PRESETS) {
  const b = document.createElement('button');
  b.className = 'chip'; b.textContent = p.label;
  b.addEventListener('click', () => {
    if (p.min < 0) { editCard(); return; }
    cardText.textContent = p.text;
    startCountdown(p.min);
  });
  presets.appendChild(b);
}

// ---------------- 工具条 ----------------
const tip = document.createElement('div');
tip.className = 'tip';
document.body.appendChild(tip);

function btn(icon: string, label: string, on: () => void, cls = 'btn'): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = cls; b.innerHTML = icon; b.dataset.tip = label;
  b.addEventListener('click', on);
  bar.appendChild(b);
  return b;
}
const sep = () => { const d = document.createElement('div'); d.className = 'sep'; bar.appendChild(d); };

const modeBtn = document.createElement('button');
modeBtn.className = 'btn mode';
modeBtn.dataset.tip = '绘制 / 穿透（Esc 或 Ctrl+Alt+D）';
modeBtn.addEventListener('click', () => setDraw(!drawing));
bar.appendChild(modeBtn);
sep();
const toolBtns: Record<Tool, HTMLButtonElement> = {
  pen: btn(I.pen, '画笔 P', () => setTool('pen')),
  rect: btn(I.rect, '方框 R（Shift 正方形）', () => setTool('rect')),
  ellipse: btn(I.ellipse, '圆 O（Shift 正圆）', () => setTool('ellipse')),
  arrow: btn(I.arrow, '箭头 A（Shift 45°）', () => setTool('arrow')),
  text: btn(I.text, '文字 T', () => setTool('text')),
  eraser: btn(I.eraser, '橡皮 E', () => setTool('eraser')),
};
sep();
const swatches = COLORS.map((c) => {
  const b = btn('', c, () => { color = c; syncBar(); }, 'sw');
  b.style.setProperty('--c', c);
  b.dataset.tip = '颜色';
  return b;
});
const widthBtns = WIDTHS.map((w, i) => {
  const b = btn('<i></i>', ['细', '中', '粗'][i]!, () => { width = w; syncBar(); }, 'wd');
  const dot = b.querySelector('i')!;
  dot.style.width = dot.style.height = `${4 + i * 4}px`; // CSP 禁止内联 style 属性，用 CSSOM 设置
  return b;
});
sep();
btn(I.undo, '撤销 Ctrl+Z', undo);
btn(I.redo, '重做 Ctrl+Y', redo);
btn(I.trash, '清屏 Delete', clearAll);
const fadeBtn = btn(I.fade, '笔迹自动淡出 F', () => { fade = !fade; if (fade) { const now = performance.now(); shapes.forEach((s) => { s.born = now; }); } renderAll(); syncBar(); });
sep();
const cardBtn = btn(I.card, '提示卡', () => showCard(card.classList.contains('hidden')));
btn(I.sun, '背景遮罩', () => setBg(bgAlpha > 0 ? 0 : savedBg || 0.35));
const range = document.createElement('input');
range.type = 'range'; range.min = '0'; range.max = '85'; range.className = 'range'; range.dataset.tip = '背景透明度';
range.addEventListener('input', () => setBg(Number(range.value) / 100));
range.addEventListener('change', () => { savedBg = bgAlpha; window.lb.send('board:bg', bgAlpha); });
bar.appendChild(range);
sep();
btn(I.close, '关闭画布', () => window.lb.send('board:close'));

function syncBar(): void {
  modeBtn.innerHTML = `<span class="dot"></span>${drawing ? '绘制中' : '穿透'}`;
  modeBtn.classList.toggle('pass', !drawing);
  (Object.keys(toolBtns) as Tool[]).forEach((t) => toolBtns[t].classList.toggle('on', drawing && t === tool));
  swatches.forEach((b, i) => b.classList.toggle('on', COLORS[i] === color));
  widthBtns.forEach((b, i) => b.classList.toggle('on', WIDTHS[i] === width));
  fadeBtn.classList.toggle('on', fade);
  cardBtn.classList.toggle('on', !card.classList.contains('hidden'));
  range.value = String(Math.round(bgAlpha * 100));
}

bar.addEventListener('mouseover', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-tip]');
  if (!t) return;
  tip.textContent = t.dataset.tip ?? '';
  const r = t.getBoundingClientRect();
  tip.style.left = `${r.left + r.width / 2}px`;
  tip.classList.add('show');
});
bar.addEventListener('mouseleave', () => tip.classList.remove('show'));
// 提示卡显示时，预设栏挡住了 tip 的位置，tip 下移
presets.addEventListener('mouseover', () => tip.classList.remove('show'));

// ---------------- 键盘 ----------------
addEventListener('keydown', (e) => {
  if (e.target === txt || e.target === cardText) return;
  const k = e.key.toLowerCase();
  if (e.ctrlKey && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (e.ctrlKey && k === 'y') { e.preventDefault(); redo(); return; }
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  const map: Record<string, Tool> = { p: 'pen', r: 'rect', o: 'ellipse', a: 'arrow', t: 'text', e: 'eraser' };
  if (map[k]) setTool(map[k]!);
  else if (k === 'escape') setDraw(false);
  else if (k === 'delete' || k === 'backspace') clearAll();
  else if (k === 'f') fadeBtn.click();
});

// ---------------- IPC ----------------
window.lb.on('board:set-kind', (k: BoardKind) => applyKind(k));
window.lb.on('board:toggle-draw', () => setDraw(!drawing));
window.lb.on('board:test', () => {
  // 自检用的示例图形
  const now = performance.now();
  const cx = W * 0.32, cy = H * 0.48;
  const pts: number[][] = [];
  for (let i = 0; i <= 60; i++) pts.push([cx - 220 + i * 7, cy + 150 + Math.sin(i / 6) * 26, 0.5]);
  shapes = [
    { t: 'rect', x1: cx - 230, y1: cy - 120, x2: cx + 210, y2: cy + 90, color: COLORS[4]!, w: 6, born: now },
    { t: 'ellipse', x1: W * 0.62, y1: H * 0.3, x2: W * 0.8, y2: H * 0.52, color: COLORS[2]!, w: 6, born: now },
    { t: 'arrow', x1: W * 0.56, y1: H * 0.68, x2: W * 0.66, y2: H * 0.55, color: COLORS[0]!, w: 6, born: now },
    { t: 'pen', pts, sim: true, color: COLORS[3]!, w: 6, born: now, path: null },
    { t: 'text', x: cx - 200, y: cy - 60, text: '这里是重点', size: 46, tw: 240, color: COLORS[6]!, w: 0, born: now },
  ];
  renderAll();
});

resize();
applyKind(kind);
// 切换主题：色板换成对应主题的同位颜色，当前选中色跟着换（已画的图形保持原色）
addEventListener('themechange', (e) => {
  const next = PALETTE[(e as CustomEvent<Theme>).detail];
  const idx = COLORS.indexOf(color);
  next.forEach((c, i) => { COLORS[i] = c; swatches[i]!.style.setProperty('--c', c); });
  if (idx >= 0) color = COLORS[idx]!;
  renderAll();
  syncBar();
});
// 工具条换行后高度会变，预设栏跟着下移
new ResizeObserver(() => document.documentElement.style.setProperty('--bar-h', `${bar.offsetHeight}px`)).observe(bar);
