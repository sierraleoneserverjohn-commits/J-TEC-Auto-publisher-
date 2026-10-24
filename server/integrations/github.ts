export interface GitHubConfigStatus {
  configured: boolean;
  missing: string[];
}

export interface WorkflowRunStatus {
  status: string | null;
  conclusion: string | null;
  html_url: string | null;
  created_at: string | null;
}

export function getGitHubConfig(): { token: string; repo: string; ref: string } | null {
  const token = process.env.GITHUB_TOKEN?.trim();
  const repo = process.env.GITHUB_REPO?.trim();
  const ref = process.env.GITHUB_REF?.trim();

  if (!token || !repo || !ref) {
    return null;
  }

  return { token, repo, ref };
}

export function getGitHubConfigStatus(): GitHubConfigStatus {
  const missing: string[] = [];
  if (!process.env.GITHUB_TOKEN?.trim()) missing.push('GITHUB_TOKEN');
  if (!process.env.GITHUB_REPO?.trim()) missing.push('GITHUB_REPO');
  if (!process.env.GITHUB_REF?.trim()) missing.push('GITHUB_REF');

  return {
    configured: missing.length === 0,
    missing,
  };
}

export async function getLatestWorkflowRun(): Promise<WorkflowRunStatus | null> {
  const config = getGitHubConfig();
  if (!config) {
    throw new Error('GitHub rendering is not configured. GITHUB_TOKEN, GITHUB_REPO, and GITHUB_REF are required.');
  }

  const url = `https://api.github.com/repos/${config.repo}/actions/workflows/ffmpeg-caption.yml/runs?per_page=1`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'JTec-AutoPublisher',
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || response.statusText;
    throw new Error(`GitHub API error (${response.status}): ${message}`);
  }

  const data = await response.json();
  const latestRun = data.workflow_runs?.[0];

  if (!latestRun) {
    return null;
  }

  return {
    status: latestRun.status,
    conclusion: latestRun.conclusion,
    html_url: latestRun.html_url,
    created_at: latestRun.created_at,
  };
}

export async function triggerCaptionWorkflow(storagePath: string, caption: string): Promise<void> {
  const config = getGitHubConfig();
  if (!config) {
    throw new Error('GitHub rendering is not configured. GITHUB_TOKEN, GITHUB_REPO, and GITHUB_REF are required.');
  }

  // 1. Refuse to start if latest workflow run is still queued or in progress
  const latestRun = await getLatestWorkflowRun().catch((err) => {
    // If it's a 404 (e.g. workflow has never run yet), we allow dispatching
    if (err.message.includes('404')) {
      return null;
    }
    throw err;
  });

  if (latestRun && (latestRun.status === 'queued' || latestRun.status === 'in_progress')) {
    throw new Error(`A render workflow is already ${latestRun.status.replace('_', ' ')}. Please wait for it to complete.`);
  }

  // 2. Dispatch workflow run
  const dispatchUrl = `https://api.github.com/repos/${config.repo}/actions/workflows/ffmpeg-caption.yml/dispatches`;

  const response = await fetch(dispatchUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'JTec-AutoPublisher',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ref: config.ref,
      inputs: {
        storage_path: storagePath,
        caption: caption,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.message || response.statusText;
    throw new Error(`GitHub rejected workflow dispatch (${response.status}): ${message}`);
  }
}
