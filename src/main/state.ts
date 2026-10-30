import type { AppState } from '../shared/types';

export const state: AppState = {
  fx: { shake: false, spotlight: false, laser: false },
  board: null,
  agent: false,
  alpha: 0.8,
  scale: 1,
  edge: { left: false, right: false, top: false, bottom: false },
};

type Sub = (s: AppState) => void;
const subs = new Set<Sub>();
export function onState(cb: Sub): () => void { subs.add(cb); return () => { subs.delete(cb); }; }
export function patchState(p: Partial<AppState>): void {
  Object.assign(state, p);
  for (const s of subs) s(state);
}
