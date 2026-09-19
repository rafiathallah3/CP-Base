import { browser } from 'wxt/browser';
import { getConfig, addSyncLog, updateSyncLog, isSubmissionSynced, markSubmissionSynced } from '@/lib/storage';
import { syncSolutionToGitHub } from '@/lib/github';
import type { SubmissionData, SyncLog } from '@/lib/types';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: any, _sender, sendResponse) => {
    if (message?.type === 'SYNC_SUBMISSION') {
      const submission: SubmissionData = message.payload;
      tanganiSinkronisasiSubmission(submission)
        .then((hasil) => sendResponse(hasil))
        .catch((kesalahan) => sendResponse({ ok: false, error: kesalahan.message }));
      return true;
    }

    if (message?.type === 'GET_CONFIG') {
      getConfig().then((config) => sendResponse(config));
      return true;
    }

    if (message?.type === 'IS_SUBMISSION_SYNCED') {
      isSubmissionSynced(message.payload.platform, message.payload.submissionId)
        .then((synced) => sendResponse({ synced }))
        .catch(() => sendResponse({ synced: false }));
      return true;
    }

    if (message?.type === 'MARK_SUBMISSION_SYNCED') {
      markSubmissionSynced(message.payload.platform, message.payload.submissionId)
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: false }));
      return true;
    }
  });
});

async function tanganiSinkronisasiSubmission(
  submission: SubmissionData,
): Promise<{ ok: boolean; commitUrl?: string; error?: string }> {
  const config = await getConfig();

  if (!config.githubToken || !config.githubRepo || !config.githubOwner) {
    throw new Error('GitHub PAT or repository not configured in CPBase settings.');
  }

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
    const hasil = await syncSolutionToGitHub(
      config.githubToken,
      config.githubOwner,
      config.githubRepo,
      config.githubBranch || 'main',
      submission,
    );

    await updateSyncLog(logId, {
      status: 'success',
      commitSha: hasil.commitSha,
      commitUrl: hasil.commitUrl,
    });

    if (submission.submissionId) {
      await markSubmissionSynced(submission.platform, submission.submissionId);
    }

    try {
      await browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('/icon/128.png'),
        title: 'CPBase Sync Success',
        message: `Successfully committed ${submission.problem.problemId} - ${submission.problem.problemTitle} to ${config.githubRepo}!`,
      });
    } catch {}

    return { ok: true, commitUrl: hasil.commitUrl };
  } catch (err: any) {
    const pesanKesalahan = err?.message || 'Unknown GitHub commit error';
    await updateSyncLog(logId, {
      status: 'error',
      error: pesanKesalahan,
    });
    return { ok: false, error: pesanKesalahan };
  }
}
