import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { getSupabaseAdminClient, getSupabaseClient, getSupabaseConfigStatus } from '../supabase.js';

const router = Router();

// Ensure temporary uploads directory exists
const tempUploadDir = path.join(process.cwd(), '.tmp_uploads');
if (!fs.existsSync(tempUploadDir)) {
  fs.mkdirSync(tempUploadDir, { recursive: true });
}

// Multer storage engine saving to temp directory
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, tempUploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${randomUUID()}${ext}`);
  },
});

// File validation filter: MP4, MOV, WebM only
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.mp4', '.mov', '.webm'];

  if (!allowedExtensions.includes(ext) || !allowedMimeTypes.includes(file.mimetype)) {
    cb(new Error('INVALID_FORMAT'));
    return;
  }

  cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200 MB
  },
  fileFilter,
});

const BUCKET_NAME = 'videos';

// Ensure bucket exists helper
async function ensureBucketExists() {
  const admin = getSupabaseAdminClient();
  if (!admin) return;
  try {
    const { data: buckets } = await admin.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === BUCKET_NAME);
    if (!exists) {
      await admin.storage.createBucket(BUCKET_NAME, {
        public: false,
        fileSizeLimit: 200 * 1024 * 1024,
        allowedMimeTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
      });
    }
  } catch (err) {
    // Ignore if permission or already created
  }
}

// 1. Upload Video
router.post(
  '/upload',
  requireAuth,
  (req, res, next) => {
    upload.single('video')(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            error: 'File size exceeds the 200 MB maximum limit.',
          });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      } else if (err) {
        if (err.message === 'INVALID_FORMAT') {
          return res.status(400).json({
            error: 'Invalid file format. Only MP4, MOV, and WebM videos are supported.',
          });
        }
        return res.status(400).json({ error: err.message || 'File upload error.' });
      }
      next();
    });
  },
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const status = getSupabaseConfigStatus();
    if (!status.configured) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(503).json({
        error: 'Supabase is not configured yet. Please configure credentials in Settings > Secrets.',
        missingKeys: status.missingKeys,
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No video file provided for upload.' });
      return;
    }

    const tempFilePath = req.file.path;
    const originalName = req.body.name?.trim() || req.file.originalname;
    const userId = req.user!.id;
    const ext = path.extname(req.file.originalname).toLowerCase();
    const storagePath = `${userId}/${Date.now()}-${randomUUID()}${ext}`;

    const admin = getSupabaseAdminClient() || getSupabaseClient();
    if (!admin) {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      res.status(500).json({ error: 'Supabase connection is not available.' });
      return;
    }

    try {
      await ensureBucketExists();

      // Read file buffer
      const fileBuffer = await fs.promises.readFile(tempFilePath);

      // Upload to private Supabase storage
      const { error: storageError } = await admin.storage
        .from(BUCKET_NAME)
        .upload(storagePath, fileBuffer, {
          contentType: req.file.mimetype,
          upsert: false,
        });

      if (storageError) {
        throw new Error(`Storage upload failed: ${storageError.message}`);
      }

      // Insert record into PostgreSQL 'videos' table
      const newVideoRecord = {
        id: randomUUID(),
        user_id: userId,
        name: originalName,
        storage_path: storagePath,
        size_bytes: req.file.size,
        status: 'ready',
        created_at: new Date().toISOString(),
      };

      const { data: dbData, error: dbError } = await admin
        .from('videos')
        .insert(newVideoRecord)
        .select()
        .single();

      if (dbError) {
        // Rollback storage if DB insert fails
        await admin.storage.from(BUCKET_NAME).remove([storagePath]);
        throw new Error(`Database error saving video record: ${dbError.message}`);
      }

      // Generate a short-lived preview signed URL (valid 1 hour)
      const { data: signedData } = await admin.storage
        .from(BUCKET_NAME)
        .createSignedUrl(storagePath, 3600);

      res.status(201).json({
        video: {
          ...dbData,
          preview_url: signedData?.signedUrl || null,
        },
      });
    } catch (err: any) {
      res.status(500).json({
        error: err.message || 'Failed to process and store video.',
      });
    } finally {
      // Always cleanup temp disk file
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch {}
      }
    }
  }
);

// 2. List Videos for Authenticated User
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const status = getSupabaseConfigStatus();
  if (!status.configured) {
    res.status(503).json({
      error: 'Supabase is not configured yet.',
      missingKeys: status.missingKeys,
    });
    return;
  }

  const userId = req.user!.id;
  const admin = getSupabaseAdminClient() || getSupabaseClient();
  if (!admin) {
    res.status(500).json({ error: 'Supabase connection is not available.' });
    return;
  }

  try {
    const { data: videos, error } = await admin
      .from('videos')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Generate short-lived preview signed URLs for each video
    const videosWithSignedUrls = await Promise.all(
      (videos || []).map(async (v) => {
        try {
          const { data: signedData } = await admin.storage
            .from(BUCKET_NAME)
            .createSignedUrl(v.storage_path, 3600);
          return {
            ...v,
            preview_url: signedData?.signedUrl || null,
          };
        } catch {
          return {
            ...v,
            preview_url: null,
          };
        }
      })
    );

    res.json({ videos: videosWithSignedUrls });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch videos from library.' });
  }
});

// 3. Get Short-Lived Signed URL for Preview or Download
router.get('/:id/signed-url', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const isDownload = req.query.download === 'true';
  const userId = req.user!.id;

  const admin = getSupabaseAdminClient() || getSupabaseClient();
  if (!admin) {
    res.status(500).json({ error: 'Supabase connection is not available.' });
    return;
  }

  try {
    const { data: video, error } = await admin
      .from('videos')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !video) {
      res.status(404).json({ error: 'Video not found or access denied.' });
      return;
    }

    // Short-lived: 5 minutes for download, 1 hour for preview
    const expiresIn = isDownload ? 300 : 3600;
    const { data: signedData, error: signError } = await admin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(video.storage_path, expiresIn, {
        download: isDownload ? video.name : undefined,
      });

    if (signError || !signedData?.signedUrl) {
      throw new Error(signError?.message || 'Could not generate signed URL.');
    }

    res.json({ url: signedData.signedUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate signed URL.' });
  }
});

// 4. Rename Video
router.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name } = req.body;
  const userId = req.user!.id;

  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Video name cannot be empty.' });
    return;
  }

  const admin = getSupabaseAdminClient() || getSupabaseClient();
  if (!admin) {
    res.status(500).json({ error: 'Supabase connection is not available.' });
    return;
  }

  try {
    const { data: updatedVideo, error } = await admin
      .from('videos')
      .update({ name: name.trim() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !updatedVideo) {
      res.status(404).json({ error: 'Video not found or rename failed.' });
      return;
    }

    // Attach signed preview url
    const { data: signedData } = await admin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(updatedVideo.storage_path, 3600);

    res.json({
      video: {
        ...updatedVideo,
        preview_url: signedData?.signedUrl || null,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to rename video.' });
  }
});

// 5. Delete Video (Deletes from private storage and DB)
router.delete('/:id', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const userId = req.user!.id;

  const admin = getSupabaseAdminClient() || getSupabaseClient();
  if (!admin) {
    res.status(500).json({ error: 'Supabase connection is not available.' });
    return;
  }

  try {
    // 1. Find record to get storage_path
    const { data: video, error: findError } = await admin
      .from('videos')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (findError || !video) {
      res.status(404).json({ error: 'Video not found or access denied.' });
      return;
    }

    // 2. Delete from private Supabase Storage
    if (video.storage_path) {
      await admin.storage.from(BUCKET_NAME).remove([video.storage_path]);
    }

    // 3. Delete from DB
    const { error: deleteError } = await admin
      .from('videos')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (deleteError) {
      throw deleteError;
    }

    res.json({ success: true, message: 'Video deleted successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete video.' });
  }
});

export default router;
