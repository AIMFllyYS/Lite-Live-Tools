# Agent 接入协议（实验）

目标：主播说话 → 本地 Agent（ASR → LLM）→ 左下角面板几百毫秒内出现对应组件。
LiveBuddy 只负责**展示**，识别和生成都在进程外，崩了也不影响直播助手本身。

## 链路

```
麦克风 ─▶ ASR（流式）─▶ Agent（LLM / 规则）─▶ ws://127.0.0.1:8765 ─▶ LiveBuddy 主进程 ─▶ Agent 面板
                         │
                         └─ 先发 transcript（实时字幕），再发 component
```

- 主进程里的接口：`src/main/agent/bridge.ts` 的 `AgentBridge`。
- 默认实现 `MockAgentBridge`，按脚本推示例组件。
- 设置环境变量 `LIVEBUDDY_AGENT_WS=ws://127.0.0.1:8765` 后改用 `WebSocketAgentBridge`；**只允许 loopback 地址**。

## 消息格式（Agent → LiveBuddy，每条一个 JSON 文本帧）

```jsonc
{ "kind": "transcript", "text": "现在在线大概一千二百人" }

{ "kind": "component", "spec": {
    "id": "stat-1",            // 必填；同 id 后续可用于更新（v0.2）
    "type": "stat",            // card | stat | list | html
    "title": "在线人数",
    "value": "1,204",
    "ttlMs": 8000              // 可选，自动消失
} }
```

| type | 字段 | 渲染 |
|---|---|---|
| `card` | `title`, `body` | 标题 + 一段文字 |
| `stat` | `title`, `value` | 大号数字 |
| `list` | `title`, `items[]` | 列表 |
| `html` | `title`, `html` | `<iframe sandbox="">`：**不能执行脚本**、无同源权限 |

所有文本走 `textContent`，不会被当成 HTML。面板最多同时显示 3 个组件。

## 为什么首选"组件描述"而不是让 LLM 直接写代码

延迟主要花在 LLM 生成上，前端渲染是几毫秒的事。JSON 组件描述的优点：
1. 输出 token 少（一个 `stat` 约 30 token；同样效果的 HTML+CSS 要 300+），延迟直接降一个量级；
2. 样式统一，跟菜单的柔光风格一致；
3. 安全：不执行 Agent 产出的代码。

需要自由排版时用 `html` 类型。参考 HyperFrames 的思路（HTML 片段 + 声明式动画属性），
后续可以在 iframe 里加载一份**我们自己打包的**动画运行时，Agent 只输出带 `data-*` 动画属性的 HTML，
仍然不允许 Agent 自带脚本。

## 延迟预算（目标端到端 < 800 ms）

| 段 | 目标 | 做法 |
|---|---|---|
| ASR 首字 | 200 ms | 流式 ASR，VAD 断句 |
| 意图 → 组件 | 400 ms | 小模型 / 规则优先；只在需要时调大模型；JSON 模式 |
| 传输 + 渲染 | < 30 ms | 本机 WebSocket；面板 DOM 增量插入 |

## ASR 密钥

`src/main/agent/secrets.ts`：`setAsrKey()` / `getAsrKey()` 用 Electron `safeStorage`
（Windows DPAPI）加密后存进 `settings.json`。密钥只在主进程解密，渲染层拿不到。
系统加密不可用时拒绝保存，不会退化成明文。

## 下一步（v0.2）

- 设置窗口里填 ASR 服务商和密钥；
- `spec.id` 相同则原地更新组件（数字跳动动画）；
- `{"kind":"clear"}` 清空面板；
- 面板位置可拖动、可记忆。
