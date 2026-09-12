import { browser } from 'wxt/browser';
import { getConfig, addSyncLog, updateSyncLog } from '@/lib/storage';
import { syncSolutionToGitHub } from '@/lib/github';
import type { SubmissionData, SyncLog } from '@/lib/types';

export default defineBackground(() => {
  console.log('[CPBase] Background service worker/script initialized.');

  browser.runtime.onMessage.addListener((message: any, _sender, sendResponse) => {
    if (message?.type === 'SYNC_SUBMISSION') {
      const submission: SubmissionData = message.payload;
      handleSyncSubmission(submission)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ ok: false, error: error.message }));
      return true; // async response
    }

    if (message?.type === 'GET_CONFIG') {
      getConfig().then((config) => sendResponse(config));
      return true;
    }
  });
});

async function handleSyncSubmission(
  submission: SubmissionData,
): Promise<{ ok: boolean; commitUrl?: string; error?: string }> {
  const config = await getConfig();

  if (!config.githubToken || !config.githubRepo || !config.githubOwner) {
    throw new Error('GitHub PAT or repository not configured in CPBase settings.');
  }

  // Check if platform is enabled
  if (config.enabledPlatforms[submission.platform] === false) {
    return { ok: false, error: `Platform ${submission.platform} is disabled in CPBase settings.` };
  }

  const logId = `${submission.platform}-${submission.submissionId || Date.now()}`;
  const log: SyncLog = {
    id: logId,
    platform: submission.platform,
    problemId: submission.problem.problemId,
    problemTitle: submission.problem.problemTitle,
    problemUrl: submission.problem.problemUrl,
    status: 'syncing',
    timestamp: Date.now(),
  };

  await addSyncLog(log);

  try {
    const result = await syncSolutionToGitHub(
      config.githubToken,
      config.githubOwner,
      config.githubRepo,
      config.githubBranch || 'main',
      submission,
    );

    await updateSyncLog(logId, {
      status: 'success',
      commitSha: result.commitSha,
      commitUrl: result.commitUrl,
    });

    // Notify user
    try {
      await browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('/icon/128.png'),
        title: 'CPBase Sync Success',
        message: `Successfully committed ${submission.problem.problemId} - ${submission.problem.problemTitle} to ${config.githubRepo}!`,
      });
    } catch {
      // notifications permission optional
    }

    return { ok: true, commitUrl: result.commitUrl };
  } catch (err: any) {
    const errorMsg = err?.message || 'Unknown GitHub commit error';
    await updateSyncLog(logId, {
      status: 'error',
      error: errorMsg,
    });
    return { ok: false, error: errorMsg };
  }
}
