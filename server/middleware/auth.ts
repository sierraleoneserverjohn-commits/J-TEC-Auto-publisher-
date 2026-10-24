import { Request, Response, NextFunction } from 'express';
import { verifyAuthToken } from '../supabase.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    [key: string]: any;
  };
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
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
