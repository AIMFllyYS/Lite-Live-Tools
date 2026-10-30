/**
 * 主题：<html data-theme="dark|light">。首帧从 URL 参数读（不闪），之后跟主进程的 'theme' 事件热切换。
 * 各页面 CSS 用 :root[data-theme="light"] 覆盖变量；需要改 canvas 配色的页面监听 'themechange'。
 */
export type Theme = 'dark' | 'light';
export const theme = (): Theme => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

function apply(t: Theme): void {
  document.documentElement.dataset.theme = t;
  dispatchEvent(new CustomEvent<Theme>('themechange', { detail: t }));
}

apply(new URLSearchParams(location.search).get('theme') === 'light' ? 'light' : 'dark');
window.lb.on('theme', (t: Theme) => apply(t === 'light' ? 'light' : 'dark'));
