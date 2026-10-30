import { ipcMain, screen, type BrowserWindow } from 'electron';
import { overlayWindow, page, from, clamp, fitTo } from './common';
import { settings, saveSettings } from './store';
import { patchState } from './state';
import type { BoardKind } from '../shared/types';

let win: BrowserWindow | null = null;
let full: Electron.Rectangle = { x: 0, y: 0, width: 0, height: 0 };

export const boardWindow = (): BrowserWindow | null => win;

/** Windows 在 show / setFocusable 之后会把窗口压回工作区（让出任务栏），这里重新铺满整块屏幕。 */
function cover(): void {
  if (win) fitTo(win, full);
}

/** 提示画布 / 标注：同一个窗口，两种默认状态。覆盖光标所在显示器。 */
export function openBoard(kind: BoardKind): void {
  patchState({ board: kind });
  if (win) {
    win.webContents.send('board:set-kind', kind);
    return;
  }
  const d = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  full = { ...d.bounds };
  win = overlayWindow({ ...d.bounds, focusable: false, enableLargerThanScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(page('board'), { query: { kind, bg: String(settings().boardBg) } });
  win.once('ready-to-show', () => { win?.showInactive(); cover(); });
  win.on('resize', cover);
  win.on('closed', () => { win = null; patchState({ board: null }); });
}

export function closeBoard(): void { if (win) win.destroy(); }

export function toggleBoardDraw(): void {
  if (!win) openBoard('annotate');
  else win.webContents.send('board:toggle-draw');
}

ipcMain.on('board:interactive', (e, on: boolean) => {
  if (from(win, e.sender)) win.setIgnoreMouseEvents(!on, { forward: true });
});
// 只有绘制/编辑文字时窗口才可获得焦点；穿透模式下不抢键盘
ipcMain.on('board:focus', (e, on: boolean) => {
  if (!from(win, e.sender)) return;
  win.setFocusable(on);
  if (on) win.focus(); else win.blur();
  cover();
});
ipcMain.on('board:close', (e) => { if (from(win, e.sender)) closeBoard(); });
ipcMain.on('board:bg', (e, v: number) => {
  if (from(win, e.sender)) saveSettings({ boardBg: clamp(Number(v) || 0, 0, 0.9) });
});
