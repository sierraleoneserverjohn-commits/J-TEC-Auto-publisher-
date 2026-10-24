import { Router, Request, Response } from 'express';
import { getSupabaseConfigStatus } from '../supabase.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const status = getSupabaseConfigStatus();
  const authRequired = process.env.AUTH_REQUIRED === 'true';

  res.json({
    configured: status.configured,
    missingKeys: status.missingKeys,
    authRequired,
  });
});

export default router;
