# Lite-Live-Tools · LiveBuddy

轻量的 Windows 直播小助手：托盘常驻的柔光悬浮菜单，一键唤起提示画布、屏幕标注、鼠标特效。
TypeScript + Electron，无前端框架，托盘待机约 70 MB 内存、空闲 0% CPU。

- **悬浮菜单**：半透明玻璃球，柔光呼吸；可拖动、滚轮缩放、贴边自动扇形展开；**菜单外一圈完全鼠标穿透**
- **提示画布**：置顶最高层，透明度可调，"马上回来 / 休息 5 分钟"倒计时，大字可直接编辑
- **屏幕标注**：画笔（压感）、方框、圆、箭头、文字、橡皮、撤销重做、笔迹自动淡出；绘制 ↔ 穿透一键切换
- **鼠标特效**：晃动放大（macOS 同款）、聚光灯、激光笔
- **深色 / 浅色 / 跟随系统** 主题
- **Agent 面板（实验）**：本地 Agent 通过 WebSocket 推送组件，见 [docs/agent-protocol.md](docs/agent-protocol.md)

## 下载

到 [Releases](https://github.com/AIMFllyYS/Lite-Live-Tools/releases) 下载：

| 文件 | 说明 |
|---|---|
| `Lite-Live-Tools-x.y.z-portable.exe` | 便携版，双击即用，不用安装 |
| `Lite-Live-Tools-x.y.z-setup.exe` | 安装版，可选安装目录，带开始菜单快捷方式 |

exe 没有代码签名，首次运行 Windows SmartScreen 可能提示"未知发布者"，点"更多信息 → 仍要运行"。

启动后不会弹主窗口：屏幕右侧出现一颗小球，托盘区出现发光小圆点图标。

## 使用

| 动作 | 方式 |
|---|---|
| 展开 / 收起菜单 | 单击小球 |
| 移动菜单 | 拖动小球 |
| 调大小 | 在小球上滚动滚轮（60%~160%），或托盘右键 → 菜单大小 |
| 显示 / 隐藏菜单 | 单击托盘图标，或 `Ctrl+Alt+L` |
| 透明度 / 主题 / 开机启动 / 退出 | 托盘图标右键 |
| 标注：绘制 ↔ 穿透 | `Ctrl+Alt+D`；画布里按 `Esc` 切到穿透 |
| 聚光灯 / 激光笔 | `Ctrl+Alt+S` / `Ctrl+Alt+P` |
| 画布快捷键 | P 画笔 · R 方框 · O 圆 · A 箭头 · T 文字 · E 橡皮 · F 自动淡出 · Ctrl+Z / Ctrl+Y · Delete 清屏；按住 Shift 画正方形 / 正圆 / 45° 箭头 |

## 从源码运行

需要 Node.js 22+。

```bash
git clone https://github.com/AIMFllyYS/Lite-Live-Tools.git
cd Lite-Live-Tools
npm install
node node_modules/electron/install.js   # npm 11 默认不跑 electron 的安装脚本，需要手动执行一次
npm start
```

| 命令 | 作用 |
|---|---|
| `npm start` | 构建并启动 |
| `npm run selftest` | 自检：穿透命中测试、截图、CPU/内存测量，结果写到 `selftest/` |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run dist` | 打包 exe（便携版 + 安装版）到 `release/` |

## 鼠标穿透怎么做的

透明浮层的经典问题：光晕、阴影让窗口比按钮大一圈，这一圈看着是空的却挡住点击。

1. 浮层窗口默认 `setIgnoreMouseEvents(true, { forward: true })`：点击全部落到下面，只把移动事件转发给页面。
2. 页面对每次移动做命中测试（[clickthrough.ts](src/renderer/shared/clickthrough.ts)）：只有 `[data-hit]` 元素算实体，圆形按钮按真实圆形算；状态变化才通知主进程切换。
3. 光晕、阴影是 `pointer-events: none` 的独立层；窗口用 `thickFrame: false`，去掉 Windows 无边框窗口那圈看不见的 8 px 缩放边框。
4. 离开窗口、菜单收起时强制重判，不会卡在"吃点击"状态。

## 性能

默认软件渲染：这个应用每帧要画的很少，而 GPU 模式下全屏透明窗口的合成表面会让 GPU 进程多占 100~450 MB。托盘里可以打开 GPU 加速。
窗口按需创建、关掉即销毁，空闲 0 帧。详细数据和做法见 [docs/perf.md](docs/perf.md)。

## 目录

```
src/main/        主进程：窗口、托盘、穿透、光标轮询、晃动检测、主题、Agent 桥
src/preload/     沙箱 preload（IPC 白名单）
src/renderer/    menu / board / fx / agent 四个页面 + shared（穿透、图标、主题）
scripts/         esbuild 构建、图标生成、自检摘要
docs/            性能记录、Agent 协议、摄像头美颜规划
```

## License

[MIT](LICENSE)
