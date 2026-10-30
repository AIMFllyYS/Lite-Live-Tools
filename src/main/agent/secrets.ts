import { safeStorage } from 'electron';
import { settings, saveSettings } from '../store';

/** ASR 密钥：用系统凭据（Windows DPAPI / macOS Keychain）加密后存盘，只在主进程解密，不进渲染层。 */
export function setAsrKey(key: string): void {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('系统加密不可用，拒绝明文保存密钥');
  saveSettings({ asrKeyEnc: safeStorage.encryptString(key).toString('base64') });
}
export function getAsrKey(): string | null {
  const enc = settings().asrKeyEnc;
  if (!enc) return null;
  try { return safeStorage.decryptString(Buffer.from(enc, 'base64')); } catch { return null; }
}
export const hasAsrKey = (): boolean => !!settings().asrKeyEnc;
