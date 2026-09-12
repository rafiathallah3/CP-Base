export type PlatformName = 'codeforces' | 'tlx';

export interface CPBaseConfig {
  githubToken: string;
  githubOwner: string;
  githubRepo: string;
  githubBranch: string;
  codeforcesHandle?: string;
  enabledPlatforms: {
    codeforces: boolean;
    tlx: boolean;
  };
  autoSync: boolean;
}

export interface ProblemDetails {
  platform: PlatformName;
  problemId: string;
  problemTitle: string;
  problemUrl: string;
  contestId?: string;
  contestTitle?: string;
  tags: string[];
  rating?: number | string;
  timeLimit?: string;
  memoryLimit?: string;
  statementMarkdown?: string;
}

export interface SubmissionData {
  platform: PlatformName;
  submissionId: string;
  problem: ProblemDetails;
  language: string;
  extension: string;
  sourceCode: string;
  verdict: string;
  executionTime?: string;
  memoryUsed?: string;
  submittedAt: number;
}

export interface SyncLog {
  id: string;
  platform: PlatformName;
  problemId: string;
  problemTitle: string;
  problemUrl: string;
  commitSha?: string;
  commitUrl?: string;
  status: 'success' | 'error' | 'syncing';
  error?: string;
  timestamp: number;
}

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string;
  html_url: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  default_branch: string;
}
