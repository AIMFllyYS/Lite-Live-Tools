import '../shared/theme';
import { clickThrough } from '../shared/clickthrough';
import type { AgentComponentSpec, AgentStatus } from '../../shared/types';

/**
 * Agent 组件面板：把组件描述（JSON）渲染成卡片。
 * - 文本一律 textContent，不拼 innerHTML；
 * - html 类型放进 sandbox=""（无脚本、无同源）的 iframe。
 */
const MAX = 3;
const stack = document.getElementById('stack')!;
const dot = document.getElementById('dot')!;
const nameEl = document.getElementById('name')!;
const said = document.getElementById('said')!;
const ct = clickThrough('agent:interactive');

const el = (tag: string, cls: string, text?: string) => {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

function remove(node: HTMLElement): void {
  if (node.classList.contains('out')) return;
  node.classList.add('out');
  setTimeout(() => { node.remove(); ct.refresh(); }, 300);
}

function render(spec: AgentComponentSpec): HTMLElement {
  const c = el('div', 'comp');
  c.dataset.hit = '';
  if (spec.title) c.appendChild(el('div', 't', spec.title));
  switch (spec.type) {
    case 'card': c.appendChild(el('div', 'b', spec.body ?? '')); break;
    case 'stat': c.appendChild(el('div', 'v', spec.value ?? '')); break;
    case 'list': {
      const ul = el('ul', 'l');
      for (const it of spec.items ?? []) ul.appendChild(el('li', '', it));
      c.appendChild(ul);
      break;
    }
    case 'html': {
      const f = document.createElement('iframe');
      f.setAttribute('sandbox', '');
      f.srcdoc = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent;overflow:hidden}</style>${spec.html ?? ''}`;
      c.appendChild(f);
      break;
    }
  }
  const x = el('button', 'x', '×');
  x.addEventListener('click', () => remove(c));
  c.appendChild(x);
  return c;
}

window.lb.on('agent:component', (spec: AgentComponentSpec) => {
  const node = render(spec);
  stack.appendChild(node);
  const live = [...stack.children].filter((n) => !n.classList.contains('out')) as HTMLElement[];
  live.slice(0, Math.max(0, live.length - MAX)).forEach(remove);
  if (spec.ttlMs) setTimeout(() => remove(node), spec.ttlMs);
  ct.refresh();
});
window.lb.on('agent:status', (s: AgentStatus) => {
  nameEl.textContent = s.name;
  dot.classList.toggle('on', s.connected);
  said.textContent = s.transcript ? `“${s.transcript}”` : (s.connected ? '已连接' : '未连接');
});
