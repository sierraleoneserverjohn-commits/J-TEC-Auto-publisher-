# JTec AutoPublisher (Stage 1 — App Shell)

**JTec AutoPublisher** is a mobile-first web application designed for Android viewports. It provides an ultra-fast, lightweight shell for video content creators, featuring direct access, private cloud storage with short-lived signed streaming URLs, and complete video library management.

---

## What the App Does (Stage 1 Scope)

1. **Direct Access with Optional Authentication**:
   - By default, the app opens directly with **no login required** (`AUTH_REQUIRED=false`).
   - Uses a single fixed owner ID (`owner`) for all videos.
   - When `AUTH_REQUIRED=true` is enabled, email/password login is required with per-user video isolation.
2. **Video Uploading with Real Progress**:
   - Accepts only `.mp4`, `.mov`, and `.webm` files (rejects any other file type).
   - Enforces a 200 MB maximum size limit with client-side and server-side checks.
   - Shows real-time byte count and percentage upload progress (`0%` to `100%`) using standard upload stream events.
3. **Video Library Page**:
   - Lists all your stored videos with thumbnail previews, custom name, formatted upload date, file size (in MB), and status.
   - **Preview (Play)**: In-app HTML5 video playback via secure, short-lived signed URLs.
   - **Rename**: Quick video title updating.
   - **Download**: Direct file download using short-lived signed URLs with download content-disposition headers.
   - **Delete**: Permanently removes the video from both the Postgres database and private Supabase storage.
4. **Settings Page**:
   - View storage and Supabase backend status.
   - Empty **Preferences** section placeholder (ready for future stages).
5. **Real State & Security**:
   - If Supabase is not configured yet, the app opens normally and displays a dismissible warning banner at the top with a **Check connection** button.
   - Upload and Library screens display clear, friendly messages with retry buttons when disconnected.
   - Zero hardcoded credentials; all keys reside in server-side secrets.
   - Videos are kept in **private** cloud storage accessible only via short-lived signed URLs.

---

## Required Environment Variables

Configure these variables in **Settings > Secrets** (or in a `.env` file for local development):

| Variable | Default | Description |
| :--- | :--- | :--- |
| `AUTH_REQUIRED` | `"false"` | When `"false"`, bypasses login and uses single-owner mode. Set to `"true"` to require email/password login. |
| `SUPABASE_URL` | *Required* | Your Supabase project URL (e.g., `https://xyzproject.supabase.co`) |
| `SUPABASE_ANON_KEY` | *Required* | Your Supabase project public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | *Required* | Your Supabase service role secret key (used server-side for signed URLs and private storage) |
| `PORT` | `3000` | Optional server port |

---

## Supabase Setup SQL

Copy and paste the SQL script below into the **SQL Editor** in your [Supabase Dashboard](https://supabase.com/dashboard) and run it.

> Note: `user_id` is defined as a plain `TEXT` column without a foreign key constraint to `auth.users`, ensuring the single-owner mode (`user_id = 'owner'`) functions properly without login.

```sql
-- ========================================================
-- 1. Create the 'videos' Table
-- ========================================================
CREATE TABLE IF NOT EXISTS public.videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL, -- Plain text column supporting both single-owner mode ('owner') and auth user IDs
    name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ready',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON public.videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON public.videos(created_at DESC);

-- ========================================================
-- 2. Create Private Storage Bucket 'videos'
-- ========================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'videos',
    'videos',
    false, -- Private bucket! Videos can only be accessed via signed URLs
    209715200, -- 200 MB maximum file size limit in bytes
    ARRAY['video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 209715200,
    allowed_mime_types = ARRAY['video/mp4', 'video/quicktime', 'video/webm'];

-- ========================================================
-- 3. Row Level Security (RLS) Notes
-- ========================================================
-- When AUTH_REQUIRED is false (default):
-- Operations are performed by the backend service role key, bypassing RLS.
--
-- When you enable AUTH_REQUIRED="true" and want strict per-user RLS in Supabase,
-- you can enable RLS on the table and bucket with the following policies:
--
-- ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "Users can view own videos"
--     ON public.videos FOR SELECT TO authenticated
--     USING (auth.uid()::text = user_id);
--
-- CREATE POLICY "Users can insert own videos"
--     ON public.videos FOR INSERT TO authenticated
--     WITH CHECK (auth.uid()::text = user_id);
--
-- CREATE POLICY "Users can update own videos"
--     ON public.videos FOR UPDATE TO authenticated
--     USING (auth.uid()::text = user_id)
--     WITH CHECK (auth.uid()::text = user_id);
--
-- CREATE POLICY "Users can delete own videos"
--     ON public.videos FOR DELETE TO authenticated
--     USING (auth.uid()::text = user_id);
--
-- CREATE POLICY "Users can access own storage videos"
--     ON storage.objects FOR ALL TO authenticated
--     USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text)
--     WITH CHECK (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text);
```
