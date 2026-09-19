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
  Globe,
  Zap,
} from 'lucide-react';
import { getConfig, setConfig, getSyncLogs, clearSyncLogs } from '@/lib/storage';
import { verifyGitHubToken, listUserRepos, createRepo } from '@/lib/github';
import type { CPBaseConfig, GitHubRepo, GitHubUser, SyncLog } from '@/lib/types';

function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${
        checked ? 'bg-emerald-600' : 'bg-slate-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

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
      <div className="flex flex-col items-center justify-center h-[520px] bg-slate-50 text-slate-400 gap-2 font-sans">
        <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
        <span className="text-xs font-medium text-slate-500">Loading CPBase...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[520px] bg-slate-50 text-slate-900 text-sm font-sans select-none antialiased">
      {/* Top Header */}
      <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img
            src="/icon/32.png"
            alt="CPBase Logo"
            className="w-7 h-7 rounded-lg border border-slate-200 object-contain p-0.5 bg-white shadow-xs"
          />
          <div>
            <h1 className="font-bold text-sm leading-none text-slate-900 tracking-tight">CPBase</h1>
            <span className="text-[10px] text-slate-500 font-medium">Codeforces & TLX Sync</span>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          <button
            onClick={() => setTab('settings')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
              tab === 'settings'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            Settings
          </button>
          <button
            onClick={() => setTab('history')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 cursor-pointer ${
              tab === 'history'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            Activity
          </button>
        </div>
      </div>

      {/* Alert / Feedback message */}
      {message && (
        <div
          className={`px-3.5 py-2 text-xs flex items-center gap-2 border-b font-medium transition-all ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span className="truncate">{message.text}</span>
        </div>
      )}

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {tab === 'settings' ? (
          <>
            {/* 1. GitHub Connection Card */}
            <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-slate-600" />
                  GitHub Access Token
                </label>
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo&description=CPBase%20Extension"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold hover:underline flex items-center gap-1"
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
                    className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono placeholder:text-slate-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-emerald-500/15 transition-all pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <button
                  onClick={handleVerifyToken}
                  disabled={verifying}
                  className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  {verifying ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Connect'}
                </button>
              </div>

              {/* User Avatar preview */}
              {user && (
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <img
                    src={user.avatar_url}
                    alt={user.login}
                    className="w-6 h-6 rounded-full border border-slate-200"
                  />
                  <span className="text-xs text-slate-800 font-semibold font-mono truncate">
                    @{user.login}
                  </span>
                  <span className="text-[10px] font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700 px-2 py-0.5 rounded-md ml-auto flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Verified
                  </span>
                </div>
              )}
            </div>

            {/* 2. Target Repository Card */}
            {user && (
              <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <FolderGit2 className="w-3.5 h-3.5 text-slate-600" />
                    Target Repository
                  </label>
                  <button
                    onClick={() => setCreateNewRepo(!createNewRepo)}
                    className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <PlusCircle className="w-3 h-3" />
                    {createNewRepo ? 'Select existing' : 'New repo'}
                  </button>
                </div>

                {createNewRepo ? (
                  <div className="space-y-2.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <input
                      type="text"
                      placeholder="Repository name"
                      value={newRepoName}
                      onChange={(e) => setNewRepoName(e.target.value)}
                      className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono placeholder:text-slate-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-emerald-500/15"
                    />
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <ToggleSwitch
                          checked={newRepoPrivate}
                          onChange={(checked) => setNewRepoPrivate(checked)}
                          ariaLabel="Private repository toggle"
                        />
                        <span className="text-xs font-medium text-slate-700">Private repo</span>
                      </div>
                      <button
                        onClick={handleCreateRepo}
                        className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors shadow-xs cursor-pointer"
                      >
                        Create on GitHub
                      </button>
                    </div>
                  </div>
                ) : (
                  <select
                    value={config.githubRepo}
                    onChange={(e) => handleSaveConfig({ githubRepo: e.target.value })}
                    className="w-full bg-white border border-slate-200 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/15 cursor-pointer"
                  >
                    <option value="" disabled className="font-sans">
                      Select a repository
                    </option>
                    {repos.map((r) => (
                      <option key={r.id} value={r.name} className="font-mono">
                        {r.name} {r.private ? '(Private)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* 3. Platform Settings Card */}
            <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" />
                  Platforms
                </span>
                <span className="text-[11px] text-slate-400">Auto-sync targets</span>
              </div>

              {/* Codeforces */}
              <div className="space-y-2 pb-2.5 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-mono bg-blue-50 text-blue-700 border border-blue-200">
                      CF
                    </span>
                    <span className="text-xs font-semibold text-slate-800">Codeforces</span>
                  </div>
                  <ToggleSwitch
                    checked={config.enabledPlatforms.codeforces}
                    onChange={(checked) =>
                      handleSaveConfig({
                        enabledPlatforms: { ...config.enabledPlatforms, codeforces: checked },
                      })
                    }
                    ariaLabel="Toggle Codeforces sync"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Codeforces Handle (e.g. tourist)"
                  value={config.codeforcesHandle || ''}
                  onChange={(e) => handleSaveConfig({ codeforcesHandle: e.target.value.trim() })}
                  className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono placeholder:text-slate-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-emerald-500/15 transition-all"
                />
              </div>

              {/* TLX Toki */}
              <div className="flex items-center justify-between pt-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                    TLX
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-slate-800 leading-none">TLX Toki</span>
                    <p className="text-[10px] text-slate-400 mt-0.5 font-normal">tlx.toki.id training & contests</p>
                  </div>
                </div>
                <ToggleSwitch
                  checked={config.enabledPlatforms.tlx}
                  onChange={(checked) =>
                    handleSaveConfig({
                      enabledPlatforms: { ...config.enabledPlatforms, tlx: checked },
                    })
                  }
                  ariaLabel="Toggle TLX Toki sync"
                />
              </div>
            </div>

            {/* 4. Automation Card */}
            <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-emerald-600" />
                    Auto-sync on Accepted (AC)
                  </span>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-normal">
                    Sync to GitHub automatically without clicking any button
                  </p>
                </div>
                <ToggleSwitch
                  checked={config.autoSync !== false}
                  onChange={(checked) => handleSaveConfig({ autoSync: checked })}
                  ariaLabel="Toggle auto-sync on Accepted"
                />
              </div>
            </div>
          </>
        ) : (
          /* Activity / History Tab */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">Recent Sync Activity</span>
              {logs.length > 0 && (
                <button
                  onClick={handleClearLogs}
                  className="text-[11px] text-slate-400 hover:text-rose-600 hover:underline transition-colors cursor-pointer"
                >
                  Clear history
                </button>
              )}
            </div>

            {logs.length === 0 ? (
              <div className="text-center py-12 px-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2.5">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-700">No sync activity yet</p>
                  <p className="text-[11px] text-slate-400 max-w-[240px] mx-auto leading-relaxed">
                    Solve a problem on Codeforces or TLX to see your automated GitHub commits here!
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="bg-white border border-slate-200 hover:border-slate-300 rounded-lg p-2.5 flex items-center justify-between text-xs shadow-xs transition-colors"
                  >
                    <div className="space-y-1 truncate pr-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-mono ${
                            log.platform === 'codeforces'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {log.platform === 'codeforces' ? 'CF' : 'TLX'}
                        </span>
                        <span className="font-mono text-[11px] font-semibold text-slate-700 bg-slate-100 px-1 py-0.2 rounded border border-slate-200/60">
                          {log.problemId}
                        </span>
                        <a
                          href={log.problemUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-slate-800 hover:text-emerald-700 hover:underline truncate"
                          title={log.problemTitle}
                        >
                          {log.problemTitle}
                        </a>
                      </div>
                      <div className="text-[10px] text-slate-400 font-medium">
                        {new Date(log.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        &bull;{' '}
                        {new Date(log.timestamp).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {log.status === 'success' && (
                        <>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-mono">
                            AC
                          </span>
                          {log.commitUrl && (
                            <a
                              href={log.commitUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 rounded text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                              title="View Commit on GitHub"
                            >
                              <Github className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </>
                      )}
                      {log.status === 'error' && (
                        <span
                          className="text-[10px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200"
                          title={log.error}
                        >
                          Failed
                        </span>
                      )}
                      {log.status === 'syncing' && (
                        <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
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
      <div className="px-4 py-2 border-t border-slate-200 bg-white flex items-center justify-between text-[11px] text-slate-500">
        <span className="font-medium">CPBase v1.0.0</span>
        <span className="flex items-center gap-1.5 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          Chrome &amp; Firefox Ready
        </span>
      </div>
    </div>
  );
}
