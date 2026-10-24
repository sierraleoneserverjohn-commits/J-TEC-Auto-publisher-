import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { getSupabaseAdminClient, getSupabaseClient, getSupabaseConfigStatus } from '../supabase.js';
import {
  getGitHubConfigStatus,
  getLatestWorkflowRun,
  triggerRenderWorkflow,
} from '../integrations/github.js';
import { validateAndSanitizePlan, RenderPlan } from '../../shared/plan.js';

const router = Router();

// 1. Trigger Render with Plan or Caption
router.post('/caption', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // Check GitHub configuration
  const githubStatus = getGitHubConfigStatus();
  if (!githubStatus.configured) {
    res.status(503).json({
      error: `GitHub rendering is not configured. Missing server secrets: ${githubStatus.missing.join(', ')}.`,
      missingKeys: githubStatus.missing,
    });
    return;
  }

  // Check Supabase configuration
  const supabaseStatus = getSupabaseConfigStatus();
  if (!supabaseStatus.configured) {
    res.status(503).json({
      error: 'Supabase is not configured yet. Database access is required.',
      missingKeys: supabaseStatus.missingKeys,
    });
    return;
  }

  const { videoId, plan, caption } = req.body;

  if (!videoId || typeof videoId !== 'string') {
    res.status(400).json({ error: 'videoId is required.' });
    return;
  }

  let validatedPlan: RenderPlan | null = null;
  let trimmedCaption: string | null = null;

  if (plan !== undefined) {
    try {
      validatedPlan = validateAndSanitizePlan(plan);
    } catch (err: any) {
      res.status(400).json({ error: `Invalid render plan: ${err.message}` });
      return;
    }
  } else if (caption !== undefined) {
    if (typeof caption !== 'string' || !caption.trim()) {
      res.status(400).json({ error: 'Caption is required when no plan is provided.' });
      return;
    }
    trimmedCaption = caption.trim();
    if (trimmedCaption.length > 200) {
      res.status(400).json({ error: 'Caption must be 200 characters or less.' });
      return;
    }
  } else {
    res.status(400).json({ error: 'Either plan or caption is required.' });
    return;
  }

  const userId = req.user!.id;
  const admin = getSupabaseAdminClient() || getSupabaseClient();
  if (!admin) {
    res.status(500).json({ error: 'Database client could not be initialized.' });
    return;
  }

  try {
    // Look up video in the 'videos' table by videoId AND user_id
    const { data: video, error: dbError } = await admin
      .from('videos')
      .select('*')
      .eq('id', videoId)
      .eq('user_id', userId)
      .single();

    if (dbError || !video) {
      res.status(404).json({ error: 'Video not found or access denied.' });
      return;
    }

    if (!video.storage_path) {
      res.status(400).json({ error: 'Video record has no valid storage path.' });
      return;
    }

    // Call GitHub Actions workflow with storage_path and plan (or caption fallback)
    if (validatedPlan) {
      await triggerRenderWorkflow(video.storage_path, { plan: validatedPlan });
    } else {
      await triggerRenderWorkflow(video.storage_path, { caption: trimmedCaption! });
    }

    res.json({
      success: true,
      message: 'Render workflow dispatched successfully.',
    });
  } catch (err: any) {
    res.status(500).json({
      error: err.message || 'Failed to dispatch render job.',
    });
  }
});

// 2. Poll Render Status
router.get('/status', requireAuth, async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const githubStatus = getGitHubConfigStatus();
  if (!githubStatus.configured) {
    res.status(503).json({
      error: `GitHub rendering is not configured. Missing server secrets: ${githubStatus.missing.join(', ')}.`,
      missingKeys: githubStatus.missing,
    });
    return;
  }

  try {
    const run = await getLatestWorkflowRun();
    if (!run) {
      res.json({
        status: null,
        conclusion: null,
        html_url: null,
        created_at: null,
      });
      return;
    }

    res.json(run);
  } catch (err: any) {
    res.status(500).json({
      error: err.message || 'Failed to retrieve workflow status from GitHub.',
    });
  }
});

export default router;
