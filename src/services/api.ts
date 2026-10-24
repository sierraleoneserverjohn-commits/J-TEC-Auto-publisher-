import { ConfigStatus, RenderStatusResponse, UserProfile, VideoItem } from '../types';

const TOKEN_KEY = 'jtec_auth_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {}
}

function getAuthHeaders(): HeadersInit {
  const token = getStoredToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  // 1. Connection Status
  async getStatus(): Promise<ConfigStatus> {
    const res = await fetch('/api/status');
    if (!res.ok) {
      throw new Error(`Failed to check configuration status: ${res.statusText}`);
    }
    return res.json();
  },

  // 2. Authentication
  async signup(email: string, password: string): Promise<{ user: UserProfile; session?: { access_token: string }; message?: string }> {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Signup failed');
    }
    if (data.session?.access_token) {
      setStoredToken(data.session.access_token);
    }
    return data;
  },

  async login(email: string, password: string): Promise<{ user: UserProfile; session: { access_token: string } }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }
    if (data.session?.access_token) {
      setStoredToken(data.session.access_token);
    }
    return data;
  },

  async getMe(): Promise<UserProfile> {
    const res = await fetch('/api/auth/me', {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to authenticate session');
    }
    return data.user;
  },

  async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
    } catch {}
    setStoredToken(null);
  },

  // 3. Videos
  async getVideos(): Promise<VideoItem[]> {
    const res = await fetch('/api/videos', {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to fetch videos');
    }
    return data.videos || [];
  },

  // Upload with real XHR progress
  uploadVideo(
    file: File,
    name: string,
    onProgress: (percent: number, loaded: number, total: number) => void
  ): Promise<VideoItem> {
    return new Promise((resolve, reject) => {
      const token = getStoredToken();

      const formData = new FormData();
      formData.append('video', file);
      if (name) {
        formData.append('name', name);
      }

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/videos/upload');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent, e.loaded, e.total);
        }
      });

      xhr.addEventListener('load', () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(data.video);
          } else {
            reject(new Error(data.error || `Upload failed with HTTP ${xhr.status}`));
          }
        } catch {
          reject(new Error(`Server returned unexpected response (status ${xhr.status})`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error occurred while uploading. Please check your connection and retry.'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload was cancelled.'));
      });

      xhr.send(formData);
    });
  },

  async getSignedUrl(id: string, isDownload: boolean = false): Promise<string> {
    const res = await fetch(`/api/videos/${id}/signed-url?download=${isDownload}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to generate signed URL');
    }
    return data.url;
  },

  async renameVideo(id: string, newName: string): Promise<VideoItem> {
    const res = await fetch(`/api/videos/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name: newName }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to rename video');
    }
    return data.video;
  },

  async deleteVideo(id: string): Promise<void> {
    const res = await fetch(`/api/videos/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to delete video');
    }
  },

  // 4. Render with Caption
  async renderWithCaption(videoId: string, caption: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/render/caption', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ videoId, caption }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to start render workflow');
    }
    return data;
  },

  async getRenderStatus(): Promise<RenderStatusResponse> {
    const res = await fetch('/api/render/status', {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to fetch render status');
    }
    return data;
  },
};
