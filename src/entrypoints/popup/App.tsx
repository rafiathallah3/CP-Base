import React, { useState, useEffect } from 'react';
import {
  Key,
  FolderGit2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  PlusCircle,
  Clock,
  Settings,
  List,
  Eye,
  EyeOff,
  Github,
} from 'lucide-react';
import { getConfig, setConfig, getSyncLogs, clearSyncLogs } from '@/lib/storage';
import { verifyGitHubToken, listUserRepos, createRepo } from '@/lib/github';
import type { CPBaseConfig, GitHubRepo, GitHubUser, SyncLog } from '@/lib/types';

export default function App() {
  const [tab, setTab] = useState<'settings' | 'history'>('settings');
  const [config, setConfigState] = useState<CPBaseConfig | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [createNewRepo, setCreateNewRepo] = useState(false);
  const [newRepoName, setNewRepoName] = useState('competitive-programming');
  const [newRepoPrivate, setNewRepoPrivate] = useState(false);

  const [logs, setLogs] = useState<SyncLog[]>([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    setLoading(true);
    try {
      const cfg = await getConfig();
      setConfigState(cfg);
      setTokenInput(cfg.githubToken || '');

      const syncLogs = await getSyncLogs();
      setLogs(syncLogs);

      if (cfg.githubToken) {
        try {
          const ghUser = await verifyGitHubToken(cfg.githubToken);
          setUser(ghUser);
          const ghRepos = await listUserRepos(cfg.githubToken);
          setRepos(ghRepos);
        } catch {
          // Token might have expired or be invalid
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyToken() {
    if (!tokenInput.trim()) {
      setMessage({ text: 'Please enter a GitHub Personal Access Token.', type: 'error' });
      return;
    }

    setVerifying(true);
    setMessage(null);

    try {
      const ghUser = await verifyGitHubToken(tokenInput.trim());
      setUser(ghUser);

      const ghRepos = await listUserRepos(tokenInput.trim());
      setRepos(ghRepos);

      // Update config
      if (config) {
        const updated = {
          ...config,
          githubToken: tokenInput.trim(),
          githubOwner: ghUser.login,
          githubRepo: config.githubRepo || ghRepos[0]?.name || '',
        };
        setConfigState(updated);
        await setConfig(updated);
      }

      setMessage({ text: `Connected as @${ghUser.login}!`, type: 'success' });
    } catch (err: any) {
      setUser(null);
      setMessage({ text: err.message || 'Token verification failed.', type: 'error' });
    } finally {
      setVerifying(false);
    }
  }

  async function handleCreateRepo() {
    if (!tokenInput.trim() || !newRepoName.trim()) return;
    setLoading(true);
    setMessage(null);

    try {
      const repo = await createRepo(tokenInput.trim(), newRepoName.trim(), newRepoPrivate);
      setRepos([repo, ...repos]);
      setCreateNewRepo(false);

      if (config && user) {
        const updated = {
          ...config,
          githubRepo: repo.name,
          githubBranch: repo.default_branch || 'main',
        };
        setConfigState(updated);
        await setConfig(updated);
      }

      setMessage({ text: `Created repository ${repo.name}!`, type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to create repository.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveConfig(updates: Partial<CPBaseConfig>) {
    if (!config) return;
    const updated = { ...config, ...updates };
    setConfigState(updated);
    await setConfig(updated);
    setMessage({ text: 'Settings updated!', type: 'success' });
    setTimeout(() => setMessage(null), 2500);
  }

  async function handleClearLogs() {
    await clearSyncLogs();
    setLogs([]);
  }

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center h-[480px] bg-slate-900 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[520px] bg-slate-950 text-slate-100 text-sm">
      {/* Top Header */}
      <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-500 to-blue-600 flex items-center justify-center font-bold text-white text-xs shadow-md">
            CP
          </div>
          <div>
            <h1 className="font-semibold text-sm leading-none text-slate-100">CPBase</h1>
            <span className="text-[10px] text-slate-400">Codeforces & TLX Sync</span>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700">
          <button
            onClick={() => setTab('settings')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              tab === 'settings' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-3 h-3" />
            Settings
          </button>
          <button
            onClick={() => setTab('history')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              tab === 'history' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <List className="w-3 h-3" />
            Activity
          </button>
        </div>
      </div>

      {/* Alert / Feedback message */}
      {message && (
        <div
          className={`px-3 py-2 text-xs flex items-center gap-2 border-b ${
            message.type === 'success'
              ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/70 border-rose-800 text-rose-300'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="truncate">{message.text}</span>
        </div>
      )}

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === 'settings' ? (
          <>
            {/* 1. GitHub Connection */}
            <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-800/80 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-blue-400" />
                  GitHub Personal Access Token
                </label>
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo&description=CPBase%20Extension"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1"
                >
                  Create token <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showToken ? 'text' : 'password'}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-200"
                  >
                    {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <button
                  onClick={handleVerifyToken}
                  disabled={verifying}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1"
                >
                  {verifying ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Connect'}
                </button>
              </div>

              {/* User Avatar preview */}
              {user && (
                <div className="flex items-center gap-2 pt-1">
                  <img src={user.avatar_url} alt={user.login} className="w-6 h-6 rounded-full border border-slate-700" />
                  <span className="text-xs text-slate-300 font-medium truncate">@{user.login}</span>
                  <span className="text-[10px] bg-emerald-950 border border-emerald-800 text-emerald-400 px-1.5 py-0.5 rounded-md ml-auto">
                    Verified
                  </span>
                </div>
              )}
            </div>

            {/* 2. Target Repository */}
            {user && (
              <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-800/80 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <FolderGit2 className="w-3.5 h-3.5 text-emerald-400" />
                    Target Repository
                  </label>
                  <button
                    onClick={() => setCreateNewRepo(!createNewRepo)}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                  >
                    <PlusCircle className="w-3 h-3" />
                    {createNewRepo ? 'Select existing' : 'New repo'}
                  </button>
                </div>

                {createNewRepo ? (
                  <div className="space-y-2 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                    <input
                      type="text"
                      placeholder="Repository name"
                      value={newRepoName}
                      onChange={(e) => setNewRepoName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100"
                    />
                    <div className="flex items-center justify-between pt-1">
                      <label className="text-[11px] text-slate-400 flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newRepoPrivate}
                          onChange={(e) => setNewRepoPrivate(e.target.checked)}
                          className="rounded border-slate-700 bg-slate-900 text-emerald-500"
                        />
                        Private Repository
                      </label>
                      <button
                        onClick={handleCreateRepo}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium px-2.5 py-1 rounded"
                      >
                        Create on GitHub
                      </button>
                    </div>
                  </div>
                ) : (
                  <select
                    value={config.githubRepo}
                    onChange={(e) => handleSaveConfig({ githubRepo: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="" disabled>
                      Select a repository
                    </option>
                    {repos.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.name} {r.private ? '(Private)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* 3. Platform Settings */}
            <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-800/80 space-y-3 shadow-sm">
              <h2 className="text-xs font-semibold text-slate-300">Platforms</h2>

              {/* Codeforces */}
              <div className="space-y-1.5 pb-2 border-b border-slate-800/60">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-200">Codeforces</span>
                  <input
                    type="checkbox"
                    checked={config.enabledPlatforms.codeforces}
                    onChange={(e) =>
                      handleSaveConfig({
                        enabledPlatforms: { ...config.enabledPlatforms, codeforces: e.target.checked },
                      })
                    }
                    className="rounded border-slate-700 bg-slate-950 text-blue-500 w-4 h-4 cursor-pointer"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Codeforces Handle (e.g. tourist)"
                  value={config.codeforcesHandle || ''}
                  onChange={(e) => handleSaveConfig({ codeforcesHandle: e.target.value.trim() })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 placeholder-slate-500"
                />
              </div>

              {/* TLX Toki */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <span className="text-xs font-medium text-slate-200">TLX Toki</span>
                  <p className="text-[10px] text-slate-400">tlx.toki.id training & contests</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.enabledPlatforms.tlx}
                  onChange={(e) =>
                    handleSaveConfig({
                      enabledPlatforms: { ...config.enabledPlatforms, tlx: e.target.checked },
                    })
                  }
                  className="rounded border-slate-700 bg-slate-950 text-emerald-500 w-4 h-4 cursor-pointer"
                />
              </div>
            </div>
          </>
        ) : (
          /* Activity / History Tab */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Recent Sync Activity</span>
              {logs.length > 0 && (
                <button
                  onClick={handleClearLogs}
                  className="text-[11px] text-slate-400 hover:text-slate-200 hover:underline"
                >
                  Clear history
                </button>
              )}
            </div>

            {logs.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No synced problems yet. Solve a problem on Codeforces or TLX to see it here!
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between text-xs hover:border-slate-700 transition-colors"
                  >
                    <div className="space-y-0.5 truncate pr-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                            log.platform === 'codeforces'
                              ? 'bg-blue-950 text-blue-400 border border-blue-800'
                              : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          }`}
                        >
                          {log.platform}
                        </span>
                        <a
                          href={log.problemUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-slate-200 hover:underline truncate"
                        >
                          {log.problemId} - {log.problemTitle}
                        </a>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {log.status === 'success' && (
                        <>
                          <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-900">
                            AC
                          </span>
                          {log.commitUrl && (
                            <a
                              href={log.commitUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-400 hover:text-slate-100"
                              title="View Commit on GitHub"
                            >
                              <Github className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </>
                      )}
                      {log.status === 'error' && (
                        <span className="text-[10px] text-rose-400 bg-rose-950/80 px-1.5 py-0.5 rounded border border-rose-900" title={log.error}>
                          Failed
                        </span>
                      )}
                      {log.status === 'syncing' && (
                        <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-900/50 flex items-center justify-between text-[11px] text-slate-500">
        <span>CPBase v1.0.0</span>
        <span>Chrome & Firefox Ready</span>
      </div>
    </div>
  );
}
