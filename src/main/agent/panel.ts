import { ipcMain, screen, type BrowserWindow } from 'electron';
import { overlayWindow, page, from } from '../common';
import { patchState } from '../state';
import { createBridge, type AgentBridge } from './bridge';

/** 左下角 Agent 面板。打开才创建窗口和连接，关掉一起释放。 */
let win: BrowserWindow | null = null;
let bridge: AgentBridge | null = null;
let offs: (() => void)[] = [];

export const agentWindow = (): BrowserWindow | null => win;
export function toggleAgent(): void { if (win) win.destroy(); else openAgent(); }

function openAgent(): void {
  const wa = screen.getPrimaryDisplay().workArea;
  const W = 380, H = 360;
  win = overlayWindow({ width: W, height: H, x: wa.x + 16, y: wa.y + wa.height - H - 16, focusable: false });
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(page('agent'));
  win.once('ready-to-show', () => win?.showInactive());
  win.webContents.once('did-finish-load', () => {
    try { bridge = createBridge(); } catch { bridge = null; return; }
    offs = [
      bridge.onComponent((s) => win?.webContents.send('agent:component', s)),
      bridge.onStatus((s) => win?.webContents.send('agent:status', s)),
    ];
    void bridge.connect();
  });
  win.on('closed', () => {
    offs.forEach((f) => f()); offs = [];
    bridge?.dispose(); bridge = null;
    win = null;
    patchState({ agent: false });
  });
  patchState({ agent: true });
}

ipcMain.on('agent:interactive', (e, on: boolean) => {
  if (from(win, e.sender)) win.setIgnoreMouseEvents(!on, { forward: true });
});
