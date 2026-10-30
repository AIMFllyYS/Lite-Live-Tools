import { clickThrough } from '../shared/clickthrough';
import { I } from '../shared/icons';
import type { AppState, MenuAction } from '../../shared/types';

interface Item { id: MenuAction | 'mouse' | 'back'; label: string; icon: string }

const MAIN: Item[] = [
  { id: 'prompt', label: '提示画布', icon: I.prompt },
  { id: 'annotate', label: '标注', icon: I.pen },
  { id: 'mouse', label: '鼠标特效', icon: I.mouse },
  { id: 'agent', label: 'Agent（实验）', icon: I.spark },
  { id: 'hide', label: '收进托盘', icon: I.tray },
];
const MOUSE: Item[] = [
  { id: 'fx:shake', label: '晃动放大', icon: I.shake },
  { id: 'fx:spotlight', label: '聚光灯', icon: I.spot },
  { id: 'fx:laser', label: '激光笔', icon: I.laser },
  { id: 'back', label: '返回', icon: I.back },
];

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $('stage'), ring = $('ring'), core = $('core'), cap = $('cap');
const ct = clickThrough('menu:interactive');

let st: AppState | null = null;
let items: Item[] = MAIN;
let open = false;

// ---- 展开方向：贴边时改成朝屏幕内侧的扇形 ----
function layout(): void {
  const e = st?.edge ?? { left: false, right: false, top: false, bottom: false };
  const dx = (e.left ? 1 : 0) - (e.right ? 1 : 0);
  const dy = (e.top ? 1 : 0) - (e.bottom ? 1 : 0);
  const n = items.length;
  let angles: number[];
  let r = 68;
  if (!dx && !dy) {
    angles = Array.from({ length: n }, (_, i) => -90 + (360 / n) * i);
  } else {
    const corner = dx !== 0 && dy !== 0;
    const span = corner ? 100 : 190;
    r = corner ? 80 : 70;
    const center = (Math.atan2(dy, dx) * 180) / Math.PI;
    angles = Array.from({ length: n }, (_, i) => center - span / 2 + (n > 1 ? (span / (n - 1)) * i : span / 2));
  }
  ring.querySelectorAll<HTMLElement>('.item').forEach((el, i) => {
    const a = ((angles[i] ?? 0) * Math.PI) / 180;
    el.style.setProperty('--x', `${(Math.cos(a) * r).toFixed(1)}px`);
    el.style.setProperty('--y', `${(Math.sin(a) * r).toFixed(1)}px`);
  });
  cap.classList.toggle('top', e.bottom);
}

function isOn(id: Item['id']): boolean {
  if (!st) return false;
  switch (id) {
    case 'prompt': return st.board === 'prompt';
    case 'annotate': return st.board === 'annotate';
    case 'agent': return st.agent;
    case 'mouse': return st.fx.shake || st.fx.spotlight || st.fx.laser;
    case 'fx:shake': return st.fx.shake;
    case 'fx:spotlight': return st.fx.spotlight;
    case 'fx:laser': return st.fx.laser;
    default: return false;
  }
}

function render(list: Item[]): void {
  items = list;
  ring.textContent = '';
  list.forEach((it, i) => {
    const b = document.createElement('button');
    b.className = 'item';
    b.dataset.hit = 'circle';
    b.dataset.id = it.id;
    b.dataset.label = it.label;
    b.setAttribute('aria-label', it.label);
    b.innerHTML = it.icon;
    b.style.setProperty('--d', `${i * 28}ms`);
    b.classList.toggle('on', isOn(it.id));
    ring.appendChild(b);
  });
  layout();
}

function setOpen(v: boolean): void {
  open = v;
  if (!v && items !== MAIN) render(MAIN);
  stage.classList.toggle('open', v);
  if (!v) cap.classList.remove('show');
  // 收起后按钮失去 pointer-events，要按当前位置重判穿透
  setTimeout(() => ct.refresh(), 40);
}

// ---- 状态同步 ----
window.lb.on('state', (s: AppState) => {
  st = s;
  document.documentElement.style.setProperty('--alpha', String(s.alpha));
  document.documentElement.style.setProperty('--s', String(s.scale));
  ring.querySelectorAll<HTMLElement>('.item').forEach((el) => el.classList.toggle('on', isOn(el.dataset.id as Item['id'])));
  layout();
});
window.lb.on('menu:test', (cmd: string) => { if (cmd === 'expand') setOpen(true); });

// ---- 子按钮 ----
ring.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('.item');
  if (!b) return;
  const id = b.dataset.id as Item['id'];
  if (id === 'mouse') { render(MOUSE); requestAnimationFrame(() => stage.classList.add('open')); return; }
  if (id === 'back') { render(MAIN); return; }
  window.lb.send('menu:action', id);
  if (id === 'hide') return;
  if (id === 'prompt' || id === 'annotate') setOpen(false);
});
ring.addEventListener('mouseover', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('.item');
  if (b) { cap.textContent = b.dataset.label ?? ''; cap.classList.add('show'); }
});
ring.addEventListener('mouseout', (e) => {
  if (!(e.relatedTarget as HTMLElement | null)?.closest('.item')) cap.classList.remove('show');
});

// ---- 核心球：单击展开，拖动移动，滚轮缩放 ----
let down: { x: number; y: number; id: number } | null = null;
let dragging = false;
core.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  down = { x: e.screenX, y: e.screenY, id: e.pointerId };
  dragging = false;
  core.setPointerCapture(e.pointerId);
  ct.lock();
});
core.addEventListener('pointermove', (e) => {
  if (!down || dragging) return;
  if (Math.hypot(e.screenX - down.x, e.screenY - down.y) > 4) { dragging = true; window.lb.send('menu:drag-start'); }
});
const endPointer = () => {
  if (!down) return;
  if (dragging) window.lb.send('menu:drag-end');
  else setOpen(!open);
  down = null; dragging = false;
  ct.unlock();
};
core.addEventListener('pointerup', endPointer);
core.addEventListener('lostpointercapture', () => { if (down) endPointer(); });

let lastWheel = 0;
core.addEventListener('wheel', (e) => {
  const now = performance.now();
  if (now - lastWheel < 70) return;
  lastWheel = now;
  window.lb.send('menu:zoom', Math.sign(e.deltaY));
}, { passive: true });

// ---- 空闲：6 秒没碰就停掉呼吸动画（0 帧），离开 2.5 秒自动收起 ----
let idleTimer = 0, closeTimer = 0;
function poke(): void {
  stage.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => stage.classList.add('idle'), 6000);
}
stage.addEventListener('mouseover', () => { poke(); clearTimeout(closeTimer); });
document.documentElement.addEventListener('mouseleave', () => {
  clearTimeout(closeTimer);
  if (open) closeTimer = window.setTimeout(() => setOpen(false), 2500);
});
core.addEventListener('mouseenter', () => clearTimeout(closeTimer));

render(MAIN);
poke();
