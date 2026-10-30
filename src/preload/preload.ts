// 沙箱 preload：只暴露白名单内的 send/on，渲染层拿不到 ipcRenderer 本体。
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { SEND_CHANNELS, ON_CHANNELS, type LBApi } from '../shared/types';

const SEND = new Set<string>(SEND_CHANNELS);
const ON = new Set<string>(ON_CHANNELS);

const api: LBApi = {
  send(ch, ...args) { if (SEND.has(ch)) ipcRenderer.send(ch, ...args); },
  on(ch, cb) {
    if (!ON.has(ch)) return () => {};
    const l = (_e: IpcRendererEvent, ...a: unknown[]) => cb(...a);
    ipcRenderer.on(ch, l);
    return () => { ipcRenderer.removeListener(ch, l); };
  },
};
contextBridge.exposeInMainWorld('lb', api);
