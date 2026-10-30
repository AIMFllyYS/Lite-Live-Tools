import { app, screen, type BrowserWindow } from 'electron';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { menuWindow, menuInteractive, hideMenu } from './menu';
import { openBoard, closeBoard, boardWindow } from './board';
import { setFxModes, fxWindow } from './fx';
import { toggleAgent, agentWindow } from './agent/panel';
import { memoryMB } from './tray';
import { ShakeDetector } from './shake';
import { setTheme } from './theme';

/**
 * 自检：跑一遍所有窗口，截图、测穿透、量内存，写 selftest/report.json 后退出。
 * 用法：npm run selftest
 */
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
/** 窗口中心点所在的屏幕（混合 DPI 多屏下 getDisplayMatching 会选错）。 */
const displayOf = (b: Electron.Rectangle) =>
  screen.getDisplayNearestPoint({ x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) }).bounds;
/** 125% 缩放下 DIP↔像素换算有 ±2px 取整误差，算作覆盖。 */
const covers = (w: Electron.Rectangle, d: Electron.Rectangle) =>
  Math.abs(w.x - d.x) <= 3 && Math.abs(w.y - d.y) <= 3 && Math.abs(w.width - d.width) <= 3 && Math.abs(w.height - d.height) <= 3;

export async function runSelftest(out: string): Promise<void> {
  mkdirSync(out, { recursive: true });
  const checks: { name: string; ok: boolean; detail?: string }[] = [];
  const mem: Record<string, ReturnType<typeof memoryMB>> = {};
  const check = (name: string, ok: boolean, detail?: string) => checks.push({ name, ok, detail });
  // 所有进程自上次调用以来的 CPU 占用之和（% of 一个核心）
  const cpuLoad: Record<string, number | Record<string, number>> = {};
  const cpu = () => Math.round(app.getAppMetrics().reduce((s, p) => s + p.cpu.percentCPUUsage, 0) * 10) / 10;
  const cpuByType = () => {
    const o: Record<string, number> = {};
    for (const p of app.getAppMetrics()) o[p.type] = Math.round(((o[p.type] ?? 0) + p.cpu.percentCPUUsage) * 10) / 10;
    return o;
  };
  const shot = async (w: BrowserWindow | null, name: string, maxW = 1280) => {
    if (!w) return;
    let img = await w.webContents.capturePage();
    if (img.getSize().width > maxW) img = img.resize({ width: maxW });
    writeFileSync(join(out, `${name}.png`), img.toPNG());
  };

  try {
    await wait(1800);
    cpu();
    await wait(6500); // 让菜单进入空闲（呼吸动画停帧）
    cpu();
    await wait(3000);
    cpuLoad.menuIdle = cpuByType();
    mem.menuOnly = memoryMB();

    // ---- 1. 穿透：按钮上可点，光晕/空白处穿透 ----
    const m = menuWindow()!;
    const size = m.getBounds().width; // 舞台 200，scale=1 时窗口坐标即舞台坐标
    const k = size / 200;
    const probe = async (x: number, y: number) => {
      m.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(x * k), y: Math.round(y * k) });
      await wait(150);
      return menuInteractive();
    };
    check('核心球中心 → 可点', await probe(100, 100));
    check('核心球边缘内 2px → 可点', await probe(100 + 20, 100));
    check('核心外光晕（距中心 30px）→ 穿透', !(await probe(100 + 30, 100)));
    check('窗口角落 → 穿透', !(await probe(4, 4)));
    check('收起时按钮位置 → 穿透', !(await probe(100, 34)));
    m.webContents.send('menu:test', 'expand');
    await wait(700);
    check('展开后顶部按钮 → 可点', await probe(100, 100 - 68));
    check('两个按钮之间 → 穿透', !(await probe(100 + 52, 100 - 52)));
    await probe(100, 100 - 68); // 停在按钮上，截图带悬停态
    await wait(300);
    await shot(m, 'menu-expanded');
    {
      const js = 'document.documentElement.dataset.theme';
      const before: string = await m.webContents.executeJavaScript(js);
      setTheme(before === 'dark' ? 'light' : 'dark');
      await wait(300);
      const after: string = await m.webContents.executeJavaScript(js);
      check('主题热切换（不重开窗口）', after !== before && (after === 'dark' || after === 'light'), `${before} → ${after}`);
      setTheme(before as 'dark' | 'light');
      await wait(300);
    }
    await probe(4, 4);
    mem.menuExpanded = memoryMB();

    // ---- 2. 晃动检测单元测试 ----
    const sd = new ShakeDetector();
    let lvl = 0;
    for (let i = 0; i < 30; i++) lvl = Math.max(lvl, sd.push(500 + (i % 2 ? 160 : -160), 400, i * 14));
    check('左右甩动 → 触发放大', lvl > 1, `level=${lvl.toFixed(2)}`);
    const sd2 = new ShakeDetector();
    let lvl2 = 0;
    for (let i = 0; i < 30; i++) lvl2 = Math.max(lvl2, sd2.push(100 + i * 30, 400, i * 14));
    check('直线快速移动 → 不触发', lvl2 === 0);

    // ---- 3. 标注 ----
    openBoard('annotate');
    await wait(1500);
    // CPU 基准：60 Hz 模拟画笔拖动 3 秒
    {
      const bw = boardWindow()!;
      const b = bw.getBounds();
      cpu();
      bw.webContents.sendInputEvent({ type: 'mouseDown', x: 300, y: 400, button: 'left', clickCount: 1 });
      for (let i = 0; i < 180; i++) {
        bw.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(300 + i * ((b.width - 600) / 180)), y: Math.round(400 + Math.sin(i / 9) * 120), button: 'left' } as Electron.MouseInputEvent);
        await wait(16);
      }
      bw.webContents.sendInputEvent({ type: 'mouseUp', x: b.width - 300, y: 400, button: 'left', clickCount: 1 });
      cpuLoad.boardDrawing = cpu();
    }
    boardWindow()?.webContents.send('board:test');
    await wait(600);
    await shot(boardWindow(), 'board-annotate');
    const b1 = boardWindow()!.getBounds();
    mem.board = memoryMB();
    openBoard('prompt');
    await wait(700);
    const b2 = boardWindow()!.getBounds();
    const disp = displayOf(b1);
    check('画布覆盖光标所在屏幕（标注）', covers(b1, disp), `${JSON.stringify(b1)} vs ${JSON.stringify(disp)}`);
    check('切到提示模式后尺寸不变', b2.width === b1.width && b2.height === b1.height, JSON.stringify(b2));
    await shot(boardWindow(), 'board-prompt');
    closeBoard();
    await wait(400);

    // ---- 4. 光标特效 ----
    setFxModes({ spotlight: true, laser: true });
    await wait(1500);
    fxWindow()?.webContents.send('fx:test');
    await wait(60); // 拖尾 320 ms 就淡出，要趁热截
    await shot(fxWindow(), 'fx-spotlight-laser');
    {
      const fb = fxWindow()!.getBounds();
      const fd = displayOf(fb);
      check('特效层覆盖光标所在屏幕', covers(fb, fd), `${JSON.stringify(fb)} vs ${JSON.stringify(fd)}`);
    }
    mem.fx = memoryMB();

    // CPU 基准：60 Hz 合成光标绕圈 3 秒（聚光灯 + 激光笔，最重的组合）
    {
      const fw = fxWindow()!;
      const b = fw.getBounds();
      cpu(); // 重置采样窗口
      for (let i = 0; i < 180; i++) {
        const a = i / 18;
        fw.webContents.send('fx:cursor', b.width / 2 + Math.cos(a) * 320, b.height / 2 + Math.sin(a) * 220);
        await wait(16);
      }
      cpuLoad.fxMoving = cpu();
      await wait(2000);
      cpu();
      await wait(3000);
      cpuLoad.fxIdle = cpuByType();
    }
    setFxModes({ spotlight: false, laser: false, shake: false });
    check('关闭全部特效 → 特效窗口销毁', (await wait(300), fxWindow() === null));

    // ---- 5. Agent 面板（Mock）----
    toggleAgent();
    await wait(7600);
    await shot(agentWindow(), 'agent-mock');
    mem.agent = memoryMB();
    toggleAgent();

    // ---- 6. 收进托盘后的待机占用 ----
    hideMenu();
    await wait(3000);
    cpu();
    await wait(3000);
    cpuLoad.trayIdle = cpuByType();
    mem.trayOnly = memoryMB();
    check('收进托盘 → 菜单窗口销毁', menuWindow() === null);
  } catch (err) {
    check('自检过程无异常', false, String(err));
  }

  writeFileSync(join(out, 'report.json'), JSON.stringify({
    at: new Date().toISOString(), electron: process.versions.electron,
    flags: { gpu: app.getGPUFeatureStatus().gpu_compositing },
    display: screen.getAllDisplays().map((d) => ({ bounds: d.bounds, scale: d.scaleFactor })),
    passed: checks.filter((c) => c.ok).length, total: checks.length, checks, cpuPercent: cpuLoad, memoryMB: mem,
  }, null, 2));
  app.exit(0);
}
