import { browser } from 'wxt/browser';
import { htmlToMarkdown } from '@/lib/html-to-markdown';
import { extractCodeforcesStatement } from '@/lib/problem-parser';
import { detectFileExtension } from '@/lib/languages';
import type { ProblemDetails, SubmissionData } from '@/lib/types';

export default defineContentScript({
  matches: [
    '*://codeforces.com/contest/*/problem/*',
    '*://codeforces.com/problemset/problem/*/*',
    '*://codeforces.com/gym/*/problem/*',
    '*://codeforces.com/group/*/contest/*/problem/*',
    '*://codeforces.com/contest/*/my*',
    '*://codeforces.com/contest/*/status*',
    '*://codeforces.com/contest/*/submission/*',
    '*://codeforces.com/problemset/status*',
    '*://codeforces.com/problemset/submission/*/*',
    '*://codeforces.com/gym/*/my*',
    '*://codeforces.com/gym/*/status*',
    '*://codeforces.com/gym/*/submission/*',
    '*://codeforces.com/group/*/contest/*/my*',
    '*://codeforces.com/group/*/contest/*/status*',
    '*://codeforces.com/group/*/contest/*/submission/*',
  ],
  runAt: 'document_idle',
  main() {
    console.log('[CPBase] Codeforces content script activated.');
    initCodeforcesSyncButton();
    checkSingleSubmissionPage();
    observeSubmissionStatus();
  },
});

let isAutoSyncing = false;
const processedSubmissionIds = new Set<string>();

function getContestAndIndex(): { contestId: string; index: string } | null {
  const path = window.location.pathname;
  let m = path.match(/\/contest\/(\d+)\/problem\/([A-Za-z0-9]+)/i);
  if (m) return { contestId: m[1], index: m[2].toUpperCase() };

  m = path.match(/\/problemset\/problem\/(\d+)\/([A-Za-z0-9]+)/i);
  if (m) return { contestId: m[1], index: m[2].toUpperCase() };

  m = path.match(/\/gym\/(\d+)\/problem\/([A-Za-z0-9]+)/i);
  if (m) return { contestId: `Gym-${m[1]}`, index: m[2].toUpperCase() };

  return null;
}

function parseProblemFromUrl(url: string): { contestId: string; index: string } | null {
  let m = url.match(/\/contest\/(\d+)\/problem\/([A-Za-z0-9]+)/i);
  if (m) return { contestId: m[1], index: m[2].toUpperCase() };

  m = url.match(/\/problemset\/problem\/(\d+)\/([A-Za-z0-9]+)/i);
  if (m) return { contestId: m[1], index: m[2].toUpperCase() };

  m = url.match(/\/gym\/(\d+)\/problem\/([A-Za-z0-9]+)/i);
  if (m) return { contestId: `Gym-${m[1]}`, index: m[2].toUpperCase() };

  return null;
}

function extractProblemDetails(): ProblemDetails | null {
  const ci = getContestAndIndex();
  if (!ci) return null;

  const header = document.querySelector('.problem-statement .header');
  const rawTitle = header?.querySelector('.title')?.textContent || '';
  const problemTitle = rawTitle.replace(/^[A-Z0-9]+\.\s*/i, '').trim() || `Problem ${ci.index}`;

  const timeLimit = header?.querySelector('.time-limit')?.textContent?.replace(/time limit per test/i, '').trim();
  const memoryLimit = header?.querySelector('.memory-limit')?.textContent?.replace(/memory limit per test/i, '').trim();

  const tags: string[] = [];
  let rating: string | undefined;

  document.querySelectorAll('.tag-box').forEach((el) => {
    const text = el.textContent?.trim() || '';
    if (text.startsWith('*')) {
      rating = text.replace('*', '');
    } else if (text) {
      tags.push(text);
    }
  });

  const statementEl = document.querySelector('.problem-statement');
  const statementMarkdown = statementEl ? extractCodeforcesStatement(statementEl) : '';

  return {
    platform: 'codeforces',
    problemId: `${ci.contestId}${ci.index}`,
    problemTitle,
    problemUrl: window.location.href,
    contestId: ci.contestId,
    tags,
    rating,
    timeLimit,
    memoryLimit,
    statementMarkdown,
  };
}

/**
 * Injects a modern "Sync to GitHub" button into problem header (manual trigger)
 */
function initCodeforcesSyncButton() {
  const header = document.querySelector('.problem-statement .header');
  if (!header || document.getElementById('cpbase-cf-sync-btn')) return;

  const container = document.createElement('div');
  container.id = 'cpbase-cf-sync-container';
  container.style.cssText = 'margin-top: 12px; display: flex; gap: 8px; align-items: center; justify-content: center;';

  const button = document.createElement('button');
  button.id = 'cpbase-cf-sync-btn';
  button.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="17 8 12 3 7 8"></polyline>
      <line x1="12" y1="3" x2="12" y2="15"></line>
    </svg>
    Sync to GitHub
  `;
  button.style.cssText = `
    display: inline-flex;
    align-items: center;
    background-color: #10b981;
    color: white;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 13px;
    font-weight: 600;
    padding: 6px 14px;
    border-radius: 6px;
    border: 1px solid #059669;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2);
    transition: all 0.15s ease;
  `;

  button.onmouseover = () => (button.style.backgroundColor = '#059669');
  button.onmouseout = () => (button.style.backgroundColor = '#10b981');

  const statusSpan = document.createElement('span');
  statusSpan.id = 'cpbase-cf-sync-status';
  statusSpan.style.cssText = 'font-size: 12px; color: #64748b; font-family: system-ui, -apple-system, sans-serif;';

  container.appendChild(button);
  container.appendChild(statusSpan);
  header.appendChild(container);

  button.addEventListener('click', async () => {
    button.disabled = true;
    statusSpan.textContent = 'Fetching latest AC submission...';
    statusSpan.style.color = '#3b82f6';

    try {
      await fetchAndSyncLatestAC(statusSpan);
    } catch (err: any) {
      statusSpan.textContent = `Sync failed: ${err.message}`;
      statusSpan.style.color = '#ef4444';
    } finally {
      button.disabled = false;
    }
  });
}

/**
 * Helper to decode HTML entities in source code
 */
function decodeEntities(str: string): string {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

/**
 * Extract source code from HTML strings or markup blocks
 */
function extractSourceFromHtml(html: string): string | null {
  if (!html || typeof html !== 'string') return null;

  const patterns = [
    /<pre[^>]*id=["']program-source-text["'][^>]*>([\s\S]*?)<\/pre>/i,
    /id=["']program-source-text["'][^>]*>([\s\S]*?)<\/pre>/i,
    /<pre[^>]*class=["'][^"']*prettyprint[^"']*["'][^>]*>([\s\S]*?)<\/pre>/i,
    /<pre[^>]*class=["'][^"']*program-source[^"']*["'][^>]*>([\s\S]*?)<\/pre>/i,
    /<textarea[^>]*id=["']program-source-text["'][^>]*>([\s\S]*?)<\/textarea>/i,
    /<textarea[^>]*class=["'][^"']*prettyprint[^"']*["'][^>]*>([\s\S]*?)<\/textarea>/i,
    /<textarea[^>]*class=["'][^"']*program-source[^"']*["'][^>]*>([\s\S]*?)<\/textarea>/i,
    /<code[^>]*class=["'][^"']*prettyprint[^"']*["'][^>]*>([\s\S]*?)<\/code>/i,
  ];

  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) {
      const text = m[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(?:li|div|p)>/gi, '\n')
        .replace(/<[^>]+>/g, '');
      const decoded = decodeEntities(text).trim();
      if (decoded.length > 0 && !/access denied|forbidden|please wait|just a moment/i.test(decoded)) {
        return decoded;
      }
    }
  }

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const el = doc.querySelector(
      '#program-source-text, .program-source, pre.prettyprint, textarea.program-source-text, .source-popup pre, #facebox pre',
    );
    if (el?.textContent?.trim()) {
      return el.textContent.trim();
    }
  } catch {}

  return null;
}

/**
 * Check if the source code is already visible anywhere in the active document
 */
function findSourceCodeInActiveDocument(): string | null {
  const selectors = [
    '#program-source-text',
    'pre.program-source',
    'pre.prettyprint',
    'textarea.program-source-text',
    'textarea#program-source-text',
    '.source-popup pre',
    '#facebox pre',
    '#facebox code',
    '.popup pre',
    'pre[name="source"]',
    'div.source-copier + pre',
  ];

  for (const sel of selectors) {
    const elements = document.querySelectorAll(sel);
    for (const el of Array.from(elements)) {
      const text = (el instanceof HTMLTextAreaElement ? el.value : el.textContent)?.trim();
      if (text && text.length > 5 && !/access denied|forbidden|please wait/i.test(text)) {
        return text;
      }
    }
  }

  return null;
}

/**
 * Extract CSRF token from Codeforces page
 */
function getCodeforcesCsrfToken(): string | null {
  const meta = document.querySelector('meta[name="X-Csrf-Token"]');
  const metaCsrf = meta?.getAttribute('content');
  if (metaCsrf) return metaCsrf;

  const input = document.querySelector('input[name="csrf_token"]');
  const inputCsrf = input?.getAttribute('value');
  if (inputCsrf) return inputCsrf;

  const el = document.querySelector('[data-csrf]');
  const dataCsrf = el?.getAttribute('data-csrf');
  if (dataCsrf) return dataCsrf;

  const html = document.documentElement.innerHTML;
  const match =
    html.match(/Codeforces\.csrf\s*=\s*['"]([a-f0-9]{20,64})['"]/i) ||
    html.match(/["']csrf_token["']\s*:\s*["']([a-f0-9]{20,64})["']/i) ||
    html.match(/(?:csrf_token|csrf)\s*[:=]\s*['"]([a-f0-9]{20,64})['"]/i);
  if (match?.[1]) return match[1];

  const link = document.querySelector('a[href*="csrf_token="]') as HTMLAnchorElement;
  if (link?.href) {
    const linkMatch = link.href.match(/csrf_token=([a-f0-9]{20,64})/i);
    if (linkMatch?.[1]) return linkMatch[1];
  }

  const cookieMatch = document.cookie.match(/(?:csrf_token|csrf)=([a-f0-9]{20,64})/i);
  if (cookieMatch?.[1]) return cookieMatch[1];

  return null;
}

/**
 * Fetch source code using Codeforces internal /data/submitSource endpoint
 */
async function fetchSourceViaInternalApi(submissionId: number | string): Promise<string | null> {
  const csrf = getCodeforcesCsrfToken();
  if (!csrf) {
    console.warn('[CPBase] CSRF token not found on Codeforces page.');
    return null;
  }

  try {
    const res = await fetch('/data/submitSource', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Csrf-Token': csrf,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: new URLSearchParams({
        submissionId: String(submissionId),
        csrf_token: csrf,
      }),
    });

    if (!res.ok) return null;

    const text = await res.text();

    if (text.trim().startsWith('{')) {
      try {
        const json = JSON.parse(text);
        if (json.source && typeof json.source === 'string' && json.source.trim()) {
          return json.source.trim();
        }
      } catch {}
    }

    const extracted = extractSourceFromHtml(text);
    if (extracted) return extracted;

    const plain = decodeEntities(text.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).trim();
    if (plain && plain.length > 10 && !/forbidden|access denied|please wait|error/i.test(plain)) {
      return plain;
    }
  } catch (err) {
    console.warn('[CPBase] /data/submitSource failed:', err);
  }

  return null;
}

/**
 * Attempt to click the submission link on the page to trigger Codeforces native modal
 */
async function fetchSourceViaTriggeringModal(submissionId: number | string): Promise<string | null> {
  const link = document.querySelector(
    `a.view-source[submissionid="${submissionId}"], a[href*="/submission/${submissionId}"]`,
  ) as HTMLElement;

  if (!link) return null;

  link.click();

  for (let i = 0; i < 15; i++) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const code = findSourceCodeInActiveDocument();
    if (code) {
      const closeBtn = document.querySelector('#facebox .close, .source-popup .close, .close-button') as HTMLElement;
      closeBtn?.click();
      return code;
    }
  }

  return null;
}

/**
 * Fallback direct GET fetch
 */
async function fetchSourceViaDirectUrl(
  contestId: number | string,
  submissionId: number | string,
): Promise<string | null> {
  const isGym = String(contestId).startsWith('Gym-') || window.location.pathname.includes('/gym/');
  const cleanId = String(contestId).replace(/^Gym-/i, '');
  const candidateUrls = [
    isGym
      ? `https://codeforces.com/gym/${cleanId}/submission/${submissionId}`
      : `https://codeforces.com/contest/${cleanId}/submission/${submissionId}`,
    `https://codeforces.com/problemset/submission/${cleanId}/${submissionId}`,
  ];

  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) continue;
      const html = await res.text();
      const code = extractSourceFromHtml(html);
      if (code) return code;
    } catch {}
  }

  return null;
}

/**
 * Check if the "Last submissions" sidebar widget or status table has an accepted submission
 */
function getLatestAcceptedFromSidebar(): { submissionId: string; language?: string } | null {
  const tables = document.querySelectorAll('table.rtable, .status-frame-datatable');
  for (const table of Array.from(tables)) {
    const rows = table.querySelectorAll('tr');
    for (const row of Array.from(rows)) {
      const verdictEl = row.querySelector('.verdict-accepted');
      const textContent = row.textContent || '';
      const isAccepted = verdictEl || /\bAccepted\b/i.test(textContent);
      if (isAccepted) {
        const link = row.querySelector('a.view-source, a[href*="/submission/"]') as HTMLAnchorElement;
        const subId =
          link?.getAttribute('submissionid') ||
          link?.href?.match(/\/submission\/(\d+)/)?.[1] ||
          link?.textContent?.trim();
        if (subId && /^\d+$/.test(subId)) {
          const cells = row.querySelectorAll('td');
          const language = cells[3]?.textContent?.trim();
          return { submissionId: subId, language };
        }
      }
    }
  }
  return null;
}

async function fetchSubmissionSourceCode(
  contestId: number | string,
  submissionId: number | string,
): Promise<string> {
  // 1. Check if source code is already visible/mounted in current document
  const existingCode = findSourceCodeInActiveDocument();
  if (existingCode) {
    return existingCode;
  }

  // 2. Query Codeforces internal AJAX endpoint /data/submitSource
  const internalApiCode = await fetchSourceViaInternalApi(submissionId);
  if (internalApiCode) {
    return internalApiCode;
  }

  // 3. Programmatically trigger the submission popup link in DOM
  const modalCode = await fetchSourceViaTriggeringModal(submissionId);
  if (modalCode) {
    return modalCode;
  }

  // 4. Fallback GET requests to submission URLs with credentials
  const directUrlCode = await fetchSourceViaDirectUrl(contestId, submissionId);
  if (directUrlCode) {
    return directUrlCode;
  }

  throw new Error('Could not locate source code on Codeforces. Please open your submission to view code.');
}

async function fetchAndSyncLatestAC(statusSpan?: HTMLElement) {
  const config = await browser.runtime.sendMessage({ type: 'GET_CONFIG' });
  const handle = config?.codeforcesHandle;

  const ci = getContestAndIndex();
  if (!ci) throw new Error('Could not parse contest & problem index.');

  // 1. Check if the "Last submissions" widget on current page shows an Accepted submission
  const sidebarAc = getLatestAcceptedFromSidebar();
  let submissionId = sidebarAc?.submissionId;
  let programmingLanguage = sidebarAc?.language;
  let execTime: string | undefined;
  let memoryUsed: string | undefined;
  let submittedAt = Date.now();

  // 2. Query official Codeforces API if handle is available to enrich metadata
  if (handle) {
    try {
      const apiUrl = `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=20`;
      const res = await fetch(apiUrl);
      const data = await res.json();

      if (data.status === 'OK' && Array.isArray(data.result)) {
        const acSubmission = data.result.find((s: any) => {
          const isAccepted = s.verdict === 'OK';
          const contestMatch = String(s.contestId) === String(ci.contestId);
          const indexMatch = String(s.problem?.index).toUpperCase() === ci.index;
          return isAccepted && contestMatch && indexMatch;
        });

        if (acSubmission) {
          submissionId = String(acSubmission.id);
          programmingLanguage = acSubmission.programmingLanguage || programmingLanguage;
          execTime = `${acSubmission.timeConsumedMillis} ms`;
          memoryUsed = `${Math.round(acSubmission.memoryConsumedBytes / 1024)} KB`;
          submittedAt = acSubmission.creationTimeSeconds * 1000;
        }
      }
    } catch (apiErr) {
      console.warn('[CPBase] Codeforces API status check skipped:', apiErr);
    }
  }

  if (!submissionId) {
    if (!handle) {
      throw new Error('No accepted submission found in sidebar, and Codeforces handle is not configured in settings.');
    }
    throw new Error(`No Accepted submission found for problem ${ci.contestId}${ci.index} under handle ${handle}.`);
  }

  if (statusSpan) {
    statusSpan.textContent = `Found submission #${submissionId}! Locating source code...`;
    statusSpan.style.color = '#3b82f6';
  }

  // Detect language fallback from page's submit selector if still unknown
  if (!programmingLanguage) {
    const langSelect = document.querySelector('select[name="programTypeId"]') as HTMLSelectElement;
    if (langSelect && langSelect.selectedIndex >= 0) {
      programmingLanguage = langSelect.options[langSelect.selectedIndex]?.text?.trim();
    }
    programmingLanguage = programmingLanguage || 'GNU C++';
  }

  const code = await fetchSubmissionSourceCode(ci.contestId, submissionId);
  const problemDetails = extractProblemDetails();
  if (!problemDetails) throw new Error('Could not extract problem statement details.');

  const ext = detectFileExtension(programmingLanguage);

  const submissionData: SubmissionData = {
    platform: 'codeforces',
    submissionId,
    problem: problemDetails,
    language: programmingLanguage,
    extension: ext,
    sourceCode: code,
    verdict: 'Accepted',
    executionTime: execTime,
    memoryUsed: memoryUsed,
    submittedAt,
  };

  if (statusSpan) {
    statusSpan.textContent = 'Committing to GitHub...';
    statusSpan.style.color = '#3b82f6';
  }

  const syncResult = await browser.runtime.sendMessage({
    type: 'SYNC_SUBMISSION',
    payload: submissionData,
  });

  if (syncResult.ok) {
    if (statusSpan) {
      statusSpan.textContent = 'Successfully synced to GitHub!';
      statusSpan.style.color = '#10b981';
    }
  } else {
    throw new Error(syncResult.error || 'Commit failed.');
  }
}

/**
 * Automatic sync for a specific Codeforces submission ID
 */
async function autoSyncCodeforcesSubmission(
  submissionId: string,
  contestId: string,
  index: string,
  problemTitle?: string,
  language?: string,
) {
  if (isAutoSyncing || processedSubmissionIds.has(submissionId)) return;

  // Check config
  const config = await browser.runtime.sendMessage({ type: 'GET_CONFIG' });
  if (config?.autoSync === false || config?.enabledPlatforms?.codeforces === false) {
    return;
  }

  // Check if already synced in storage
  const syncCheck = await browser.runtime.sendMessage({
    type: 'IS_SUBMISSION_SYNCED',
    payload: { platform: 'codeforces', submissionId },
  });

  if (syncCheck?.synced) {
    processedSubmissionIds.add(submissionId);
    return;
  }

  isAutoSyncing = true;
  processedSubmissionIds.add(submissionId);

  const problemKey = `${contestId}${index}`;
  showFloatingToast(`[CPBase] Detected AC submission #${submissionId} for ${problemKey}. Auto-syncing to GitHub...`, 'info');

  try {
    const code = await fetchSubmissionSourceCode(contestId, submissionId);
    let problemDetails = extractProblemDetails();

    if (!problemDetails) {
      // Build problem details if on submission/status page
      const problemUrl = `https://codeforces.com/contest/${contestId}/problem/${index}`;
      problemDetails = {
        platform: 'codeforces',
        problemId: problemKey,
        problemTitle: problemTitle || `Problem ${index}`,
        problemUrl,
        contestId,
        tags: ['Codeforces'],
        statementMarkdown: '',
      };
    }

    const lang = language || 'C++';
    const ext = detectFileExtension(lang);

    const submissionData: SubmissionData = {
      platform: 'codeforces',
      submissionId,
      problem: problemDetails,
      language: lang,
      extension: ext,
      sourceCode: code,
      verdict: 'Accepted',
      submittedAt: Date.now(),
    };

    const res = await browser.runtime.sendMessage({
      type: 'SYNC_SUBMISSION',
      payload: submissionData,
    });

    if (res.ok) {
      showFloatingToast(`[CPBase] Auto-synced ${problemKey} (${problemDetails.problemTitle}) to GitHub!`, 'success');
    } else {
      throw new Error(res.error || 'Commit failed');
    }
  } catch (err: any) {
    console.error('[CPBase] Codeforces auto-sync error:', err);
    showFloatingToast(`[CPBase] Auto-sync failed: ${err.message}`, 'error');
  } finally {
    isAutoSyncing = false;
  }
}

/**
 * If the user directly opened or reloaded a single submission page: /contest/1900/submission/25000000
 */
async function checkSingleSubmissionPage() {
  const m = window.location.pathname.match(/\/submission\/(\d+)/i);
  if (!m) return;

  const submissionId = m[1];
  if (processedSubmissionIds.has(submissionId)) return;

  // Check if verdict is Accepted
  const verdictEl = document.querySelector('.verdict-accepted');
  if (!verdictEl && !/Accepted/i.test(document.body.innerText)) return;

  // Extract contest and problem link from the submission datatable
  const problemLink = document.querySelector('table.rtable a[href*="/problem/"], .status-frame-datatable a[href*="/problem/"]') as HTMLAnchorElement;
  if (!problemLink) return;

  const parsed = parseProblemFromUrl(problemLink.getAttribute('href') || '');
  if (!parsed) return;

  const title = problemLink.textContent?.trim();
  const langCell = document.querySelector('table.rtable td:nth-child(4), .status-frame-datatable td:nth-child(4)');
  const language = langCell?.textContent?.trim() || 'C++';

  await autoSyncCodeforcesSubmission(submissionId, parsed.contestId, parsed.index, title, language);
}

/**
 * Watch for live verdict updates in Codeforces datatables
 */
function observeSubmissionStatus() {
  function scanDatatable() {
    const rows = document.querySelectorAll('.status-frame-datatable tr[data-submission-id]');
    rows.forEach((row) => {
      const submissionId = row.getAttribute('data-submission-id');
      if (!submissionId || processedSubmissionIds.has(submissionId)) return;

      const verdictEl = row.querySelector('.verdict-accepted');
      if (!verdictEl) return;

      // Extract problem info from row
      const problemLink = row.querySelector('a[href*="/problem/"]') as HTMLAnchorElement;
      if (!problemLink) return;

      const parsed = parseProblemFromUrl(problemLink.getAttribute('href') || '');
      if (!parsed) return;

      const title = problemLink.textContent?.trim();
      const langEl = row.querySelector('td:nth-child(4)');
      const language = langEl?.textContent?.trim() || 'C++';

      autoSyncCodeforcesSubmission(submissionId, parsed.contestId, parsed.index, title, language);
    });
  }

  // Scan immediately
  scanDatatable();

  // Also observe for DOM mutations
  const statusTable = document.querySelector('.status-frame-datatable') || document.body;
  const observer = new MutationObserver(() => {
    scanDatatable();
  });

  observer.observe(statusTable, { childList: true, subtree: true });
}

/**
 * Floating toast notification widget with light theme styling
 */
function showFloatingToast(message: string, type: 'info' | 'success' | 'error') {
  let toastContainer = document.getElementById('cpbase-toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'cpbase-toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 24px;
      z-index: 9999999;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
    `;
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  const borderColor = type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6';
  const bgColor = '#ffffff';
  const textColor = '#0f172a';

  toast.style.cssText = `
    pointer-events: auto;
    background-color: ${bgColor};
    color: ${textColor};
    border: 1px solid #e2e8f0;
    border-left: 4px solid ${borderColor};
    border-radius: 8px;
    padding: 10px 14px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 12px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 240px;
    max-width: 380px;
  `;

  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
