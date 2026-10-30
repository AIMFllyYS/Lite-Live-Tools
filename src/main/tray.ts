import { app, Menu, Tray, type MenuItemConstructorOptions } from 'electron';
import { makeTrayIcon } from './icon';
import { state } from './state';
import { settings } from './store';

export interface TrayHandlers {
  toggleMenu(): void;
  action(a: 'prompt' | 'annotate' | 'agent' | 'fx:shake' | 'fx:spotlight' | 'fx:laser'): void;
  setScale(s: number): void;
  setAlpha(a: number): void;
  gpu: boolean;
  setGpu(on: boolean): void;
  quit(): void;
}

let tray: Tray | null = null;

/** 内存占用（MB）：所有 Electron 进程工作集与私有字节之和，外加按进程类型拆分的私有字节。 */
export function memoryMB(): { workingSet: number; private: number; processes: number; byType: Record<string, number> } {
  const m = app.getAppMetrics();
  let ws = 0, pv = 0;
  const byType: Record<string, number> = {};
  for (const p of m) {
    ws += p.memory.workingSetSize; pv += p.memory.privateBytes ?? 0;
    const k = p.type === 'Utility' ? `Utility:${p.serviceName ?? ''}` : p.type;
    byType[k] = (byType[k] ?? 0) + Math.round((p.memory.privateBytes ?? 0) / 1024);
  }
  return { workingSet: Math.round(ws / 1024), private: Math.round(pv / 1024), processes: m.length, byType };
}

export function createTray(h: TrayHandlers): void {
  tray = new Tray(makeTrayIcon());
  tray.setToolTip('LiveBuddy 直播小助手');
  tray.on('click', h.toggleMenu);
  // 每次右键现建菜单，顺便显示实时内存
  tray.on('right-click', () => tray?.popUpContextMenu(build(h)));
}

function build(h: TrayHandlers): Menu {
  const mem = memoryMB();
  const s = settings();
  const scales = [0.6, 0.8, 1, 1.2, 1.4, 1.6];
  const alphas = [0.5, 0.65, 0.8, 0.95];
  const t: MenuItemConstructorOptions[] = [
    { label: '显示 / 隐藏悬浮菜单\tCtrl+Alt+L', click: h.toggleMenu },
    { type: 'separator' },
    { label: '提示画布', type: 'checkbox', checked: state.board === 'prompt', click: () => h.action('prompt') },
    { label: '标注\tCtrl+Alt+D', type: 'checkbox', checked: state.board === 'annotate', click: () => h.action('annotate') },
    { label: '鼠标特效', submenu: [
      { label: '晃动放大', type: 'checkbox', checked: state.fx.shake, click: () => h.action('fx:shake') },
      { label: '聚光灯\tCtrl+Alt+S', type: 'checkbox', checked: state.fx.spotlight, click: () => h.action('fx:spotlight') },
      { label: '激光笔\tCtrl+Alt+P', type: 'checkbox', checked: state.fx.laser, click: () => h.action('fx:laser') },
    ] },
    { label: 'Agent 面板（实验）', type: 'checkbox', checked: state.agent, click: () => h.action('agent') },
    { type: 'separator' },
    { label: '菜单大小', submenu: scales.map((v) => ({
      label: `${Math.round(v * 100)}%`, type: 'radio' as const, checked: Math.abs(s.scale - v) < 0.05, click: () => h.setScale(v) })) },
    { label: '菜单不透明度', submenu: alphas.map((v) => ({
      label: `${Math.round(v * 100)}%`, type: 'radio' as const, checked: Math.abs(s.alpha - v) < 0.03, click: () => h.setAlpha(v) })) },
    { label: '开机启动', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin,
      click: (mi) => app.setLoginItemSettings({ openAtLogin: mi.checked }) },
    { label: 'GPU 加速（多占约 100~400 MB，切换会重启）', type: 'checkbox', checked: h.gpu, click: (mi) => h.setGpu(mi.checked) },
    { type: 'separator' },
    { label: `内存 ${mem.workingSet} MB · ${mem.processes} 个进程`, enabled: false },
    { label: '退出', click: h.quit },
  ];
  return Menu.buildFromTemplate(t);
}
