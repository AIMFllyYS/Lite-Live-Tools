import { screen, type BrowserWindow } from 'electron';
import { overlayWindow, page, fitTo } from './common';
import { state, patchState } from './state';
import { ShakeDetector } from './shake';
import type { FxModes } from '../shared/types';

/**
 * 光标特效层：一个永久完全穿透的透明窗口（不转发鼠标，也不可聚焦）。
 * 只在至少开了一种特效时存在。主进程 60 Hz 轮询系统光标：
 * - 只开"晃动放大"时，检测在主进程完成，没晃就一条 IPC 都不发；
 * - 聚光灯/激光笔/放大中才把坐标推给渲染层，而且坐标不变就不推。
 */
let win: BrowserWindow | null = null;
let timer: NodeJS.Timeout | null = null;
let displayId = -1;
let origin = { x: 0, y: 0 };
let lastX = NaN, lastY = NaN;
let bigScale = 1, bigUntil = 0;
const shake = new ShakeDetector();

export const fxWindow = (): BrowserWindow | null => win;

export function setFxModes(p: Partial<FxModes>): void {
  const fx = { ...state.fx, ...p };
  patchState({ fx });
  if (!fx.shake && !fx.spotlight && !fx.laser) { destroy(); return; }
  ensure();
  win!.webContents.send('fx:modes', fx);
  lastX = NaN; // 让下一 tick 立即推一次坐标
}

function ensure(): void {
  if (win) return;
  const d = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  displayId = d.id;
  origin = { x: d.bounds.x, y: d.bounds.y };
  win = overlayWindow({ ...d.bounds, focusable: false, enableLargerThanScreen: true });
  win.setIgnoreMouseEvents(true);
  win.loadFile(page('fx'));
  win.webContents.on('did-finish-load', () => { win?.webContents.send('fx:modes', state.fx); lastX = NaN; });
  win.once('ready-to-show', () => { win?.showInactive(); win?.moveTop(); if (win) fitTo(win, d.bounds); });
  win.on('closed', () => { win = null; stopTimer(); });
  schedule(16);
}

// 自适应轮询：光标在动 → 60 Hz；静止 300 ms 后 → 15 Hz（开始移动最多晚 66 ms 被发现）
let still = 0;
function schedule(ms: number): void {
  if (timer) clearInterval(timer);
  timer = setInterval(tick, ms);
}

function destroy(): void { stopTimer(); if (win) win.destroy(); }
function stopTimer(): void { if (timer) { clearInterval(timer); timer = null; } shake.reset(); bigScale = 1; still = 0; }

function tick(): void {
  if (!win) return;
  const p = screen.getCursorScreenPoint();
  const now = performance.now();
  const moved = p.x !== lastX || p.y !== lastY;
  const fx = state.fx;

  if (moved) { if (still >= 18) schedule(16); still = 0; }
  else if (++still === 18) schedule(66);

  if (fx.shake && moved) {
    const lvl = shake.push(p.x, p.y, now);
    if (lvl > 0) {
      bigUntil = now + 900;
      if (lvl > bigScale + 0.15) { bigScale = lvl; win.webContents.send('fx:big', bigScale); }
    }
  }
  if (bigScale > 1 && now > bigUntil) { bigScale = 1; win.webContents.send('fx:big', 1); }

  if (!moved) return;
  lastX = p.x; lastY = p.y;
  if (!(fx.spotlight || fx.laser || bigScale > 1)) return;

  // 光标跨屏：特效层跟过去
  const d = screen.getDisplayNearestPoint(p);
  if (d.id !== displayId) {
    displayId = d.id;
    origin = { x: d.bounds.x, y: d.bounds.y };
    fitTo(win, d.bounds);
  }
  win.webContents.send('fx:cursor', p.x - origin.x, p.y - origin.y);
}
