import { browser } from 'wxt/browser';
import { extractCodeforcesStatement } from '@/lib/problem-parser';
import { deteksiEkstensiFile } from '@/lib/languages';
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
    perbaruiVisibilitasTombolSyncCodeforces();
    pantauPerubahanPengaturanStorage();
    periksaHalamanSubmissionTunggal();
    pantauStatusSubmission();
  },
});

let sedangAutoSync = false;
const idSubmissionDiproses = new Set<string>();

function pantauPerubahanPengaturanStorage() {
  try {
    browser.storage?.onChanged?.addListener((perubahan, area) => {
      if (area === 'local' && perubahan.cpbase_config) {
        perbaruiVisibilitasTombolSyncCodeforces();
      }
    });
  } catch {}
}

async function perbaruiVisibilitasTombolSyncCodeforces() {
  try {
    const config = await browser.runtime.sendMessage({ type: 'GET_CONFIG' });
    const autoSyncAktif = config?.autoSync !== false;
    const wadahLama = document.getElementById('cpbase-cf-sync-container');

    if (autoSyncAktif) {
      if (wadahLama) {
        wadahLama.remove();
      }
    } else {
      if (!wadahLama) {
        inisialisasiTombolSyncCodeforces();
      }
    }
  } catch {
    inisialisasiTombolSyncCodeforces();
  }
}

function ambilContestDanIndex(): { contestId: string; index: string } | null {
  const path = window.location.pathname;
  let m = path.match(/\/contest\/(\d+)\/problem\/([A-Za-z0-9]+)/i);
  if (m) return { contestId: m[1], index: m[2].toUpperCase() };

  m = path.match(/\/problemset\/problem\/(\d+)\/([A-Za-z0-9]+)/i);
  if (m) return { contestId: m[1], index: m[2].toUpperCase() };

  m = path.match(/\/gym\/(\d+)\/problem\/([A-Za-z0-9]+)/i);
  if (m) return { contestId: `Gym-${m[1]}`, index: m[2].toUpperCase() };

  return null;
}

function uraikanProblemDariUrl(url: string): { contestId: string; index: string } | null {
  let m = url.match(/\/contest\/(\d+)\/problem\/([A-Za-z0-9]+)/i);
  if (m) return { contestId: m[1], index: m[2].toUpperCase() };

  m = url.match(/\/problemset\/problem\/(\d+)\/([A-Za-z0-9]+)/i);
  if (m) return { contestId: m[1], index: m[2].toUpperCase() };

  m = url.match(/\/gym\/(\d+)\/problem\/([A-Za-z0-9]+)/i);
  if (m) return { contestId: `Gym-${m[1]}`, index: m[2].toUpperCase() };

  return null;
}

function ekstrakDetailProblem(): ProblemDetails | null {
  const ci = ambilContestDanIndex();
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

function inisialisasiTombolSyncCodeforces() {
  const header = document.querySelector('.problem-statement .header');
  if (!header || document.getElementById('cpbase-cf-sync-btn')) return;

  const wadahTombol = document.createElement('div');
  wadahTombol.id = 'cpbase-cf-sync-container';
  wadahTombol.style.cssText = 'margin-top: 12px; display: flex; gap: 8px; align-items: center; justify-content: center;';

  const tombolSync = document.createElement('button');
  tombolSync.id = 'cpbase-cf-sync-btn';
  tombolSync.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
      <polyline points="17 8 12 3 7 8"></polyline>
      <line x1="12" y1="3" x2="12" y2="15"></line>
    </svg>
    Sync to GitHub
  `;
  tombolSync.style.cssText = `
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

  tombolSync.onmouseover = () => (tombolSync.style.backgroundColor = '#059669');
  tombolSync.onmouseout = () => (tombolSync.style.backgroundColor = '#10b981');

  const statusSpan = document.createElement('span');
  statusSpan.id = 'cpbase-cf-sync-status';
  statusSpan.style.cssText = 'font-size: 12px; color: #64748b; font-family: system-ui, -apple-system, sans-serif;';

  wadahTombol.appendChild(tombolSync);
  wadahTombol.appendChild(statusSpan);
  header.appendChild(wadahTombol);

  tombolSync.addEventListener('click', async () => {
    tombolSync.disabled = true;
    statusSpan.textContent = 'Fetching latest AC submission...';
    statusSpan.style.color = '#3b82f6';

    try {
      await ambilDanSinkronisasiACTerakhir(statusSpan);
    } catch (err: any) {
      statusSpan.textContent = `Sync failed: ${err.message}`;
      statusSpan.style.color = '#ef4444';
    } finally {
      tombolSync.disabled = false;
    }
  });
}

function dekodeEntitasHtml(str: string): string {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function ekstrakSourceDariHtml(html: string): string | null {
  if (!html || typeof html !== 'string') return null;

  const pola = [
    /<pre[^>]*id=["']program-source-text["'][^>]*>([\s\S]*?)<\/pre>/i,
    /id=["']program-source-text["'][^>]*>([\s\S]*?)<\/pre>/i,
    /<pre[^>]*class=["'][^"']*prettyprint[^"']*["'][^>]*>([\s\S]*?)<\/pre>/i,
    /<pre[^>]*class=["'][^"']*program-source[^"']*["'][^>]*>([\s\S]*?)<\/pre>/i,
    /<textarea[^>]*id=["']program-source-text["'][^>]*>([\s\S]*?)<\/textarea>/i,
    /<textarea[^>]*class=["'][^"']*prettyprint[^"']*["'][^>]*>([\s\S]*?)<\/textarea>/i,
    /<textarea[^>]*class=["'][^"']*program-source[^"']*["'][^>]*>([\s\S]*?)<\/textarea>/i,
    /<code[^>]*class=["'][^"']*prettyprint[^"']*["'][^>]*>([\s\S]*?)<\/code>/i,
  ];

  for (const re of pola) {
    const m = html.match(re);
    if (m && m[1]) {
      const teks = m[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(?:li|div|p)>/gi, '\n')
        .replace(/<[^>]+>/g, '');
      const hasilDekode = dekodeEntitasHtml(teks).trim();
      if (hasilDekode.length > 0 && !/access denied|forbidden|please wait|just a moment/i.test(hasilDekode)) {
        return hasilDekode;
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

function cariSourceCodeActivediDocument(): string | null {
  const pemilih = [
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

  for (const sel of pemilih) {
    const elemenList = document.querySelectorAll(sel);
    for (const el of Array.from(elemenList)) {
      const teks = (el instanceof HTMLTextAreaElement ? el.value : el.textContent)?.trim();
      if (teks && teks.length > 5 && !/access denied|forbidden|please wait/i.test(teks)) {
        return teks;
      }
    }
  }

  return null;
}

function ambilTokenCsrfCodeforces(): string | null {
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

async function ambilSourceViaApiInternal(submissionId: number | string): Promise<string | null> {
  const csrf = ambilTokenCsrfCodeforces();
  if (!csrf) return null;

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

    const teks = await res.text();

    if (teks.trim().startsWith('{')) {
      try {
        const json = JSON.parse(teks);
        if (json.source && typeof json.source === 'string' && json.source.trim()) {
          return json.source.trim();
        }
      } catch {}
    }

    const ekstrakHasil = ekstrakSourceDariHtml(teks);
    if (ekstrakHasil) return ekstrakHasil;

    const teksBiasa = dekodeEntitasHtml(teks.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '')).trim();
    if (teksBiasa && teksBiasa.length > 10 && !/forbidden|access denied|please wait|error/i.test(teksBiasa)) {
      return teksBiasa;
    }
  } catch {}

  return null;
}

async function ambilSourceViaTriggerModal(submissionId: number | string): Promise<string | null> {
  const tautan = document.querySelector(
    `a.view-source[submissionid="${submissionId}"], a[href*="/submission/${submissionId}"]`,
  ) as HTMLElement;

  if (!tautan) return null;

  tautan.click();

  for (let i = 0; i < 15; i++) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const kode = cariSourceCodeActivediDocument();
    if (kode) {
      const tombolTutup = document.querySelector('#facebox .close, .source-popup .close, .close-button') as HTMLElement;
      tombolTutup?.click();
      return kode;
    }
  }

  return null;
}

async function ambilSourceViaUrlLangsung(
  contestId: number | string,
  submissionId: number | string,
): Promise<string | null> {
  const isGym = String(contestId).startsWith('Gym-') || window.location.pathname.includes('/gym/');
  const cleanId = String(contestId).replace(/^Gym-/i, '');
  const daftarKandidatUrl = [
    isGym
      ? `https://codeforces.com/gym/${cleanId}/submission/${submissionId}`
      : `https://codeforces.com/contest/${cleanId}/submission/${submissionId}`,
    `https://codeforces.com/problemset/submission/${cleanId}/${submissionId}`,
  ];

  for (const url of daftarKandidatUrl) {
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) continue;
      const html = await res.text();
      const kode = ekstrakSourceDariHtml(html);
      if (kode) return kode;
    } catch {}
  }

  return null;
}

function temukanIndeksKolom(tabel: Element, polaHeader: RegExp): number {
  const headers = tabel.querySelectorAll('th');
  for (let i = 0; i < headers.length; i++) {
    if (polaHeader.test(headers[i].textContent || '')) {
      return i;
    }
  }
  return -1;
}

function ambilSubmissionACTerakhirDariSidebar(): { submissionId: string; language?: string } | null {
  const daftarTabel = document.querySelectorAll('table.rtable, .status-frame-datatable');
  for (const tabel of Array.from(daftarTabel)) {
    const indeksBahasa = temukanIndeksKolom(tabel, /lang|bahasa/i);
    const daftarBaris = tabel.querySelectorAll('tr');

    for (const baris of Array.from(daftarBaris)) {
      const verdictEl = baris.querySelector('.verdict-accepted');
      const textContent = baris.textContent || '';
      const isAccepted = verdictEl || /\bAccepted\b/i.test(textContent);
      if (isAccepted) {
        const link = baris.querySelector('a.view-source, a[href*="/submission/"]') as HTMLAnchorElement;
        const subId =
          link?.getAttribute('submissionid') ||
          link?.href?.match(/\/submission\/(\d+)/)?.[1] ||
          link?.textContent?.trim();
        if (subId && /^\d+$/.test(subId)) {
          const sel = baris.querySelectorAll('td');
          let bahasa: string | undefined;

          if (indeksBahasa >= 0 && sel[indeksBahasa]) {
            bahasa = sel[indeksBahasa]?.textContent?.trim();
          } else if (sel.length >= 5) {
            bahasa = sel[sel.length === 8 ? 4 : 3]?.textContent?.trim();
          }

          return { submissionId: subId, language: bahasa };
        }
      }
    }
  }
  return null;
}

async function ambilKodeSumberSubmission(
  contestId: number | string,
  submissionId: number | string,
): Promise<string> {
  const kodeAda = cariSourceCodeActivediDocument();
  if (kodeAda) return kodeAda;

  const kodeDariApi = await ambilSourceViaApiInternal(submissionId);
  if (kodeDariApi) return kodeDariApi;

  const kodeDariModal = await ambilSourceViaTriggerModal(submissionId);
  if (kodeDariModal) return kodeDariModal;

  const kodeDariUrlLangsung = await ambilSourceViaUrlLangsung(contestId, submissionId);
  if (kodeDariUrlLangsung) return kodeDariUrlLangsung;

  throw new Error('Could not locate source code on Codeforces. Please open your submission to view code.');
}

async function ambilDanSinkronisasiACTerakhir(statusSpan?: HTMLElement) {
  const config = await browser.runtime.sendMessage({ type: 'GET_CONFIG' });
  const handle = config?.codeforcesHandle;

  const ci = ambilContestDanIndex();
  if (!ci) throw new Error('Could not parse contest & problem index.');

  const sidebarAc = ambilSubmissionACTerakhirDariSidebar();
  let submissionId = sidebarAc?.submissionId;
  let programmingLanguage = sidebarAc?.language;
  let execTime: string | undefined;
  let memoryUsed: string | undefined;
  let submittedAt = Date.now();

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
    } catch {}
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

  if (!programmingLanguage) {
    const langSelect = document.querySelector('select[name="programTypeId"]') as HTMLSelectElement;
    if (langSelect && langSelect.selectedIndex >= 0) {
      programmingLanguage = langSelect.options[langSelect.selectedIndex]?.text?.trim();
    }
    programmingLanguage = programmingLanguage || 'GNU C++';
  }

  const kode = await ambilKodeSumberSubmission(ci.contestId, submissionId);
  const detailProblem = ekstrakDetailProblem();
  if (!detailProblem) throw new Error('Could not extract problem statement details.');

  const ekstensi = deteksiEkstensiFile(programmingLanguage, kode);

  const submissionData: SubmissionData = {
    platform: 'codeforces',
    submissionId,
    problem: detailProblem,
    language: programmingLanguage,
    extension: ekstensi,
    sourceCode: kode,
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

async function sinkronisasiOtomatisCodeforces(
  submissionId: string,
  contestId: string,
  index: string,
  problemTitle?: string,
  language?: string,
) {
  if (sedangAutoSync || idSubmissionDiproses.has(submissionId)) return;

  const config = await browser.runtime.sendMessage({ type: 'GET_CONFIG' });
  if (config?.autoSync === false || config?.enabledPlatforms?.codeforces === false) {
    return;
  }

  const syncCheck = await browser.runtime.sendMessage({
    type: 'IS_SUBMISSION_SYNCED',
    payload: { platform: 'codeforces', submissionId },
  });

  if (syncCheck?.synced) {
    idSubmissionDiproses.add(submissionId);
    return;
  }

  sedangAutoSync = true;
  idSubmissionDiproses.add(submissionId);

  const kunciProblem = `${contestId}${index}`;
  tampilkanToastMelayang(`[CPBase] Detected AC submission #${submissionId} for ${kunciProblem}. Auto-syncing to GitHub...`, 'info');

  try {
    const kode = await ambilKodeSumberSubmission(contestId, submissionId);
    let detailProblem = ekstrakDetailProblem();

    if (!detailProblem) {
      const problemUrl = `https://codeforces.com/contest/${contestId}/problem/${index}`;
      detailProblem = {
        platform: 'codeforces',
        problemId: kunciProblem,
        problemTitle: problemTitle || `Problem ${index}`,
        problemUrl,
        contestId,
        tags: ['Codeforces'],
        statementMarkdown: '',
      };
    }

    const bahasa = language || 'C++';
    const ekstensi = deteksiEkstensiFile(bahasa, kode);

    const submissionData: SubmissionData = {
      platform: 'codeforces',
      submissionId,
      problem: detailProblem,
      language: bahasa,
      extension: ekstensi,
      sourceCode: kode,
      verdict: 'Accepted',
      submittedAt: Date.now(),
    };

    const res = await browser.runtime.sendMessage({
      type: 'SYNC_SUBMISSION',
      payload: submissionData,
    });

    if (res.ok) {
      tampilkanToastMelayang(`[CPBase] Auto-synced ${kunciProblem} (${detailProblem.problemTitle}) to GitHub!`, 'success');
    } else {
      throw new Error(res.error || 'Commit failed');
    }
  } catch (err: any) {
    tampilkanToastMelayang(`[CPBase] Auto-sync failed: ${err.message}`, 'error');
  } finally {
    sedangAutoSync = false;
  }
}

async function periksaHalamanSubmissionTunggal() {
  const m = window.location.pathname.match(/\/submission\/(\d+)/i);
  if (!m) return;

  const submissionId = m[1];
  if (idSubmissionDiproses.has(submissionId)) return;

  const verdictEl = document.querySelector('.verdict-accepted');
  if (!verdictEl && !/Accepted/i.test(document.body.innerText)) return;

  const problemLink = document.querySelector('table.rtable a[href*="/problem/"], .status-frame-datatable a[href*="/problem/"]') as HTMLAnchorElement;
  if (!problemLink) return;

  const parsed = uraikanProblemDariUrl(problemLink.getAttribute('href') || '');
  if (!parsed) return;

  const title = problemLink.textContent?.trim();
  const tabel = document.querySelector('table.rtable, .status-frame-datatable');
  let bahasa = 'C++';

  if (tabel) {
    const indeksBahasa = temukanIndeksKolom(tabel, /lang|bahasa/i);
    const sel = tabel.querySelectorAll('td');
    if (indeksBahasa >= 0 && sel[indeksBahasa]) {
      bahasa = sel[indeksBahasa].textContent?.trim() || 'C++';
    } else {
      const selAlternatif = document.querySelector('table.rtable td:nth-child(4), .status-frame-datatable td:nth-child(5)');
      if (selAlternatif?.textContent?.trim()) {
        bahasa = selAlternatif.textContent.trim();
      }
    }
  }

  await sinkronisasiOtomatisCodeforces(submissionId, parsed.contestId, parsed.index, title, bahasa);
}

function pantauStatusSubmission() {
  function periksaTabelDatatable() {
    const daftarBaris = document.querySelectorAll('.status-frame-datatable tr[data-submission-id]');
    const tabel = document.querySelector('.status-frame-datatable');
    const indeksBahasa = tabel ? temukanIndeksKolom(tabel, /lang|bahasa/i) : -1;

    daftarBaris.forEach((baris) => {
      const submissionId = baris.getAttribute('data-submission-id');
      if (!submissionId || idSubmissionDiproses.has(submissionId)) return;

      const verdictEl = baris.querySelector('.verdict-accepted');
      if (!verdictEl) return;

      const problemLink = baris.querySelector('a[href*="/problem/"]') as HTMLAnchorElement;
      if (!problemLink) return;

      const parsed = uraikanProblemDariUrl(problemLink.getAttribute('href') || '');
      if (!parsed) return;

      const title = problemLink.textContent?.trim();
      const selBaris = baris.querySelectorAll('td');
      let bahasa = 'C++';

      if (indeksBahasa >= 0 && selBaris[indeksBahasa]) {
        bahasa = selBaris[indeksBahasa].textContent?.trim() || 'C++';
      } else {
        const langEl = baris.querySelector('td:nth-child(5)') || baris.querySelector('td:nth-child(4)');
        if (langEl?.textContent?.trim()) {
          bahasa = langEl.textContent.trim();
        }
      }

      sinkronisasiOtomatisCodeforces(submissionId, parsed.contestId, parsed.index, title, bahasa);
    });
  }

  periksaTabelDatatable();

  const statusTable = document.querySelector('.status-frame-datatable') || document.body;
  const pengamat = new MutationObserver(() => {
    periksaTabelDatatable();
  });

  pengamat.observe(statusTable, { childList: true, subtree: true });
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
  const borderColor = tipe === 'success' ? '#10b981' : tipe === 'error' ? '#ef4444' : '#3b82f6';
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

  toast.textContent = pesan;
  wadahToast.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
