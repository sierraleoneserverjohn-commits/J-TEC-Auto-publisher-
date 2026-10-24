# JTec AutoPublisher (Stage 1 — App Shell)

**JTec AutoPublisher** is a mobile-first web application designed for Android viewports. It provides an ultra-fast, lightweight shell for video content creators, featuring user authentication, private cloud storage with short-lived signed streaming URLs, and complete video library management.

---

## What the App Does (Stage 1 Scope)

1. **Email & Password Authentication**: Full sign-up, sign-in, and sign-out flows powered by Supabase Auth with secure session tokens.
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
   - View account details and active connection state.
   - Empty **Preferences** section placeholder (ready for future stages).
   - Log out action.
5. **Real State & Security**:
   - Shows a clear **"Supabase Not Connected"** screen if required secrets are not present.
   - Zero hardcoded credentials; all secrets live on the server.
   - Private Supabase storage bucket with short-lived signed URLs.
   - Row-Level Security (RLS) ensuring each user can only ever access their own videos.

---

## Required Environment Variables

Configure these variables in **Settings > Secrets** (or in a `.env` file for local development):

| Variable | Description |
| :--- | :--- |
| `SUPABASE_URL` | Your Supabase project URL (e.g., `https://xyzproject.supabase.co`) |
| `SUPABASE_ANON_KEY` | Your Supabase project public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role secret key (used server-side for signed URLs and private storage) |
| `PORT` | Optional server port (defaults to `3000`) |

---

## Supabase Setup SQL

Copy and paste the SQL script below into the **SQL Editor** in your [Supabase Dashboard](https://supabase.com/dashboard) and run it:

```sql
-- ========================================================
-- 1. Create the 'videos' Table
-- ========================================================
CREATE TABLE IF NOT EXISTS public.videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ready',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast user queries
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON public.videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON public.videos(created_at DESC);

-- ========================================================
-- 2. Enable Row Level Security (RLS) on 'videos'
-- ========================================================
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- Allow users to view only their own videos
CREATE POLICY "Users can view own videos"
    ON public.videos
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Allow users to insert their own videos
CREATE POLICY "Users can insert own videos"
    ON public.videos
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own videos (e.g. rename)
CREATE POLICY "Users can update own videos"
    ON public.videos
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own videos
CREATE POLICY "Users can delete own videos"
    ON public.videos
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- ========================================================
-- 3. Create Private Storage Bucket 'videos'
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
-- 4. Enable Row Level Security on Storage Objects
-- ========================================================
-- Allow authenticated users to upload to their own user folder: <user_id>/...
CREATE POLICY "Users can upload own storage videos"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'videos'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Allow authenticated users to access their own files in the bucket
CREATE POLICY "Users can access own storage videos"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'videos'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Allow authenticated users to update their own files in the bucket
CREATE POLICY "Users can update own storage videos"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
        bucket_id = 'videos'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Allow authenticated users to delete their own files from the bucket
CREATE POLICY "Users can delete own storage videos"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'videos'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
```
