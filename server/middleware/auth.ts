import { Request, Response, NextFunction } from 'express';
import { verifyAuthToken } from '../supabase.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    [key: string]: any;
  };
}

export const FIXED_OWNER_ID = 'owner';

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const isAuthRequired = process.env.AUTH_REQUIRED === 'true';

  // When AUTH_REQUIRED is false (default), do not require token and use single fixed owner id
  if (!isAuthRequired) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) {
        try {
          const user = await verifyAuthToken(token);
          req.user = user;
          next();
          return;
        } catch {
          // Token invalid or Supabase unconfigured, fall through safely to owner
        }
      }
    }

    req.user = {
      id: FIXED_OWNER_ID,
      email: 'owner@local',
    };
    next();
    return;
  }

  // When AUTH_REQUIRED is true: strict check
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'Missing access token.' });
    return;
  }

  try {
    const user = await verifyAuthToken(token);
    req.user = user;
    next();
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'Authentication failed. Please log in again.' });
  }
}
