import { app, Menu, globalShortcut, ipcMain } from 'electron';
import { join } from 'node:path';
import { loadSettings, saveSettings, flushSettings } from './store';
import { state, patchState } from './state';
import { showMenu, hideMenu, toggleMenu, setMenuScale, setMenuAlpha, menuWindow } from './menu';
import { openBoard, closeBoard, toggleBoardDraw } from './board';
import { setFxModes } from './fx';
import { toggleAgent } from './agent/panel';
import { createTray } from './tray';
import type { MenuAction } from '../shared/types';

// ---- 启动前：关掉用不到的 Chromium 功能，少起后台任务 ----
app.commandLine.appendSwitch('disable-features', [
  'HardwareMediaKeyHandling', 'MediaSessionService', 'SpareRendererForSitePerProcess',
  'Translate', 'OptimizationHints', 'AutofillServerCommunication', 'CertificateTransparencyComponentUpdater',
].join(','));
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-domain-reliability');
Menu.setApplicationMenu(null);
app.setAppUserModelId('dev.livebuddy.app');

const selftest = process.argv.includes('--selftest');
// 自检用独立的配置目录，不污染真实设置
if (selftest) app.setPath('userData', join(app.getAppPath(), 'selftest', 'userData'));
const boot = loadSettings();

/*
 * 默认软件渲染。实测（2560×1600 物理像素屏）：GPU 模式下全屏透明窗口的合成表面让 GPU 进程
 * 多占 100~450 MB，而这个应用的绘制量很小，软件渲染 CPU 同样 ≈0%（空闲）/ 2~3%（绘制）。
 * 托盘里可切回 GPU 加速。LB_GPU=1 / LB_SOFTWARE=1 供自检对比。
 */
const useGpu = process.env.LB_GPU === '1' || (process.env.LB_SOFTWARE !== '1' && boot.gpu);
if (!useGpu) app.disableHardwareAcceleration();

if (!selftest && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showMenu());
  app.whenReady().then(start);
}

function handleAction(a: MenuAction): void {
  switch (a) {
    case 'prompt': state.board === 'prompt' ? closeBoard() : openBoard('prompt'); break;
    case 'annotate': state.board === 'annotate' ? closeBoard() : openBoard('annotate'); break;
    case 'fx:shake': setFxModes({ shake: !state.fx.shake }); break;
    case 'fx:spotlight': setFxModes({ spotlight: !state.fx.spotlight }); break;
    case 'fx:laser': setFxModes({ laser: !state.fx.laser }); break;
    case 'agent': toggleAgent(); break;
    case 'hide': hideMenu(); break;
  }
}

function start(): void {
  const s = boot;
  patchState({ alpha: s.alpha, scale: s.scale });

  ipcMain.on('menu:action', (e, a: MenuAction) => {
    const m = menuWindow();
    if (m && e.sender === m.webContents) handleAction(a);
  });

  createTray({
    toggleMenu,
    action: handleAction,
    setScale: setMenuScale,
    setAlpha: setMenuAlpha,
    gpu: useGpu,
    setGpu: (on: boolean) => { saveSettings({ gpu: on }); flushSettings(); app.relaunch(); app.exit(0); },
    quit: () => app.quit(),
  });

  globalShortcut.register('Control+Alt+L', toggleMenu);
  globalShortcut.register('Control+Alt+D', toggleBoardDraw);
  globalShortcut.register('Control+Alt+S', () => handleAction('fx:spotlight'));
  globalShortcut.register('Control+Alt+P', () => handleAction('fx:laser'));

  showMenu();

  if (selftest) {
    void import('./selftest').then((m) => m.runSelftest(join(app.getAppPath(), 'selftest')));
  }
}

// 常驻托盘：所有窗口关掉也不退出
app.on('window-all-closed', () => { /* keep alive */ });
app.on('will-quit', () => { globalShortcut.unregisterAll(); flushSettings(); });
