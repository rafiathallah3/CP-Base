import { browser } from 'wxt/browser';
import { htmlToMarkdown } from '@/lib/html-to-markdown';
import { detectFileExtension } from '@/lib/languages';
import type { ProblemDetails, SubmissionData } from '@/lib/types';

export default defineContentScript({
  matches: [
    '*://tlx.toki.id/problems/*',
    '*://tlx.toki.id/contests/*/problems/*',
    '*://tlx.toki.id/courses/*/problems/*',
  ],
  runAt: 'document_idle',
  main() {
    console.log('[CPBase] TLX Toki content script loaded.');

    // Wait for SPA page rendering
    setInterval(checkAndInjectTLXSync, 2000);
    observeTLXVerdicts();
  },
});

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

function extractTLXProblemDetails(): ProblemDetails | null {
  const info = getTLXProblemSlug();
  if (!info) return null;

  // Find title
  const h1 = document.querySelector('h1, h2, .problem-title');
  const problemTitle = h1?.textContent?.trim() || info.slug;

  // Time & memory limits
  let timeLimit = '';
  let memoryLimit = '';

  const textNodes = document.body.innerText;
  const timeMatch = textNodes.match(/(?:Batas Waktu|Time Limit)[:\s]+([0-9.]+\s*(?:s|ms|detik))/i);
  if (timeMatch) timeLimit = timeMatch[1];

  const memMatch = textNodes.match(/(?:Batas Memori|Memory Limit)[:\s]+([0-9.]+\s*(?:MB|KB|B))/i);
  if (memMatch) memoryLimit = memMatch[1];

  // Problem description
  const contentEl =
    document.querySelector('.problem-description') ||
    document.querySelector('.description') ||
    document.querySelector('article') ||
    document.querySelector('[class*="ProblemStatement"]') ||
    document.querySelector('[class*="description"]');

  const statementMarkdown = contentEl ? htmlToMarkdown(contentEl.innerHTML) : '';

  return {
    platform: 'tlx',
    problemId: info.slug,
    problemTitle,
    problemUrl: window.location.href,
    contestId: info.category,
    tags: ['TLX Toki'],
    timeLimit,
    memoryLimit,
    statementMarkdown,
  };
}

/**
 * Injects CPBase floating or header sync button in TLX
 */
function checkAndInjectTLXSync() {
  if (document.getElementById('cpbase-tlx-sync-btn')) return;

  const problemDetails = extractTLXProblemDetails();
  if (!problemDetails) return;

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
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    font-size: 13px;
    font-weight: 600;
    padding: 10px 18px;
    border-radius: 9999px;
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
    transition: all 0.2s ease;
  `;

  btn.onmouseover = () => {
    btn.style.transform = 'translateY(-2px)';
    btn.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.6)';
  };
  btn.onmouseout = () => {
    btn.style.transform = 'translateY(0)';
    btn.style.boxShadow = '0 4px 14px rgba(16, 185, 129, 0.4)';
  };

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.innerText = 'Extracting code...';

    try {
      await syncCurrentTLXSolution(btn);
    } catch (err: any) {
      alert(`[CPBase] Sync failed: ${err.message}`);
      btn.innerHTML = 'Sync failed (Click to retry)';
    } finally {
      btn.disabled = false;
    }
  });

  document.body.appendChild(btn);
}

async function syncCurrentTLXSolution(btn?: HTMLButtonElement) {
  const problemDetails = extractTLXProblemDetails();
  if (!problemDetails) throw new Error('Problem details could not be extracted.');

  // Try to find source code from Monaco Editor, Ace Editor, or Code View block
  let sourceCode = '';
  let language = 'C++';

  // 1. Check for Monaco Editor in page DOM
  const codeLines = document.querySelectorAll('.monaco-editor .view-line');
  if (codeLines.length > 0) {
    sourceCode = Array.from(codeLines)
      .map((line) => line.textContent || '')
      .join('\n');
  }

  // 2. Check for pre/code in submission modal/drawer
  if (!sourceCode) {
    const codeEl = document.querySelector('pre code, .submission-code pre, .code-editor pre');
    if (codeEl?.textContent) {
      sourceCode = codeEl.textContent.trim();
    }
  }

  // 3. Check for textarea input
  if (!sourceCode) {
    const textarea = document.querySelector('textarea.code-editor, textarea[name="source"]') as HTMLTextAreaElement;
    if (textarea?.value) {
      sourceCode = textarea.value.trim();
    }
  }

  if (!sourceCode) {
    throw new Error(
      'Could not find source code on page. Please open your submitted solution or code editor tab first.',
    );
  }

  // Detect language if specified in badge or dropdown
  const langBadge = document.querySelector('[class*="language"], select[name="language"]');
  if (langBadge?.textContent) {
    language = langBadge.textContent.trim();
  }

  const ext = detectFileExtension(language);

  const submission: SubmissionData = {
    platform: 'tlx',
    submissionId: `tlx-${Date.now()}`,
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
    payload: submission,
  });

  if (res.ok) {
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
    throw new Error(res.error || 'Commit failed');
  }
}

/**
 * Detect automatic AC verdict in TLX submissions table
 */
function observeTLXVerdicts() {
  const observer = new MutationObserver(() => {
    // In TLX, AC is either text 'AC', score '100', or badge with 'Accepted'
    const acElements = document.querySelectorAll(
      '[class*="verdict-ac"], [class*="verdict--ac"], .badge-success',
    );
    acElements.forEach((el) => {
      const text = el.textContent?.trim();
      if (text === 'AC' || text === '100') {
        console.log('[CPBase] TLX AC verdict observed in DOM.');
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
}
