# LiveBuddy 直播小助手

托盘常驻的柔光悬浮小菜单：提示画布、屏幕标注、鼠标特效（晃动放大 / 聚光灯 / 激光笔）、Agent 面板（实验，Mock）。
TypeScript + Electron 45，无前端框架。

```bash
npm install
node node_modules/electron/install.js   # npm 11 默认不跑 electron 的安装脚本时需要
npm start          # 构建并启动
npm run selftest   # 自检：穿透命中测试 + 截图 + CPU/内存测量，结果在 selftest/
npm run typecheck
```

## 操作

| 动作 | 方式 |
|---|---|
| 展开 / 收起菜单 | 单击核心球 |
| 移动菜单 | 拖动核心球（贴边时自动改成扇形展开） |
| 调大小 | 在核心球上滚轮（60%~160%），或托盘 → 菜单大小 |
| 透明度 | 托盘 → 菜单不透明度 |
| 深色 / 浅色主题 | 托盘 → 主题（深色 / 浅色 / 跟随系统），所有窗口即时切换 |
| 显示 / 隐藏菜单 | 单击托盘图标，或 `Ctrl+Alt+L` |
| 标注 绘制 ↔ 穿透 | `Ctrl+Alt+D`；画布内 `Esc` 切到穿透 |
| 聚光灯 / 激光笔 | `Ctrl+Alt+S` / `Ctrl+Alt+P` |
| 画布内快捷键 | P 画笔 · R 方框 · O 圆 · A 箭头 · T 文字 · E 橡皮 · F 自动淡出 · Ctrl+Z/Y · Delete 清屏；Shift 约束正方/正圆/45° |

## 鼠标穿透怎么做的

1. 浮层窗口默认 `setIgnoreMouseEvents(true, { forward: true })`：点击全部落到下面，只把移动事件转发给页面。
2. 页面对每次移动做命中测试（`src/renderer/shared/clickthrough.ts`）：只有 `[data-hit]` 元素算实体，圆形按钮按真实圆形算；状态变化时才通知主进程切换。
3. 光晕、阴影都是 `pointer-events: none` 的独立层；窗口用 `thickFrame:false`，去掉 Windows 无边框窗口那圈看不见的缩放边框。
4. 离开窗口、DOM 变化（菜单收起）时强制重判，不会卡在"吃点击"。

## 性能

见 `docs/perf.md`。

## 文档

- `docs/agent-protocol.md`：本地 Agent 接入协议（WebSocket + JSON 组件描述）
- `docs/camera-beauty.md`：摄像头 + 美颜规划
- `PLAN.md`：总体规划
