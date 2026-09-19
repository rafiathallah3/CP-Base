import type { GitHubRepo, GitHubUser, SubmissionData } from './types';

const GITHUB_API_BASE = 'https://api.github.com';

function buatHeadersGitHub(token: string) {
  return {
    Authorization: `Bearer ${token.trim()}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

export function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToUtf8(base64: string): string {
  const binary = atob(base64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export async function verifyGitHubToken(token: string): Promise<GitHubUser> {
  const res = await fetch(`${GITHUB_API_BASE}/user`, {
    headers: buatHeadersGitHub(token),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `GitHub authentication failed (${res.status})`);
  }

  return res.json();
}

export async function listUserRepos(token: string): Promise<GitHubRepo[]> {
  const res = await fetch(`${GITHUB_API_BASE}/user/repos?per_page=100&sort=updated`, {
    headers: buatHeadersGitHub(token),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch repositories (${res.status})`);
  }

  const repos: GitHubRepo[] = await res.json();
  return repos.map((r) => ({
    id: r.id,
    name: r.name,
    full_name: r.full_name,
    private: r.private,
    html_url: r.html_url,
    default_branch: r.default_branch || 'main',
  }));
}

export async function createRepo(
  token: string,
  name: string,
  isPrivate = false,
  description = 'Competitive programming solutions synced via CPBase',
): Promise<GitHubRepo> {
  const res = await fetch(`${GITHUB_API_BASE}/user/repos`, {
    method: 'POST',
    headers: buatHeadersGitHub(token),
    body: JSON.stringify({
      name,
      private: isPrivate,
      auto_init: true,
      description,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Failed to create repository ${name} (${res.status})`);
  }

  return res.json();
}

export async function getFileSha(
  token: string,
  owner: string,
  repo: string,
  path: string,
  branch: string,
): Promise<{ sha: string; content?: string } | null> {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers: buatHeadersGitHub(token) });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Failed to check file ${path} (${res.status})`);
  }

  const data = await res.json();
  return {
    sha: data.sha,
    content: data.content ? base64ToUtf8(data.content) : undefined,
  };
}

export async function putFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  branch: string,
  sha?: string,
): Promise<{ commitSha: string; commitUrl: string }> {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`;
  const body: Record<string, unknown> = {
    message,
    content: utf8ToBase64(content),
    branch,
  };

  if (sha) {
    body.sha = sha;
  }

  const res = await fetch(url, {
    method: 'PUT',
    headers: buatHeadersGitHub(token),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `Failed to commit ${path} (${res.status})`);
  }

  const result = await res.json();
  return {
    commitSha: result.commit?.sha || '',
    commitUrl: result.commit?.html_url || `https://github.com/${owner}/${repo}`,
  };
}

function bersihkanNamaFolder(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '-').trim();
}

export function generateProblemReadme(submission: SubmissionData): string {
  const p = submission.problem;
  const lines: string[] = [];

  lines.push(`# [${p.problemId}] ${p.problemTitle}`);
  lines.push('');
  lines.push(`**Platform:** ${p.platform.toUpperCase()}  `);
  lines.push(`**Problem URL:** [${p.problemUrl}](${p.problemUrl})  `);
  if (p.rating) lines.push(`**Rating / Difficulty:** ${p.rating}  `);
  if (p.tags && p.tags.length > 0) lines.push(`**Tags:** \`${p.tags.join('`, `')}\`  `);
  if (p.timeLimit) lines.push(`**Time Limit:** ${p.timeLimit}  `);
  if (p.memoryLimit) lines.push(`**Memory Limit:** ${p.memoryLimit}  `);
  lines.push('');
  lines.push('## Submission Details');
  lines.push('');
  lines.push(`- **Status:** ${submission.verdict}`);
  lines.push(`- **Language:** ${submission.language}`);
  if (submission.executionTime) lines.push(`- **Execution Time:** ${submission.executionTime}`);
  if (submission.memoryUsed) lines.push(`- **Memory Used:** ${submission.memoryUsed}`);
  lines.push(`- **Submitted At:** ${new Date(submission.submittedAt).toUTCString()}`);
  lines.push('');

  if (p.statementMarkdown) {
    lines.push('## Problem Statement');
    lines.push('');
    lines.push(p.statementMarkdown.trim());
    lines.push('');
  }

  lines.push('---');
  lines.push('*Generated automatically with [CPBase](https://github.com/)*');
  return lines.join('\n');
}

export function generateMetadataJson(submission: SubmissionData): string {
  const p = submission.problem;
  const metadata = {
    platform: p.platform,
    problemId: p.problemId,
    problemTitle: p.problemTitle,
    problemUrl: p.problemUrl,
    contestId: p.contestId || null,
    rating: p.rating || null,
    tags: p.tags || [],
    timeLimit: p.timeLimit || null,
    memoryLimit: p.memoryLimit || null,
    submission: {
      submissionId: submission.submissionId,
      verdict: submission.verdict,
      language: submission.language,
      executionTime: submission.executionTime || null,
      memoryUsed: submission.memoryUsed || null,
      submittedAt: new Date(submission.submittedAt).toISOString(),
    },
  };
  return JSON.stringify(metadata, null, 2);
}

export async function syncSolutionToGitHub(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  submission: SubmissionData,
): Promise<{ commitSha: string; commitUrl: string }> {
  const p = submission.problem;

  let jalurFolder = '';
  if (p.platform === 'codeforces') {
    const contest = p.contestId ? bersihkanNamaFolder(p.contestId) : 'Problemset';
    const title = bersihkanNamaFolder(`${p.problemId} - ${p.problemTitle}`);
    jalurFolder = `Codeforces/${contest}/${title}`;
  } else {
    const category = p.contestId ? bersihkanNamaFolder(p.contestId) : 'Training';
    const title = bersihkanNamaFolder(p.problemTitle || p.problemId);
    jalurFolder = `TLX/${category}/${title}`;
  }

  const solutionPath = `${jalurFolder}/Solution.${submission.extension}`;
  const readmePath = `${jalurFolder}/README.md`;
  const metadataPath = `${jalurFolder}/metadata.json`;

  const pesanKomit = `[${p.platform.toUpperCase()}] ${p.problemId} - ${p.problemTitle} (${submission.verdict})${
    submission.executionTime ? ` | ${submission.executionTime}` : ''
  }${submission.memoryUsed ? ` | ${submission.memoryUsed}` : ''}`;

  const existingSolSha = await getFileSha(token, owner, repo, solutionPath, branch);
  const solResult = await putFile(
    token,
    owner,
    repo,
    solutionPath,
    submission.sourceCode,
    pesanKomit,
    branch,
    existingSolSha?.sha,
  );

  try {
    const existingReadmeSha = await getFileSha(token, owner, repo, readmePath, branch);
    await putFile(
      token,
      owner,
      repo,
      readmePath,
      generateProblemReadme(submission),
      `docs: add problem statement for ${p.problemId}`,
      branch,
      existingReadmeSha?.sha,
    );
  } catch {}

  try {
    const existingMetaSha = await getFileSha(token, owner, repo, metadataPath, branch);
    await putFile(
      token,
      owner,
      repo,
      metadataPath,
      generateMetadataJson(submission),
      `chore: update metadata for ${p.problemId}`,
      branch,
      existingMetaSha?.sha,
    );
  } catch {}

  try {
    await updateRootIndex(token, owner, repo, branch, submission, jalurFolder);
  } catch {}

  return solResult;
}

const TABLE_START_MARKER = '<!-- cpbase-table-start -->';
const TABLE_END_MARKER = '<!-- cpbase-table-end -->';

async function updateRootIndex(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  submission: SubmissionData,
  folderPath: string,
) {
  const rootReadmePath = 'README.md';
  const existing = await getFileSha(token, owner, repo, rootReadmePath, branch);
  let content = existing?.content || '';

  const p = submission.problem;
  const platformName = p.platform === 'codeforces' ? 'Codeforces' : 'TLX Toki';
  const dateStr = new Date(submission.submittedAt).toISOString().split('T')[0];
  const problemLink = `[${p.problemId} - ${p.problemTitle}](${folderPath})`;
  const newRow = `| ${platformName} | [${p.problemId}](${p.problemUrl}) | ${problemLink} | \`${submission.language}\` | ${submission.executionTime || '-'} | ${submission.memoryUsed || '-'} | ${dateStr} |`;

  if (!content.includes(TABLE_START_MARKER)) {
    content = `# Competitive Programming Solutions\n\nAutomated solution tracker powered by **[CPBase](https://github.com/)**.\n\n### Solved Problems\n\n${TABLE_START_MARKER}\n| Platform | Problem ID | Title | Language | Time | Memory | Date |\n| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n${newRow}\n${TABLE_END_MARKER}\n`;
  } else {
    const beforeTable = content.substring(0, content.indexOf(TABLE_START_MARKER) + TABLE_START_MARKER.length);
    const tableAndAfter = content.substring(content.indexOf(TABLE_START_MARKER) + TABLE_START_MARKER.length);
    const tableBody = tableAndAfter.substring(0, tableAndAfter.indexOf(TABLE_END_MARKER));
    const afterTable = tableAndAfter.substring(tableAndAfter.indexOf(TABLE_END_MARKER));

    const lines = tableBody.split('\n');
    const existingIndex = lines.findIndex((l) => l.includes(`[${p.problemId}]`));

    if (existingIndex !== -1) {
      lines[existingIndex] = newRow;
    } else {
      lines.push(newRow);
    }

    content = `${beforeTable}\n${lines.filter(Boolean).join('\n')}\n${afterTable}`;
  }

  await putFile(
    token,
    owner,
    repo,
    rootReadmePath,
    content,
    `docs(cpbase): index ${p.platform.toUpperCase()} ${p.problemId}`,
    branch,
    existing?.sha,
  );
}
