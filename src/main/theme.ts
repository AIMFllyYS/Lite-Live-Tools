import { BrowserWindow, nativeTheme } from 'electron';
import { settings, saveSettings, type ThemeMode } from './store';

/**
 * 全局主题：深色 / 浅色 / 跟随系统。
 * 用 nativeTheme.themeSource 统一控制，托盘右键菜单也跟着变色；
 * 页面通过 URL 参数拿到首帧主题（不闪），之后靠 'theme' 事件热切换。
 */
export type Theme = 'dark' | 'light';
export const currentTheme = (): Theme => (nativeTheme.shouldUseDarkColors ? 'dark' : 'light');

export function initTheme(override?: string): void {
  const mode: ThemeMode = override === 'light' || override === 'dark' ? override : settings().theme;
  nativeTheme.themeSource = mode;
  nativeTheme.on('updated', broadcast); // 跟随系统时，系统切换会触发
}

export function setTheme(mode: ThemeMode): void {
  saveSettings({ theme: mode });
  nativeTheme.themeSource = mode;
  broadcast();
}

let last: Theme | null = null;
function broadcast(): void {
  const t = currentTheme();
  if (t === last) return;
  last = t;
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('theme', t);
}
