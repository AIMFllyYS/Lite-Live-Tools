import type { SendChannel } from '../../shared/types';

/**
 * 鼠标穿透控制（渲染层一半）。
 *
 * 窗口默认 setIgnoreMouseEvents(true, {forward:true})：点击全部落到下面的桌面，
 * 只把 mousemove 转发进来。这里对每次移动做命中测试：
 *  - 只有 [data-hit] 元素算"实体"，光晕/阴影/空白都不算；
 *  - data-hit="circle" 按真实圆形判断，不按外接矩形（圆按钮四个角也能点透）；
 *  - 状态变化才发 IPC，移动本身不发。
 * lock(true) 用于拖动/绘制期间强制接管，unlock() 后按当前位置重新判断。
 */
export function clickThrough(channel: SendChannel) {
  let cur = false;
  let locked = false;
  let lx = -1, ly = -1;

  const send = (v: boolean) => { if (v !== cur) { cur = v; window.lb.send(channel, v); } };

  const hitAt = (x: number, y: number): boolean => {
    const h = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-hit]');
    if (!h) return false;
    if (h.dataset.hit === 'circle') {
      const r = h.getBoundingClientRect();
      const rad = Math.min(r.width, r.height) / 2;
      return (x - r.left - r.width / 2) ** 2 + (y - r.top - r.height / 2) ** 2 <= rad * rad;
    }
    return true;
  };

  window.addEventListener('mousemove', (e) => {
    lx = e.clientX; ly = e.clientY;
    if (!locked) send(hitAt(lx, ly));
  }, { passive: true });
  // 离开窗口：一定回到穿透，防止卡在"吃点击"
  document.documentElement.addEventListener('mouseleave', () => {
    lx = ly = -1;
    if (!locked) send(false);
  });

  return {
    get active() { return cur; },
    lock() { locked = true; send(true); },
    unlock() { locked = false; send(lx >= 0 ? hitAt(lx, ly) : false); },
    /** DOM 变了（比如菜单收起），按最后的光标位置重判。 */
    refresh() { if (!locked) send(lx >= 0 ? hitAt(lx, ly) : false); },
  };
}
