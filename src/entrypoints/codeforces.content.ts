import { browser } from 'wxt/browser';
import { htmlToMarkdown } from '@/lib/html-to-markdown';
import { detectFileExtension } from '@/lib/languages';
import type { ProblemDetails, SubmissionData } from '@/lib/types';

export default defineContentScript({
  matches: [
    '*://codeforces.com/contest/*/problem/*',
    '*://codeforces.com/problemset/problem/*/*',
    '*://codeforces.com/gym/*/problem/*',
    '*://codeforces.com/group/*/contest/*/problem/*',
  ],
  runAt: 'document_idle',
  main() {
    console.log('[CPBase] Codeforces content script activated.');

    // Inject manual sync button and set up observer
    initCodeforcesSyncButton();
    observeSubmissionStatus();
  },
});

function getContestAndIndex(): { contestId: string; index: string } | null {
  const path = window.location.pathname;
  // /contest/1900/problem/A
  let m = path.match(/\/contest\/(\d+)\/problem\/([A-Za-z0-9]+)/i);
  if (m) return { contestId: m[1], index: m[2].toUpperCase() };

  // /problemset/problem/1900/A
  m = path.match(/\/problemset\/problem\/(\d+)\/([A-Za-z0-9]+)/i);
  if (m) return { contestId: m[1], index: m[2].toUpperCase() };

  // /gym/102000/problem/A
  m = path.match(/\/gym\/(\d+)\/problem\/([A-Za-z0-9]+)/i);
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

  // Tags and rating from sidebar
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
  const statementMarkdown = statementEl ? htmlToMarkdown(statementEl.innerHTML) : '';

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
 * Injects a modern "Sync with CPBase" button into problem header
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
    background-color: #2563eb;
    color: white;
    font-size: 13px;
    font-weight: 500;
    padding: 6px 14px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    transition: background 0.15s ease;
  `;

  button.onmouseover = () => (button.style.backgroundColor = '#1d4ed8');
  button.onmouseout = () => (button.style.backgroundColor = '#2563eb');

  const statusSpan = document.createElement('span');
  statusSpan.id = 'cpbase-cf-sync-status';
  statusSpan.style.cssText = 'font-size: 12px; color: #64748b;';

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

async function fetchAndSyncLatestAC(statusSpan?: HTMLElement) {
  const config = await browser.runtime.sendMessage({ type: 'GET_CONFIG' });
  const handle = config?.codeforcesHandle;

  if (!handle) {
    if (statusSpan) {
      statusSpan.textContent = 'Please configure your Codeforces handle in CPBase popup settings.';
      statusSpan.style.color = '#ef4444';
    }
    return;
  }

  const ci = getContestAndIndex();
  if (!ci) throw new Error('Could not parse contest & problem index.');

  // Fetch recent submissions for this user from official Codeforces API
  const apiUrl = `https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}&from=1&count=20`;
  const res = await fetch(apiUrl);
  const data = await res.json();

  if (data.status !== 'OK' || !Array.isArray(data.result)) {
    throw new Error(data.comment || 'Failed to query Codeforces API for submissions.');
  }

  // Find accepted submission matching current contest and problem index
  const acSubmission = data.result.find((s: any) => {
    const isAccepted = s.verdict === 'OK';
    const contestMatch = String(s.contestId) === String(ci.contestId);
    const indexMatch = String(s.problem?.index).toUpperCase() === ci.index;
    return isAccepted && contestMatch && indexMatch;
  });

  if (!acSubmission) {
    throw new Error(`No Accepted (OK) submission found for problem ${ci.contestId}${ci.index} under handle ${handle}.`);
  }

  if (statusSpan) {
    statusSpan.textContent = `Found submission #${acSubmission.id}! Fetching source code...`;
  }

  // Fetch source code from submission page
  const code = await fetchSubmissionSourceCode(acSubmission.contestId, acSubmission.id);
  const problemDetails = extractProblemDetails();
  if (!problemDetails) throw new Error('Could not extract problem statement details.');

  const ext = detectFileExtension(acSubmission.programmingLanguage || 'cpp');

  const submissionData: SubmissionData = {
    platform: 'codeforces',
    submissionId: String(acSubmission.id),
    problem: problemDetails,
    language: acSubmission.programmingLanguage || 'C++',
    extension: ext,
    sourceCode: code,
    verdict: 'Accepted',
    executionTime: `${acSubmission.timeConsumedMillis} ms`,
    memoryUsed: `${Math.round(acSubmission.memoryConsumedBytes / 1024)} KB`,
    submittedAt: acSubmission.creationTimeSeconds * 1000,
  };

  if (statusSpan) {
    statusSpan.textContent = 'Committing to GitHub...';
  }

  const syncResult = await browser.runtime.sendMessage({
    type: 'SYNC_SUBMISSION',
    payload: submissionData,
  });

  if (syncResult.ok) {
    if (statusSpan) {
      statusSpan.textContent = 'Successfully synced to GitHub!';
      statusSpan.style.color = '#22c55e';
    }
  } else {
    throw new Error(syncResult.error || 'Commit failed.');
  }
}

async function fetchSubmissionSourceCode(contestId: number | string, submissionId: number | string): Promise<string> {
  const url = `https://codeforces.com/contest/${contestId}/submission/${submissionId}`;
  const res = await fetch(url);
  const html = await res.text();

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const codeEl = doc.querySelector('#program-source-text');
  if (!codeEl || !codeEl.textContent) {
    throw new Error('Could not locate source code on Codeforces submission page.');
  }

  return codeEl.textContent.trim();
}

/**
 * Watch for live verdict updates if user is on the page submission view
 */
function observeSubmissionStatus() {
  const statusTable = document.querySelector('.status-frame-datatable');
  if (!statusTable) return;

  const observer = new MutationObserver(() => {
    const acceptedRow = statusTable.querySelector('span.verdict-accepted');
    if (acceptedRow) {
      console.log('[CPBase] Detected accepted verdict on Codeforces!');
      fetchAndSyncLatestAC().catch((e) => console.warn('[CPBase] Auto-sync notice:', e));
    }
  });

  observer.observe(statusTable, { childList: true, subtree: true });
}
