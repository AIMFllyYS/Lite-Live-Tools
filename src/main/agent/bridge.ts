import type { AgentComponentSpec, AgentStatus } from '../../shared/types';

/**
 * 本地 Agent 接入口（实验）。真正的 Agent（ASR → LLM → 组件）在进程外运行，
 * 通过这个接口把"组件描述"推给左下角面板。协议见 docs/agent-protocol.md。
 */
export interface AgentBridge {
  readonly name: string;
  connect(): Promise<void>;
  dispose(): void;
  onComponent(cb: (spec: AgentComponentSpec) => void): () => void;
  onStatus(cb: (s: AgentStatus) => void): () => void;
}

class Emitter<T> {
  private subs = new Set<(v: T) => void>();
  on(cb: (v: T) => void): () => void { this.subs.add(cb); return () => { this.subs.delete(cb); }; }
  emit(v: T): void { for (const s of this.subs) s(v); }
}

/** 模拟实现：按台词脚本推送示例组件，用来调 UI 和协议。 */
export class MockAgentBridge implements AgentBridge {
  readonly name = 'Mock';
  private comp = new Emitter<AgentComponentSpec>();
  private stat = new Emitter<AgentStatus>();
  private timer: NodeJS.Timeout | null = null;
  private i = 0;
  private script: [string, AgentComponentSpec][] = [
    ['今天我们聊三件事', { id: 'm1', type: 'list', title: '今日议程', items: ['Electron 性能', '鼠标穿透', 'Agent 实时组件'] }],
    ['现在在线大概一千二百人', { id: 'm2', type: 'stat', title: '在线人数', value: '1,204' }],
    ['记一下，周五发版', { id: 'm3', type: 'card', title: '待办', body: '周五发布 v0.2，先过一遍内存回归', ttlMs: 9000 }],
    ['给大家看个渐变徽章', { id: 'm4', type: 'html', title: 'HTML 组件（沙箱）',
      html: '<div style="font:600 15px system-ui;color:#fff;padding:10px 14px;border-radius:12px;background:linear-gradient(120deg,#5ee7ff55,#b9a2ff55)">✨ 由 Agent 生成的 HTML，运行在无脚本沙箱里</div>' }],
  ];

  async connect(): Promise<void> {
    this.stat.emit({ name: this.name, connected: true, transcript: '（模拟数据）' });
    const step = () => {
      const [line, spec] = this.script[this.i++ % this.script.length]!;
      this.stat.emit({ name: this.name, connected: true, transcript: line });
      this.comp.emit({ ...spec, id: `${spec.id}-${this.i}` });
    };
    setTimeout(step, 600);
    this.timer = setInterval(step, 3200);
  }
  dispose(): void { if (this.timer) clearInterval(this.timer); this.timer = null; }
  onComponent(cb: (s: AgentComponentSpec) => void) { return this.comp.on(cb); }
  onStatus(cb: (s: AgentStatus) => void) { return this.stat.on(cb); }
}

/**
 * WebSocket 实现：连本机 Agent，例如 ws://127.0.0.1:8765。
 * 每条消息是 JSON：{"kind":"component","spec":{...}} 或 {"kind":"transcript","text":"..."}。
 * 只接受 loopback 地址。
 */
export class WebSocketAgentBridge implements AgentBridge {
  readonly name = 'Local Agent';
  private comp = new Emitter<AgentComponentSpec>();
  private stat = new Emitter<AgentStatus>();
  private ws: WebSocket | null = null;

  constructor(private url: string) {
    const host = new URL(url).hostname;
    if (!['127.0.0.1', 'localhost', '::1', '[::1]'].includes(host)) throw new Error('Agent 只允许连接本机地址');
  }
  async connect(): Promise<void> {
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => this.stat.emit({ name: this.name, connected: true });
    ws.onclose = () => this.stat.emit({ name: this.name, connected: false });
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data));
        if (msg.kind === 'component' && msg.spec && typeof msg.spec.id === 'string') this.comp.emit(msg.spec);
        else if (msg.kind === 'transcript') this.stat.emit({ name: this.name, connected: true, transcript: String(msg.text ?? '') });
      } catch { /* 丢弃坏消息 */ }
    };
  }
  dispose(): void { this.ws?.close(); this.ws = null; }
  onComponent(cb: (s: AgentComponentSpec) => void) { return this.comp.on(cb); }
  onStatus(cb: (s: AgentStatus) => void) { return this.stat.on(cb); }
}

export function createBridge(): AgentBridge {
  const url = process.env.LIVEBUDDY_AGENT_WS;
  return url ? new WebSocketAgentBridge(url) : new MockAgentBridge();
}
