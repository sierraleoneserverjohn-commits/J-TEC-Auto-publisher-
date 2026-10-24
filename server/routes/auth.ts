import { Router, Request, Response } from 'express';
import { getSupabaseClient, getSupabaseConfigStatus } from '../supabase.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

// Sign Up
router.post('/signup', async (req: Request, res: Response): Promise<void> => {
  const status = getSupabaseConfigStatus();
  if (!status.configured) {
    res.status(503).json({
      error: 'Supabase is not configured yet. Please set the required credentials in Settings > Secrets.',
      missingKeys: status.missingKeys,
    });
    return;
  }

  const { email, password } = req.body;
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: 'Please provide a valid email address.' });
    return;
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' });
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    res.status(500).json({ error: 'Supabase client could not be initialized.' });
    return;
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      user: data.user,
      session: data.session,
      message: data.session
        ? 'Account created successfully!'
        : 'Account created! Please check your email to confirm registration or sign in.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'An unexpected error occurred during signup.' });
  }
});

// Log In
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const status = getSupabaseConfigStatus();
  if (!status.configured) {
    res.status(503).json({
      error: 'Supabase is not configured yet. Please set the required credentials in Settings > Secrets.',
      missingKeys: status.missingKeys,
    });
    return;
  }

  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    res.status(500).json({ error: 'Supabase client could not be initialized.' });
    return;
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      res.status(401).json({ error: error.message });
      return;
    }

    res.json({
      user: data.user,
      session: data.session,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'An unexpected error occurred during login.' });
  }
});

// Log Out
router.post('/logout', requireAuth, async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  res.json({ success: true, message: 'Logged out successfully' });
});

// Get Current User Profile
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  res.json({ user: req.user });
});

export default router;
