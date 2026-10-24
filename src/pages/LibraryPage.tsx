import React, { useEffect, useState } from 'react';
import { Play, Download, Edit2, Trash2, Film, RefreshCw, AlertCircle, Plus, Check, X } from 'lucide-react';
import { VideoItem } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface LibraryPageProps {
  onSelectVideoForPreview: (video: VideoItem) => void;
  onGoToUpload: () => void;
}

export const LibraryPage: React.FC<LibraryPageProps> = ({ onSelectVideoForPreview, onGoToUpload }) => {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Rename modal state
  const [renamingVideo, setRenamingVideo] = useState<VideoItem | null>(null);
  const [newName, setNewName] = useState<string>('');
  const [savingRename, setSavingRename] = useState<boolean>(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  // Delete modal state
  const [deletingVideo, setDeletingVideo] = useState<VideoItem | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Download state
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { configStatus, checkStatus } = useAuth();

  const fetchVideos = async () => {
    setLoading(true);
    setError(null);
    try {
      const status = await checkStatus();
      if (!status.configured) {
        setError('Supabase is not connected. Video library is currently unavailable.');
        setLoading(false);
        return;
      }
      const data = await api.getVideos();
      setVideos(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load video library.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handleStartRename = (video: VideoItem) => {
    setRenamingVideo(video);
    setNewName(video.name);
    setRenameError(null);
  };

  const handleSaveRename = async () => {
    if (!renamingVideo || !newName.trim()) return;
    setSavingRename(true);
    setRenameError(null);
    try {
      const updated = await api.renameVideo(renamingVideo.id, newName.trim());
      setVideos((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
      setRenamingVideo(null);
    } catch (err: any) {
      setRenameError(err.message || 'Failed to rename video.');
    } finally {
      setSavingRename(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingVideo) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteVideo(deletingVideo.id);
      setVideos((prev) => prev.filter((v) => v.id !== deletingVideo.id));
      setDeletingVideo(null);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete video.');
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async (video: VideoItem) => {
    setDownloadingId(video.id);
    try {
      const downloadUrl = await api.getSignedUrl(video.id, true);
      // Trigger download via anchor element
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = video.name;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert(err.message || 'Could not download video.');
    } finally {
      setDownloadingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="pb-24 pt-4 px-4 max-w-md mx-auto">
      {/* Header zone */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-100 tracking-tight">Video Library</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {videos.length} {videos.length === 1 ? 'video' : 'videos'} stored securely
          </p>
        </div>
        <button
          onClick={onGoToUpload}
          className="min-h-[44px] flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Upload</span>
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-900 border border-slate-800/80 rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Error state with retry */}
      {error && !loading && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="flex-1 leading-relaxed">{error}</p>
          </div>
          <button
            onClick={fetchVideos}
            className="self-start px-3 py-1.5 rounded-lg bg-rose-600/30 hover:bg-rose-600/40 text-rose-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && videos.length === 0 && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <Film className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-200">No Videos in Library</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-[240px] mx-auto">
              Upload your first MP4, MOV, or WebM video to get started.
            </p>
          </div>
          <button
            onClick={onGoToUpload}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-medium hover:from-blue-500 hover:to-purple-500 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Upload a Video</span>
          </button>
        </div>
      )}

      {/* Video List */}
      {!loading && !error && videos.length > 0 && (
        <div className="space-y-3">
          {videos.map((video) => (
            <div
              key={video.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3"
            >
              <div className="flex items-start gap-3">
                {/* Thumbnail / Video Icon */}
                <div
                  onClick={() => onSelectVideoForPreview(video)}
                  className="w-16 h-16 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 cursor-pointer relative group overflow-hidden"
                >
                  {video.preview_url ? (
                    <video
                      src={video.preview_url}
                      className="w-full h-full object-cover"
                      muted
                      preload="metadata"
                    />
                  ) : (
                    <Film className="w-6 h-6 text-slate-600" />
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
                    <Play className="w-5 h-5 text-white fill-white" />
                  </div>
                </div>

                {/* Video Info */}
                <div className="flex-1 min-w-0">
                  <h3
                    onClick={() => onSelectVideoForPreview(video)}
                    className="text-sm font-semibold text-slate-100 truncate cursor-pointer hover:text-blue-400 transition-colors"
                  >
                    {video.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                    <span>{formatDate(video.created_at)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{formatSize(video.size_bytes)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize text-slate-400 font-medium">{video.status}</span>
                  </div>
                </div>
              </div>

              {/* Actions Toolbar */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                <button
                  onClick={() => onSelectVideoForPreview(video)}
                  className="min-h-[44px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-blue-400 hover:bg-blue-500/10 transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-blue-400" />
                  <span>Preview</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleStartRename(video)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
                    title="Rename"
                    aria-label={`Rename ${video.name}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDownload(video)}
                    disabled={downloadingId === video.id}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-200 rounded-lg transition-colors disabled:opacity-50"
                    title="Download"
                    aria-label={`Download ${video.name}`}
                  >
                    {downloadingId === video.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setDeletingVideo(video);
                      setDeleteError(null);
                    }}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
                    title="Delete"
                    aria-label={`Delete ${video.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rename Modal */}
      {renamingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-100">Rename Video</h3>
            {renameError && (
              <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
                {renameError}
              </p>
            )}
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter video name"
              autoFocus
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-blue-500"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRenamingVideo(null)}
                disabled={savingRename}
                className="min-h-[44px] px-4 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRename}
                disabled={savingRename || !newName.trim()}
                className="min-h-[44px] px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {savingRename ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Save</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-100">Delete Video</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Are you sure you want to permanently delete <span className="text-slate-200 font-medium">"{deletingVideo.name}"</span>? This will remove the file from private cloud storage.
            </p>
            {deleteError && (
              <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
                {deleteError}
              </p>
            )}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingVideo(null)}
                disabled={deleting}
                className="min-h-[44px] px-4 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="min-h-[44px] px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {deleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
