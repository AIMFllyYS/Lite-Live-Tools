import { ipcMain, screen, type BrowserWindow } from 'electron';
import { overlayWindow, page, from, clamp } from './common';
import { settings, saveSettings } from './store';
import { state, onState, patchState } from './state';
import type { Edge } from '../shared/types';

/** 舞台基准尺寸（DIP）。窗口 = BASE × scale，渲染层用 transform 缩放，不用 zoomFactor（它按源共享，会把画布也一起缩放）。 */
const BASE = 200;
const CORE_R = 22;     // 核心球半径
const EDGE_NEAR = 96;  // 核心离屏幕边多近算"贴边"，改为扇形展开

let win: BrowserWindow | null = null;
let interactive = false;
let dragTimer: NodeJS.Timeout | null = null;
let dragOff = { x: 0, y: 0 };

export const menuWindow = (): BrowserWindow | null => win;
export const menuInteractive = (): boolean => interactive;

export function showMenu(): void {
  if (win) { win.showInactive(); return; }
  const s = settings();
  const size = Math.round(BASE * s.scale);
  const wa = screen.getPrimaryDisplay().workArea;
  const pos = clampPos(s.menuX ?? wa.x + wa.width - size - 24, s.menuY ?? wa.y + Math.round(wa.height * 0.3), size);

  // focusable:false：点菜单不抢走游戏/OBS 的键盘焦点
  win = overlayWindow({ width: size, height: size, x: pos.x, y: pos.y, focusable: false });
  // 关键：默认整窗穿透，但把 mousemove 转发给页面，页面自己判断是否落在按钮上
  win.setIgnoreMouseEvents(true, { forward: true });
  interactive = false;
  win.loadFile(page('menu'));
  win.webContents.on('did-finish-load', pushState);
  win.once('ready-to-show', () => win?.showInactive());
  win.on('closed', () => { win = null; interactive = false; stopDrag(); });
  updateEdge();
}

/** 收进托盘 = 销毁窗口，渲染进程一起释放（约 25~35 MB）。 */
export function hideMenu(): void { if (win) win.destroy(); }
export function toggleMenu(): void { if (win) hideMenu(); else showMenu(); }

export function setMenuScale(next: number): void {
  next = Math.round(clamp(next, 0.6, 1.6) * 10) / 10;
  saveSettings({ scale: next });
  patchState({ scale: next });
  if (!win) return;
  const b = win.getBounds();
  const size = Math.round(BASE * next);
  const p = clampPos(Math.round(b.x + b.width / 2 - size / 2), Math.round(b.y + b.height / 2 - size / 2), size);
  win.setBounds({ x: p.x, y: p.y, width: size, height: size });
  updateEdge();
}
export function setMenuAlpha(a: number): void {
  a = clamp(a, 0.4, 1);
  saveSettings({ alpha: a });
  patchState({ alpha: a });
}

function pushState(): void {
  if (win && !win.isDestroyed()) win.webContents.send('state', state);
}
onState(pushState);

/** 让核心球始终完整留在某块屏幕内（窗口本身可以部分出屏）。 */
function clampPos(x: number, y: number, size: number): { x: number; y: number } {
  const cx = x + size / 2, cy = y + size / 2;
  const wa = screen.getDisplayNearestPoint({ x: Math.round(cx), y: Math.round(cy) }).workArea;
  const r = CORE_R * (size / BASE) + 6;
  const ncx = clamp(cx, wa.x + r, wa.x + wa.width - r);
  const ncy = clamp(cy, wa.y + r, wa.y + wa.height - r);
  return { x: Math.round(ncx - size / 2), y: Math.round(ncy - size / 2) };
}

function updateEdge(): void {
  if (!win) return;
  const b = win.getBounds();
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  const wa = screen.getDisplayNearestPoint({ x: Math.round(cx), y: Math.round(cy) }).workArea;
  const near = EDGE_NEAR * (b.width / BASE);
  const edge: Edge = {
    left: cx - wa.x < near,
    right: wa.x + wa.width - cx < near,
    top: cy - wa.y < near,
    bottom: wa.y + wa.height - cy < near,
  };
  const e = state.edge;
  if (e.left !== edge.left || e.right !== edge.right || e.top !== edge.top || e.bottom !== edge.bottom) patchState({ edge });
}

function stopDrag(): void { if (dragTimer) { clearInterval(dragTimer); dragTimer = null; } }

// ---- IPC ----
ipcMain.on('menu:interactive', (e, on: boolean) => {
  if (!from(win, e.sender) || on === interactive) return;
  interactive = on;
  win.setIgnoreMouseEvents(!on, { forward: true });
});

// 拖动由主进程跟随系统光标（DIP 坐标，多屏/高 DPI 下不会漂）
ipcMain.on('menu:drag-start', (e) => {
  if (!from(win, e.sender)) return;
  const c = screen.getCursorScreenPoint();
  const b = win.getBounds();
  dragOff = { x: c.x - b.x, y: c.y - b.y };
  stopDrag();
  dragTimer = setInterval(() => {
    if (!win) return stopDrag();
    const p = screen.getCursorScreenPoint();
    const size = win.getBounds().width;
    win.setBounds({ x: p.x - dragOff.x, y: p.y - dragOff.y, width: size, height: size });
  }, 8);
});
ipcMain.on('menu:drag-end', (e) => {
  if (!from(win, e.sender)) return;
  stopDrag();
  const b = win.getBounds();
  const p = clampPos(b.x, b.y, b.width);
  win.setBounds({ ...p, width: b.width, height: b.height });
  saveSettings({ menuX: p.x, menuY: p.y });
  updateEdge();
});
ipcMain.on('menu:zoom', (e, dir: number) => {
  if (!from(win, e.sender)) return;
  setMenuScale(settings().scale + (dir < 0 ? 0.1 : -0.1));
});
