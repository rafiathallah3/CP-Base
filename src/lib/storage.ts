import { browser } from 'wxt/browser';
import type { CPBaseConfig, SyncLog } from './types';

const CONFIG_KEY = 'cpbase_config';
const LOGS_KEY = 'cpbase_sync_logs';
const SYNCED_SUBMISSIONS_KEY = 'cpbase_synced_submissions';
const MAX_LOGS = 50;
const MAX_SYNCED_IDS = 500;

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
    if (typeof browser !== 'undefined' && browser.storage?.local) {
      const res = await browser.storage.local.get(CONFIG_KEY);
      return res[CONFIG_KEY] ? { ...DEFAULT_CONFIG, ...res[CONFIG_KEY] } : DEFAULT_CONFIG;
    }
    const local = typeof localStorage !== 'undefined' ? localStorage.getItem(CONFIG_KEY) : null;
    return local ? { ...DEFAULT_CONFIG, ...JSON.parse(local) } : DEFAULT_CONFIG;
  } catch (error) {
    console.error('[CPBase] Failed to read config:', error);
    return DEFAULT_CONFIG;
  }
}

export async function setConfig(config: CPBaseConfig): Promise<void> {
  try {
    if (typeof browser !== 'undefined' && browser.storage?.local) {
      await browser.storage.local.set({ [CONFIG_KEY]: config });
      return;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    }
  } catch (error) {
    console.error('[CPBase] Failed to set config:', error);
  }
}

export async function getSyncLogs(): Promise<SyncLog[]> {
  try {
    if (typeof browser !== 'undefined' && browser.storage?.local) {
      const res = await browser.storage.local.get(LOGS_KEY);
      return Array.isArray(res[LOGS_KEY]) ? res[LOGS_KEY] : [];
    }
    const local = typeof localStorage !== 'undefined' ? localStorage.getItem(LOGS_KEY) : null;
    return local ? JSON.parse(local) : [];
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
  if (typeof browser !== 'undefined' && browser.storage?.local) {
    await browser.storage.local.set({ [LOGS_KEY]: filtered });
  } else if (typeof localStorage !== 'undefined') {
    localStorage.setItem(LOGS_KEY, JSON.stringify(filtered));
  }
}

export async function updateSyncLog(id: string, updates: Partial<SyncLog>): Promise<void> {
  const logs = await getSyncLogs();
  const index = logs.findIndex((l) => l.id === id);
  if (index !== -1) {
    logs[index] = { ...logs[index], ...updates };
    if (typeof browser !== 'undefined' && browser.storage?.local) {
      await browser.storage.local.set({ [LOGS_KEY]: logs });
    } else if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
    }
  }
}

export async function clearSyncLogs(): Promise<void> {
  if (typeof browser !== 'undefined' && browser.storage?.local) {
    await browser.storage.local.remove(LOGS_KEY);
  } else if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(LOGS_KEY);
  }
}

export async function getSyncedSubmissionIds(): Promise<string[]> {
  try {
    if (typeof browser !== 'undefined' && browser.storage?.local) {
      const res = await browser.storage.local.get(SYNCED_SUBMISSIONS_KEY);
      return Array.isArray(res[SYNCED_SUBMISSIONS_KEY]) ? res[SYNCED_SUBMISSIONS_KEY] : [];
    }
    const local = typeof localStorage !== 'undefined' ? localStorage.getItem(SYNCED_SUBMISSIONS_KEY) : null;
    return local ? JSON.parse(local) : [];
  } catch (error) {
    console.error('[CPBase] Failed to read synced submissions:', error);
    return [];
  }
}

export async function isSubmissionSynced(platform: string, submissionId: string): Promise<boolean> {
  const key = `${platform}-${submissionId}`;
  const ids = await getSyncedSubmissionIds();
  if (ids.includes(key)) return true;

  const logs = await getSyncLogs();
  return logs.some((l) => l.id === key && l.status === 'success');
}

export async function markSubmissionSynced(platform: string, submissionId: string): Promise<void> {
  const key = `${platform}-${submissionId}`;
  const ids = await getSyncedSubmissionIds();
  if (!ids.includes(key)) {
    ids.unshift(key);
    if (ids.length > MAX_SYNCED_IDS) {
      ids.length = MAX_SYNCED_IDS;
    }
    if (typeof browser !== 'undefined' && browser.storage?.local) {
      await browser.storage.local.set({ [SYNCED_SUBMISSIONS_KEY]: ids });
    } else if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SYNCED_SUBMISSIONS_KEY, JSON.stringify(ids));
    }
  }
}
