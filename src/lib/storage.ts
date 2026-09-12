import { browser } from 'wxt/browser';
import type { CPBaseConfig, SyncLog } from './types';

const CONFIG_KEY = 'cpbase_config';
const LOGS_KEY = 'cpbase_sync_logs';
const MAX_LOGS = 50;

export const DEFAULT_CONFIG: CPBaseConfig = {
  githubToken: '',
  githubOwner: '',
  githubRepo: '',
  githubBranch: 'main',
  codeforcesHandle: '',
  enabledPlatforms: {
    codeforces: true,
    tlx: true,
  },
  autoSync: true,
};

export async function getConfig(): Promise<CPBaseConfig> {
  try {
    const res = await browser.storage.local.get(CONFIG_KEY);
    return res[CONFIG_KEY] ? { ...DEFAULT_CONFIG, ...res[CONFIG_KEY] } : DEFAULT_CONFIG;
  } catch (error) {
    console.error('[CPBase] Failed to read config:', error);
    return DEFAULT_CONFIG;
  }
}

export async function setConfig(config: CPBaseConfig): Promise<void> {
  await browser.storage.local.set({ [CONFIG_KEY]: config });
}

export async function getSyncLogs(): Promise<SyncLog[]> {
  try {
    const res = await browser.storage.local.get(LOGS_KEY);
    return Array.isArray(res[LOGS_KEY]) ? res[LOGS_KEY] : [];
  } catch (error) {
    console.error('[CPBase] Failed to read sync logs:', error);
    return [];
  }
}

export async function addSyncLog(log: SyncLog): Promise<void> {
  const logs = await getSyncLogs();
  const filtered = logs.filter((l) => l.id !== log.id);
  filtered.unshift(log);
  if (filtered.length > MAX_LOGS) {
    filtered.length = MAX_LOGS;
  }
  await browser.storage.local.set({ [LOGS_KEY]: filtered });
}

export async function updateSyncLog(id: string, updates: Partial<SyncLog>): Promise<void> {
  const logs = await getSyncLogs();
  const index = logs.findIndex((l) => l.id === id);
  if (index !== -1) {
    logs[index] = { ...logs[index], ...updates };
    await browser.storage.local.set({ [LOGS_KEY]: logs });
  }
}

export async function clearSyncLogs(): Promise<void> {
  await browser.storage.local.remove(LOGS_KEY);
}
