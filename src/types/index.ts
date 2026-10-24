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
}
