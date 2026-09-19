import { browser } from 'wxt/browser';
import { htmlToMarkdown } from '@/lib/html-to-markdown';
import { detectFileExtension } from '@/lib/languages';
import type { ProblemDetails, SubmissionData } from '@/lib/types';

export default defineContentScript({
  matches: [
    '*://tlx.toki.id/problems/*',
    '*://tlx.toki.id/contests/*',
    '*://tlx.toki.id/courses/*',
    '*://tlx.toki.id/submissions/*',
  ],
  runAt: 'document_idle',
  main() {
    console.log('[CPBase] TLX Toki content script loaded.');

    // Inject manual button if on problem page
    setInterval(checkAndInjectTLXSync, 2000);

    // Watch for live verdicts & auto-sync
    initTLXAutoSyncObserver();

    // Check immediately on load (in case user opened/refreshed a submission page)
    checkSingleSubmissionPageAutoSync();
  },
});

let isAutoSyncing = false;
const processedSubmissionIds = new Set<string>();

/**
 * Extracts session token from TLX Toki's localStorage
 */
function getTLXAuthToken(): string | null {
  try {
    const raw = localStorage.getItem('persist:session');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const token = JSON.parse(parsed.token);
    return typeof token === 'string' && token ? token : null;
  } catch {
    return null;
  }
}

/**
 * Proper Unicode Base64 decoder matching Judgels implementation
 */
function decodeBase64Unicode(base64: string): string {
  const binString = atob(base64);
  return new TextDecoder().decode(Uint8Array.from(binString, (m) => m.codePointAt(0) || 0));
}

/**
 * Fetches exact source code and metadata directly from Judgels / TLX API
 */
async function fetchTLXSubmissionViaAPI(submissionId: string) {
  const token = getTLXAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`https://api.tlx.toki.id/v2/submissions/programming/id/${submissionId}`, {
    headers,
  });

  if (!res.ok) {
    throw new Error(`TLX API returned HTTP ${res.status}`);
  }

  const data = await res.json();
  const sourceFiles = data?.source?.submissionFiles || {};
  const fileKey = Object.keys(sourceFiles)[0];
  if (!fileKey || !sourceFiles[fileKey]?.content) {
    throw new Error('No source file found in TLX API response.');
  }

  const file = sourceFiles[fileKey];
  const code = decodeBase64Unicode(file.content);
  const language = data?.submission?.gradingLanguage || 'C++';
  const filename = file.name || 'solution';
  const verdict = data?.submission?.latestGrading?.verdict?.name || data?.submission?.latestGrading?.verdict?.code || '';
  const score = data?.submission?.latestGrading?.score;
  const problemAlias = data?.submission?.problemAlias || '';
  const problemName = data?.submission?.problemName || '';
  const problemJid = data?.submission?.problemJid || '';

  return {
    code,
    language,
    filename,
    verdict,
    score,
    problemAlias,
    problemName,
    problemJid,
  };
}

/**
 * Extracts multi-line code from DOM (fallback if API is unavailable)
 * Properly handles react-syntax-highlighter line spans, removes line-number elements,
 * and preserves multi-line newlines.
 */
function extractMultiLineCodeFromDOM(): string {
  // 1. Check react-syntax-highlighter element in submission page
  const preEl = document.querySelector('pre.source-code, .submission-details pre, pre');
  if (preEl) {
    const codeEl = preEl.querySelector('code') || preEl;
    // Each line in react-syntax-highlighter with wrapLines=true is a child <span>
    const directSpans = codeEl.querySelectorAll(':scope > span');
    if (directSpans.length > 1) {
      const lines: string[] = [];
      directSpans.forEach((span) => {
        const clone = span.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('.react-syntax-highlighter-line-number, .linenumber').forEach((el) => el.remove());
        lines.push(clone.textContent || '');
      });
      const result = lines.join('\n').trim();
      if (result.length > 0) return result;
    }

    // If lines weren't child spans, use innerText on clone after removing line numbers
    const clone = preEl.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.react-syntax-highlighter-line-number, .linenumber').forEach((el) => el.remove());
    const inner = (clone as HTMLElement).innerText;
    if (inner && inner.includes('\n')) {
      return inner.trim();
    }
  }

  // 2. Check textarea
  const textarea = document.querySelector('textarea.code-editor, textarea[name="source"]') as HTMLTextAreaElement;
  if (textarea?.value) {
    return textarea.value.trim();
  }

  // 3. Check Monaco editor view lines if present
  const codeLines = document.querySelectorAll('.monaco-editor .view-line');
  if (codeLines.length > 1) {
    return Array.from(codeLines)
      .map((line) => line.textContent || '')
      .join('\n')
      .trim();
  }

  return '';
}

function getTLXProblemSlug(): { category: string; slug: string } | null {
  const path = window.location.pathname;

  // /contests/troc-30/problems/A
  let m = path.match(/\/contests\/([^/]+)\/problems\/([^/]+)/i);
  if (m) return { category: `Contest-${m[1]}`, slug: m[2] };

  // /courses/basic/chapters/01/problems/A
  m = path.match(/\/courses\/([^/]+)\/.*\/problems\/([^/]+)/i);
  if (m) return { category: `Course-${m[1]}`, slug: m[2] };

  // /problems/troc-30-a or /problems/slug
  m = path.match(/\/problems\/([^/]+)/i);
  if (m) return { category: 'Problemset', slug: m[1] };

  return null;
}

function extractTLXProblemDetails(fallbackAlias?: string, fallbackTitle?: string): ProblemDetails | null {
  const info = getTLXProblemSlug();
  const slug = info?.slug || fallbackAlias || 'problem';
  const category = info?.category || 'Problemset';

  // Find title in DOM
  const h1 = document.querySelector('h1, h2, .problem-title, .general-info h4');
  const problemTitle = fallbackTitle || h1?.textContent?.trim() || slug;

  let timeLimit = '';
  let memoryLimit = '';

  const textNodes = document.body.innerText || '';
  const timeMatch = textNodes.match(/(?:Batas Waktu|Time Limit)[:\s]+([0-9.]+\s*(?:s|ms|detik))/i);
  if (timeMatch) timeLimit = timeMatch[1];

  const memMatch = textNodes.match(/(?:Batas Memori|Memory Limit)[:\s]+([0-9.]+\s*(?:MB|KB|B))/i);
  if (memMatch) memoryLimit = memMatch[1];

  const contentEl =
    document.querySelector('.problem-description') ||
    document.querySelector('.description') ||
    document.querySelector('article') ||
    document.querySelector('[class*="ProblemStatement"]') ||
    document.querySelector('[class*="description"]');

  const statementMarkdown = contentEl ? htmlToMarkdown(contentEl.innerHTML) : '';

  return {
    platform: 'tlx',
    problemId: slug,
    problemTitle,
    problemUrl: (document.querySelector('.general-info > h4:nth-child(1) > a:nth-child(1)') as HTMLAnchorElement)?.href || window.location.href,
    contestId: category,
    tags: ['TLX Toki'],
    timeLimit,
    memoryLimit,
    statementMarkdown,
  };
}

/**
 * Injects CPBase floating sync button on TLX problem page (manual trigger)
 */
function checkAndInjectTLXSync() {
  // Only inject if on a problem page
  if (!getTLXProblemSlug()) return;
  if (document.getElementById('cpbase-tlx-sync-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'cpbase-tlx-sync-btn';
  btn.innerHTML = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="17 8 12 3 7 8"></polyline>
      <line x1="12" y1="3" x2="12" y2="15"></line>
    </svg>
    Sync to GitHub
  `;
  btn.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 999999;
    display: inline-flex;
    align-items: center;
    background-color: #059669;
    color: white;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 13px;
    font-weight: 600;
    padding: 10px 18px;
    border-radius: 9999px;
    border: 1px solid #047857;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);
    transition: all 0.2s ease;
  `;

  btn.onmouseover = () => {
    btn.style.backgroundColor = '#047857';
    btn.style.transform = 'translateY(-1px)';
  };
  btn.onmouseout = () => {
    btn.style.backgroundColor = '#059669';
    btn.style.transform = 'translateY(0)';
  };

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.innerText = 'Extracting code...';

    try {
      await manualSyncTLX(btn);
    } catch (err: any) {
      showFloatingToast(`Sync failed: ${err.message}`, 'error');
      btn.innerHTML = 'Sync failed (Click to retry)';
    } finally {
      btn.disabled = false;
    }
  });

  document.body.appendChild(btn);
}

async function manualSyncTLX(btn?: HTMLButtonElement) {
  // Check if single submission page or problem page
  const submissionId = getSubmissionIdFromUrl();
  let sourceCode = '';
  let language = 'C++';
  let problemDetails: ProblemDetails | null = null;

  if (submissionId) {
    try {
      const apiData = await fetchTLXSubmissionViaAPI(submissionId);
      sourceCode = apiData.code;
      language = apiData.language;
      problemDetails = extractTLXProblemDetails(apiData.problemAlias, apiData.problemName);
    } catch {
      // Fallback to DOM
      sourceCode = extractMultiLineCodeFromDOM();
      problemDetails = extractTLXProblemDetails();
    }
  } else {
    sourceCode = extractMultiLineCodeFromDOM();
    problemDetails = extractTLXProblemDetails();
  }

  if (!sourceCode) {
    throw new Error('Could not find source code on page. Open your submitted solution or editor tab.');
  }

  if (!problemDetails) {
    throw new Error('Problem details could not be extracted.');
  }

  const ext = detectFileExtension(language);
  const submissionData: SubmissionData = {
    platform: 'tlx',
    submissionId: submissionId || `tlx-${Date.now()}`,
    problem: problemDetails,
    language,
    extension: ext,
    sourceCode,
    verdict: 'Accepted (100)',
    submittedAt: Date.now(),
  };

  if (btn) btn.innerText = 'Syncing to GitHub...';

  const res = await browser.runtime.sendMessage({
    type: 'SYNC_SUBMISSION',
    payload: submissionData,
  });

  if (res.ok) {
    showFloatingToast(`Successfully synced ${problemDetails.problemId} to GitHub!`, 'success');
    if (btn) {
      btn.innerText = 'Synced to GitHub!';
      setTimeout(() => {
        btn.innerHTML = `
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          Sync to GitHub
        `;
      }, 3000);
    }
  } else {
    throw new Error(res.error || 'GitHub commit failed');
  }
}

function getSubmissionIdFromUrl(): string | null {
  const m = window.location.pathname.match(/\/submissions\/([a-zA-Z0-9_-]+)/i);
  return m ? m[1] : null;
}

/**
 * Check if the current page is a single submission page and has AC
 */
async function checkSingleSubmissionPageAutoSync() {
  const submissionId = getSubmissionIdFromUrl();
  if (!submissionId || isAutoSyncing || processedSubmissionIds.has(submissionId)) return;

  // Check if verdict in DOM is Accepted (AC or 100)
  const isAC = checkDomForACVerdict();
  if (!isAC) return;

  await autoSyncTLXSubmission(submissionId);
}

function checkDomForACVerdict(): boolean {
  // Check Verdict tags: .verdict-tag, .grading-verdict-tag, .bp4-intent-success, etc.
  const verdictElements = document.querySelectorAll(
    '.verdict-tag, .grading-verdict-tag, [class*="intent-success"], [class*="verdict-ac"], [class*="verdict--ac"]',
  );

  for (const el of Array.from(verdictElements)) {
    const text = el.textContent?.trim() || '';
    if (/^(AC|Accepted|100)$/i.test(text) || text.includes('Accepted') || text.includes('100')) {
      return true;
    }
  }

  // Also check if any table cell or general-info contains Accepted (100)
  const generalInfo = document.querySelector('.general-info');
  if (generalInfo && /Accepted|100/i.test(generalInfo.textContent || '')) {
    return true;
  }

  return false;
}

/**
 * Performs automatic sync for a specific TLX submission
 */
async function autoSyncTLXSubmission(submissionId: string) {
  if (isAutoSyncing || processedSubmissionIds.has(submissionId)) return;

  // Check config
  const config = await browser.runtime.sendMessage({ type: 'GET_CONFIG' });
  if (config?.autoSync === false || config?.enabledPlatforms?.tlx === false) {
    return;
  }

  // Check if already synced in storage
  const syncCheck = await browser.runtime.sendMessage({
    type: 'IS_SUBMISSION_SYNCED',
    payload: { platform: 'tlx', submissionId },
  });

  if (syncCheck?.synced) {
    processedSubmissionIds.add(submissionId);
    return;
  }

  isAutoSyncing = true;
  processedSubmissionIds.add(submissionId);

  showFloatingToast(`[CPBase] Detected AC submission #${submissionId}. Auto-syncing to GitHub...`, 'info');

  try {
    let sourceCode = '';
    let language = 'C++';
    let problemDetails: ProblemDetails | null = null;

    // 1. Fetch exact multi-line source code via API
    try {
      const apiData = await fetchTLXSubmissionViaAPI(submissionId);
      sourceCode = apiData.code;
      language = apiData.language;
      problemDetails = extractTLXProblemDetails(apiData.problemAlias, apiData.problemName);
    } catch (apiErr) {
      console.warn('[CPBase] TLX API fetch failed, falling back to DOM extraction:', apiErr);
      sourceCode = extractMultiLineCodeFromDOM();
      problemDetails = extractTLXProblemDetails();
    }

    if (!sourceCode) {
      throw new Error('Could not extract multi-line source code.');
    }

    if (!problemDetails) {
      problemDetails = {
        platform: 'tlx',
        problemId: submissionId,
        problemTitle: `TLX Submission ${submissionId}`,
        problemUrl: window.location.href,
        tags: ['TLX Toki'],
        statementMarkdown: '',
      };
    }

    const ext = detectFileExtension(language);
    const submissionData: SubmissionData = {
      platform: 'tlx',
      submissionId,
      problem: problemDetails,
      language,
      extension: ext,
      sourceCode,
      verdict: 'Accepted (100)',
      submittedAt: Date.now(),
    };

    const res = await browser.runtime.sendMessage({
      type: 'SYNC_SUBMISSION',
      payload: submissionData,
    });

    if (res.ok) {
      showFloatingToast(
        `[CPBase] Auto-synced ${problemDetails.problemId} (${problemDetails.problemTitle}) to GitHub!`,
        'success',
      );
    } else {
      throw new Error(res.error || 'Commit failed.');
    }
  } catch (err: any) {
    console.error('[CPBase] TLX Auto-sync error:', err);
    showFloatingToast(`[CPBase] Auto-sync failed: ${err.message}`, 'error');
  } finally {
    isAutoSyncing = false;
  }
}

/**
 * Live observer for TLX verdicts
 * Handles both Single Submission page verdict updates and Submissions Table rows
 */
function initTLXAutoSyncObserver() {
  const observer = new MutationObserver(() => {
    // 1. If currently on a single submission page
    const singleSubId = getSubmissionIdFromUrl();
    if (singleSubId && !processedSubmissionIds.has(singleSubId)) {
      if (checkDomForACVerdict()) {
        autoSyncTLXSubmission(singleSubId);
      }
    }

    // 2. Check submissions table rows (e.g. on problem page or submissions list)
    const rows = document.querySelectorAll('table tbody tr');
    rows.forEach((row) => {
      // Find submission link or id in row
      const subLink = row.querySelector('a[href*="/submissions/"]') as HTMLAnchorElement;
      if (!subLink) return;

      const m = subLink.getAttribute('href')?.match(/\/submissions\/([a-zA-Z0-9_-]+)/i);
      const subId = m ? m[1] : null;
      if (!subId || processedSubmissionIds.has(subId)) return;

      // Check verdict in this row
      const verdictEl = row.querySelector('.verdict-tag, .grading-verdict-tag, [class*="intent-success"]');
      const text = verdictEl?.textContent?.trim() || '';
      if (/^(AC|Accepted|100)$/i.test(text) || text.includes('Accepted') || text.includes('100')) {
        autoSyncTLXSubmission(subId);
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
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
  const borderColor = type === 'success' ? '#10b981' : type === 'error' ? '#f43f5e' : '#3b82f6';
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
    font-family: "Plus Jakarta Sans", system-ui, -apple-system, sans-serif;
    font-size: 12px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 240px;
    max-width: 380px;
    animation: cpbase-fadein 0.2s ease-out;
  `;

  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
