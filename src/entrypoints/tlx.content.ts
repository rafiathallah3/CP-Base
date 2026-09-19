import { browser } from 'wxt/browser';
import { extractTLXStatement } from '@/lib/problem-parser';
import { deteksiEkstensiFile } from '@/lib/languages';
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
    setInterval(cekDanSisipkanTombolSyncTLX, 2000);
    pantauPerubahanPengaturanStorage();
    inisialisasiObserverAutoSyncTLX();
    cekAutoSyncHalamanSubmissionTunggal();
  },
});

let sedangAutoSync = false;
const idSubmissionDiproses = new Set<string>();

function pantauPerubahanPengaturanStorage() {
  try {
    browser.storage?.onChanged?.addListener((perubahan, area) => {
      if (area === 'local' && perubahan.cpbase_config) {
        cekDanSisipkanTombolSyncTLX();
      }
    });
  } catch {}
}

function ambilTokenAuthTLX(): string | null {
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

function dekodeBase64Unicode(base64: string): string {
  const binString = atob(base64);
  return new TextDecoder().decode(Uint8Array.from(binString, (m) => m.codePointAt(0) || 0));
}

async function ambilSubmissionTLXViaAPI(submissionId: string) {
  const token = ambilTokenAuthTLX();
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
  const berkasSumber = data?.source?.submissionFiles || {};
  const fileKey = Object.keys(berkasSumber)[0];
  if (!fileKey || !berkasSumber[fileKey]?.content) {
    throw new Error('No source file found in TLX API response.');
  }

  const berkas = berkasSumber[fileKey];
  const kode = dekodeBase64Unicode(berkas.content);
  const bahasa =
    data?.submission?.gradingLanguage ||
    data?.submission?.programmingLanguage ||
    data?.submission?.language ||
    '';
  const namaFile = berkas.name || fileKey || 'solution';
  const verdict = data?.submission?.latestGrading?.verdict?.name || data?.submission?.latestGrading?.verdict?.code || '';
  const skor = data?.submission?.latestGrading?.score;
  const problemAlias = data?.submission?.problemAlias || '';
  const problemName = data?.submission?.problemName || '';
  const problemJid = data?.submission?.problemJid || '';

  return {
    code: kode,
    language: bahasa,
    filename: namaFile,
    verdict,
    score: skor,
    problemAlias,
    problemName,
    problemJid,
  };
}

function ekstrakKodeMultiBarisDariDOM(): string {
  const preEl = document.querySelector('pre.source-code, .submission-details pre, pre');
  if (preEl) {
    const codeEl = preEl.querySelector('code') || preEl;
    const directSpans = codeEl.querySelectorAll(':scope > span');
    if (directSpans.length > 1) {
      const barisTeks: string[] = [];
      directSpans.forEach((span) => {
        const clone = span.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('.react-syntax-highlighter-line-number, .linenumber').forEach((el) => el.remove());
        barisTeks.push(clone.textContent || '');
      });
      const hasil = barisTeks.join('\n').trim();
      if (hasil.length > 0) return hasil;
    }

    const clone = preEl.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.react-syntax-highlighter-line-number, .linenumber').forEach((el) => el.remove());
    const inner = (clone as HTMLElement).innerText;
    if (inner && inner.includes('\n')) {
      return inner.trim();
    }
  }

  const textarea = document.querySelector('textarea.code-editor, textarea[name="source"]') as HTMLTextAreaElement;
  if (textarea?.value) {
    return textarea.value.trim();
  }

  const barisMonaco = document.querySelectorAll('.monaco-editor .view-line');
  if (barisMonaco.length > 1) {
    return Array.from(barisMonaco)
      .map((line) => line.textContent || '')
      .join('\n')
      .trim();
  }

  return '';
}

function ambilSlugProblemTLX(): { category: string; slug: string } | null {
  const path = window.location.pathname;

  let m = path.match(/\/contests\/([^/]+)\/problems\/([^/]+)/i);
  if (m) return { category: `Contest-${m[1]}`, slug: m[2] };

  m = path.match(/\/courses\/([^/]+)\/.*\/problems\/([^/]+)/i);
  if (m) return { category: `Course-${m[1]}`, slug: m[2] };

  m = path.match(/\/problems\/([^/]+)/i);
  if (m) return { category: 'Problemset', slug: m[1] };

  return null;
}

function ekstrakDetailProblemTLX(fallbackAlias?: string, fallbackTitle?: string): ProblemDetails | null {
  const info = ambilSlugProblemTLX();
  const slug = info?.slug || fallbackAlias || 'problem';
  const category = info?.category || 'Problemset';

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

  const statementMarkdown = contentEl ? extractTLXStatement(contentEl) : '';

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

async function cekDanSisipkanTombolSyncTLX() {
  const tombolAda = document.getElementById('cpbase-tlx-sync-btn');

  try {
    const config = await browser.runtime.sendMessage({ type: 'GET_CONFIG' });
    const autoSyncAktif = config?.autoSync !== false;

    if (autoSyncAktif) {
      if (tombolAda) {
        tombolAda.remove();
      }
      return;
    }
  } catch {}

  if (!ambilSlugProblemTLX()) {
    if (tombolAda) tombolAda.remove();
    return;
  }

  if (tombolAda) return;

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
      await sinkronisasiTLXManual(btn);
    } catch (err: any) {
      tampilkanToastMelayang(`Sync failed: ${err.message}`, 'error');
      btn.innerHTML = 'Sync failed (Click to retry)';
    } finally {
      btn.disabled = false;
    }
  });

  document.body.appendChild(btn);
}

function ambilBahasaDariDOM(): string {
  const teksHalaman = document.body.innerText || '';
  const kecocokanBahasa = teksHalaman.match(/(?:Bahasa|Language)[:\s]+([A-Za-z0-9+#. -]+)/i);
  if (kecocokanBahasa?.[1]) {
    return kecocokanBahasa[1].trim();
  }
  return '';
}

async function sinkronisasiTLXManual(btn?: HTMLButtonElement) {
  const submissionId = ambilIdSubmissionDariUrl();
  let sourceCode = '';
  let language = '';
  let problemDetails: ProblemDetails | null = null;

  if (submissionId) {
    try {
      const apiData = await ambilSubmissionTLXViaAPI(submissionId);
      sourceCode = apiData.code;
      language = apiData.language;
      problemDetails = ekstrakDetailProblemTLX(apiData.problemAlias, apiData.problemName);
    } catch {
      sourceCode = ekstrakKodeMultiBarisDariDOM();
      language = ambilBahasaDariDOM();
      problemDetails = ekstrakDetailProblemTLX();
    }
  } else {
    sourceCode = ekstrakKodeMultiBarisDariDOM();
    language = ambilBahasaDariDOM();
    problemDetails = ekstrakDetailProblemTLX();
  }

  if (!sourceCode) {
    throw new Error('Could not find source code on page. Open your submitted solution or editor tab.');
  }

  if (!problemDetails) {
    throw new Error('Problem details could not be extracted.');
  }

  const ext = deteksiEkstensiFile(language, sourceCode);
  const submissionData: SubmissionData = {
    platform: 'tlx',
    submissionId: submissionId || `tlx-${Date.now()}`,
    problem: problemDetails,
    language: language || ext.toUpperCase(),
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
    tampilkanToastMelayang(`Successfully synced ${problemDetails.problemId} to GitHub!`, 'success');
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

function ambilIdSubmissionDariUrl(): string | null {
  const m = window.location.pathname.match(/\/submissions\/([a-zA-Z0-9_-]+)/i);
  return m ? m[1] : null;
}

async function cekAutoSyncHalamanSubmissionTunggal() {
  const submissionId = ambilIdSubmissionDariUrl();
  if (!submissionId || sedangAutoSync || idSubmissionDiproses.has(submissionId)) return;

  const isAC = cekDomUntukVerdictAC();
  if (!isAC) return;

  const bahasa = ambilBahasaDariDOM();
  await sinkronisasiOtomatisTLX(submissionId, bahasa);
}

function cekDomUntukVerdictAC(): boolean {
  const elemenVerdict = document.querySelectorAll(
    '.verdict-tag, .grading-verdict-tag, [class*="intent-success"], [class*="verdict-ac"], [class*="verdict--ac"]',
  );

  for (const el of Array.from(elemenVerdict)) {
    const text = el.textContent?.trim() || '';
    if (/^(AC|Accepted|100)$/i.test(text) || text.includes('Accepted') || text.includes('100')) {
      return true;
    }
  }

  const generalInfo = document.querySelector('.general-info');
  if (generalInfo && /Accepted|100/i.test(generalInfo.textContent || '')) {
    return true;
  }

  return false;
}

async function sinkronisasiOtomatisTLX(submissionId: string, bahasaAwal?: string) {
  if (sedangAutoSync || idSubmissionDiproses.has(submissionId)) return;

  const config = await browser.runtime.sendMessage({ type: 'GET_CONFIG' });
  if (config?.autoSync === false || config?.enabledPlatforms?.tlx === false) {
    return;
  }

  const syncCheck = await browser.runtime.sendMessage({
    type: 'IS_SUBMISSION_SYNCED',
    payload: { platform: 'tlx', submissionId },
  });

  if (syncCheck?.synced) {
    idSubmissionDiproses.add(submissionId);
    return;
  }

  sedangAutoSync = true;
  idSubmissionDiproses.add(submissionId);

  tampilkanToastMelayang(`[CPBase] Detected AC submission #${submissionId}. Auto-syncing to GitHub...`, 'info');

  try {
    let sourceCode = '';
    let language = bahasaAwal || '';
    let problemDetails: ProblemDetails | null = null;

    try {
      const apiData = await ambilSubmissionTLXViaAPI(submissionId);
      sourceCode = apiData.code;
      language = apiData.language || language;
      problemDetails = ekstrakDetailProblemTLX(apiData.problemAlias, apiData.problemName);
    } catch {
      sourceCode = ekstrakKodeMultiBarisDariDOM();
      language = language || ambilBahasaDariDOM();
      problemDetails = ekstrakDetailProblemTLX();
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

    const ext = deteksiEkstensiFile(language, sourceCode);
    const submissionData: SubmissionData = {
      platform: 'tlx',
      submissionId,
      problem: problemDetails,
      language: language || ext.toUpperCase(),
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
      tampilkanToastMelayang(
        `[CPBase] Auto-synced ${problemDetails.problemId} (${problemDetails.problemTitle}) to GitHub!`,
        'success',
      );
    } else {
      throw new Error(res.error || 'Commit failed.');
    }
  } catch (err: any) {
    tampilkanToastMelayang(`[CPBase] Auto-sync failed: ${err.message}`, 'error');
  } finally {
    sedangAutoSync = false;
  }
}

function inisialisasiObserverAutoSyncTLX() {
  const pengamat = new MutationObserver(() => {
    const singleSubId = ambilIdSubmissionDariUrl();
    if (singleSubId && !idSubmissionDiproses.has(singleSubId)) {
      if (cekDomUntukVerdictAC()) {
        const bahasa = ambilBahasaDariDOM();
        sinkronisasiOtomatisTLX(singleSubId, bahasa);
      }
    }

    const daftarBaris = document.querySelectorAll('table tbody tr');
    const thList = Array.from(document.querySelectorAll('table thead th'));
    const indeksBahasa = thList.findIndex((th) => /bahasa|lang/i.test(th.textContent || ''));

    daftarBaris.forEach((baris) => {
      const subLink = baris.querySelector('a[href*="/submissions/"]') as HTMLAnchorElement;
      if (!subLink) return;

      const m = subLink.getAttribute('href')?.match(/\/submissions\/([a-zA-Z0-9_-]+)/i);
      const subId = m ? m[1] : null;
      if (!subId || idSubmissionDiproses.has(subId)) return;

      const verdictEl = baris.querySelector('.verdict-tag, .grading-verdict-tag, [class*="intent-success"]');
      const text = verdictEl?.textContent?.trim() || '';
      if (/^(AC|Accepted|100)$/i.test(text) || text.includes('Accepted') || text.includes('100')) {
        let bahasa = '';
        if (indeksBahasa >= 0) {
          const cells = baris.querySelectorAll('td');
          bahasa = cells[indeksBahasa]?.textContent?.trim() || '';
        }
        sinkronisasiOtomatisTLX(subId, bahasa);
      }
    });
  });

  pengamat.observe(document.body, { childList: true, subtree: true });
}

function tampilkanToastMelayang(pesan: string, tipe: 'info' | 'success' | 'error') {
  let wadahToast = document.getElementById('cpbase-toast-container');
  if (!wadahToast) {
    wadahToast = document.createElement('div');
    wadahToast.id = 'cpbase-toast-container';
    wadahToast.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 24px;
      z-index: 9999999;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
    `;
    document.body.appendChild(wadahToast);
  }

  const toast = document.createElement('div');
  const borderColor = tipe === 'success' ? '#10b981' : tipe === 'error' ? '#f43f5e' : '#3b82f6';
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
  `;

  toast.textContent = pesan;
  wadahToast.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
