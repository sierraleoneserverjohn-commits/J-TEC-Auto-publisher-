import React, { useEffect, useState } from 'react';
import { X, AlertCircle, RefreshCw, Film } from 'lucide-react';
import { VideoItem } from '../types';
import { api } from '../services/api';

interface VideoPreviewModalProps {
  video: VideoItem | null;
  onClose: () => void;
}

export const VideoPreviewModal: React.FC<VideoPreviewModalProps> = ({ video, onClose }) => {
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!video) {
      setStreamUrl(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    // Fetch fresh short-lived signed preview URL
    api
      .getSignedUrl(video.id, false)
      .then((url) => {
        if (isMounted) {
          setStreamUrl(url);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          // Fall back to pre-fetched preview_url if available
          if (video.preview_url) {
            setStreamUrl(video.preview_url);
            setLoading(false);
          } else {
            setError(err.message || 'Failed to load video stream');
            setLoading(false);
          }
        }
      });

    return () => {
      isMounted = false;
    };
  }, [video]);

  if (!video) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2 min-w-0 pr-2">
            <Film className="w-4 h-4 text-purple-400 shrink-0" />
            <span className="text-sm font-medium text-slate-100 truncate">{video.name}</span>
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg transition-colors"
            aria-label="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Player Area */}
        <div className="relative bg-black flex items-center justify-center min-h-[240px] aspect-video">
          {loading && (
            <div className="flex flex-col items-center gap-2 text-slate-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
              <span>Loading secure preview...</span>
            </div>
          )}

          {error && (
            <div className="p-4 text-center">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
              <p className="text-xs text-rose-300 mb-3">{error}</p>
              <button
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  api
                    .getSignedUrl(video.id, false)
                    .then((url) => {
                      setStreamUrl(url);
                      setLoading(false);
                    })
                    .catch((err) => {
                      setError(err.message || 'Retry failed');
                      setLoading(false);
                    });
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs hover:bg-slate-700"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && streamUrl && (
            <video
              src={streamUrl}
              controls
              playsInline
              autoPlay
              className="w-full h-full max-h-[60vh] object-contain"
            >
              Your browser does not support HTML5 video streaming.
            </video>
          )}
        </div>

        {/* Details Footer */}
        <div className="px-4 py-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            <span>{(video.size_bytes / (1024 * 1024)).toFixed(1)} MB</span>
            <span className="mx-2 text-slate-600">·</span>
            <span className="capitalize">{video.status}</span>
          </div>
          <span className="text-[11px] text-slate-500">Short-lived signed stream</span>
        </div>
      </div>
    </div>
  );
};
