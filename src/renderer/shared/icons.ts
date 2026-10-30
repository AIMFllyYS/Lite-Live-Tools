// Lucide 风格线性图标（24 网格，描边由 CSS 控制）。手写内联，不引整个图标库。
const svg = (d: string) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;

export const I = {
  prompt: svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/>'),
  pen: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  mouse: svg('<path d="M4.5 4.5 11 20l2.3-6.7L20 11z"/>'),
  spark: svg('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>'),
  tray: svg('<path d="M4 14h4l1.5 2.5h5L16 14h4"/><path d="M4 14l2.5-8h11L20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>'),
  shake: svg('<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>'),
  spot: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  laser: svg('<circle cx="12" cy="12" r="2.2"/><path d="M12 2v4.5M12 17.5V22M2 12h4.5M17.5 12H22"/>'),
  back: svg('<path d="m15 18-6-6 6-6"/>'),
  rect: svg('<rect x="4" y="5" width="16" height="14" rx="2"/>'),
  ellipse: svg('<ellipse cx="12" cy="12" rx="9" ry="7"/>'),
  arrow: svg('<path d="M5 19 19 5M9 5h10v10"/>'),
  text: svg('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>'),
  eraser: svg('<path d="m7 21-4-4a2 2 0 0 1 0-2.8L13.2 4a2 2 0 0 1 2.8 0l4 4a2 2 0 0 1 0 2.8L11 21"/><path d="M7 21h13M9 10l5 5"/>'),
  undo: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'),
  redo: svg('<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>'),
  trash: svg('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>'),
  fade: svg('<path d="M12 3a9 9 0 1 0 9 9"/><path d="M15 3.5a9 9 0 0 1 5.5 5.5" stroke-dasharray="2 3"/>'),
  close: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  hand: svg('<path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 0 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-6-2.4l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/>'),
  card: svg('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 10h10M9 14h6"/>'),
  sun: svg('<circle cx="12" cy="12" r="3.5"/><path d="M12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21"/>'),
};
