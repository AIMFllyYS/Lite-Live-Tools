// 主进程与渲染进程共用的类型和 IPC 通道白名单。
export interface FxModes { shake: boolean; spotlight: boolean; laser: boolean }
export type BoardKind = 'prompt' | 'annotate';
export interface Edge { left: boolean; right: boolean; top: boolean; bottom: boolean }

export interface AppState {
  fx: FxModes;
  board: BoardKind | null;
  agent: boolean;
  alpha: number; // 菜单整体不透明度 0.4~1
  scale: number; // 菜单缩放 0.6~1.6
  edge: Edge;    // 菜单贴近哪条屏幕边，决定展开方向
}

export type MenuAction =
  | 'prompt' | 'annotate' | 'agent' | 'hide'
  | 'fx:shake' | 'fx:spotlight' | 'fx:laser';

/** Agent 推给前端的组件描述。html 类型会进 sandbox iframe，不能执行脚本。 */
export interface AgentComponentSpec {
  id: string;
  type: 'card' | 'stat' | 'list' | 'html';
  title?: string;
  body?: string;
  value?: string;
  items?: string[];
  html?: string;
  ttlMs?: number;
}
export interface AgentStatus { name: string; connected: boolean; transcript?: string }

export const SEND_CHANNELS = [
  'menu:interactive', 'menu:drag-start', 'menu:drag-end', 'menu:zoom', 'menu:action',
  'board:interactive', 'board:focus', 'board:close', 'board:bg',
  'agent:interactive',
] as const;
export const ON_CHANNELS = [
  'state', 'theme', 'menu:test',
  'board:set-kind', 'board:toggle-draw', 'board:test',
  'fx:modes', 'fx:cursor', 'fx:big', 'fx:test',
  'agent:component', 'agent:status',
] as const;
export type SendChannel = (typeof SEND_CHANNELS)[number];
export type OnChannel = (typeof ON_CHANNELS)[number];

export interface LBApi {
  send(ch: SendChannel, ...args: unknown[]): void;
  on(ch: OnChannel, cb: (...args: any[]) => void): () => void;
}
declare global { interface Window { lb: LBApi } }
