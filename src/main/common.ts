import { app, BrowserWindow, type BrowserWindowConstructorOptions } from 'electron';
import { join } from 'node:path';
import { currentTheme } from './theme';

export const isProd = app.isPackaged || process.env.NODE_ENV === 'production';
/** dist/main.js 所在目录。 */
export const DIST = __dirname;
export const page = (name: string): string => join(DIST, 'renderer', name, 'index.html');

/** 加载页面，并把首帧主题带进 URL，页面第一帧就是对的颜色。 */
export function loadPage(win: BrowserWindow, name: string, query: Record<string, string> = {}): void {
  void win.loadFile(page(name), { query: { ...query, theme: currentTheme() } });
}

/**
 * 所有浮层窗口的公共配置：
 * - 透明无边框、不进任务栏、置顶到 screen-saver 层级；
 * - thickFrame:false + resizable:false：去掉 Windows 无边框窗口那圈看不见的 8px 缩放边框，
 *   它是"菜单外一圈点不透"的另一个来源；
 * - 沙箱 + contextIsolation，禁止导航和弹新窗口。
 */
export function overlayWindow(opts: BrowserWindowConstructorOptions): BrowserWindow {
  const win = new BrowserWindow({
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    thickFrame: false,
    show: false,
    alwaysOnTop: true,
    ...opts,
    webPreferences: {
      preload: join(DIST, 'preload.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: true,
      devTools: !isProd,
      enableWebSQL: false,
      ...opts.webPreferences,
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setMenu(null);
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  return win;
}

/** 只接受来自指定窗口的 IPC，防止别的窗口冒充。 */
export const from = (win: BrowserWindow | null, sender: Electron.WebContents): win is BrowserWindow =>
  !!win && !win.isDestroyed() && win.webContents === sender;

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

const same = (a: Electron.Rectangle, b: Electron.Rectangle) =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/**
 * 让窗口精确铺满某块屏幕。
 * Windows 混合 DPI（主屏 125%、副屏 100% 之类）下，第一次 setBounds 会先按旧屏 DPI 换算，
 * 窗口进到新屏后尺寸偏几个百分点；再设一次就准了。另外 show/setFocusable 后系统会把窗口压回工作区。
 */
let fitting = false;
export function fitTo(win: BrowserWindow, rect: Electron.Rectangle): void {
  if (fitting || win.isDestroyed()) return;
  fitting = true;
  try {
    for (let i = 0; i < 3 && !same(win.getBounds(), rect); i++) win.setBounds(rect);
  } finally { fitting = false; }
}
