export interface VideoItem {
  id: string;
  user_id: string;
  name: string;
  storage_path: string;
  size_bytes: number;
  status: 'ready' | 'processing' | 'failed';
  created_at: string;
  preview_url?: string | null;
}

export interface UserProfile {
  id: string;
  email?: string;
  created_at?: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

export interface ConfigStatus {
  configured: boolean;
  missingKeys: string[];
  authRequired?: boolean;
}

export interface RenderStatusResponse {
  status: 'queued' | 'in_progress' | 'completed' | string | null;
  conclusion: 'success' | 'failure' | 'cancelled' | 'timed_out' | string | null;
  html_url: string | null;
  created_at: string | null;
}
