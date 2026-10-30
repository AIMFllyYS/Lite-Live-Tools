import { app } from 'electron';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

export interface Settings {
  menuX?: number;
  menuY?: number;
  scale: number;
  alpha: number;
  boardBg: number;
  gpu: boolean;     // GPU 加速，默认关（见 index.ts 的测量说明）
  theme: ThemeMode;
  asrKeyEnc?: string; // safeStorage 加密后的 base64
}
export type ThemeMode = 'dark' | 'light' | 'system';
const DEFAULTS: Settings = { scale: 1, alpha: 0.8, boardBg: 0.35, gpu: false, theme: 'dark' };

let file = '';
let data: Settings = { ...DEFAULTS };
let timer: NodeJS.Timeout | null = null;

export function loadSettings(): Settings {
  file = join(app.getPath('userData'), 'settings.json');
  try { data = { ...DEFAULTS, ...JSON.parse(readFileSync(file, 'utf8')) }; } catch { /* 首次运行 */ }
  return data;
}
export const settings = (): Settings => data;

/** 合并修改，400 ms 去抖后落盘（拖动菜单时不会每帧写文件）。 */
export function saveSettings(patch: Partial<Settings>): void {
  Object.assign(data, patch);
  if (timer) clearTimeout(timer);
  timer = setTimeout(flushSettings, 400);
}
export function flushSettings(): void {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!file) return;
  try { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(data, null, 2)); } catch { /* 忽略 */ }
}
