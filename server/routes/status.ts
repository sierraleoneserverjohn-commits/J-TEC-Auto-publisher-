import { Router, Request, Response } from 'express';
import { getSupabaseConfigStatus } from '../supabase.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  const status = getSupabaseConfigStatus();
  res.json({
    configured: status.configured,
    missingKeys: status.missingKeys,
  });
});

export default router;
