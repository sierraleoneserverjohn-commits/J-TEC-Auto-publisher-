import React, { useState, useEffect, useRef } from 'react';
import { X, Type, RefreshCw, CheckCircle2, AlertCircle, ExternalLink, Clapperboard } from 'lucide-react';
import { VideoItem, RenderStatusResponse } from '../types';
import { api } from '../services/api';

interface RenderCaptionModalProps {
  video: VideoItem;
  onClose: () => void;
  onRefreshLibrary: () => void;
}

type PanelState = 'idle' | 'dispatching' | 'polling' | 'completed' | 'error';

export const RenderCaptionModal: React.FC<RenderCaptionModalProps> = ({
  video,
  onClose,
  onRefreshLibrary,
}) => {
  const [caption, setCaption] = useState('');
  const [panelState, setPanelState] = useState<PanelState>('idle');
  const [runStatus, setRunStatus] = useState<RenderStatusResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearPolling();
    };
  }, []);

  const pollStatus = async () => {
    try {
      const statusData = await api.getRenderStatus();
      setRunStatus(statusData);

      if (statusData.status === 'completed') {
        clearPolling();
        if (statusData.conclusion === 'success') {
          setPanelState('completed');
        } else {
          setPanelState('error');
          setErrorMessage(
            `Render workflow completed with status "${statusData.conclusion || 'failed'}".`
          );
        }
      } else if (statusData.status === 'in_progress' || statusData.status === 'queued') {
        setPanelState('polling');
      }
    } catch (err: any) {
      clearPolling();
      setPanelState('error');
      setErrorMessage(err.message || 'Failed to poll render status from server.');
    }
  };

  const handleStartRender = async () => {
    const trimmed = caption.trim();
    if (!trimmed) {
      setErrorMessage('Please enter a caption for the video.');
      return;
    }

    if (trimmed.length > 200) {
      setErrorMessage('Caption cannot exceed 200 characters.');
      return;
    }

    setErrorMessage(null);
    setPanelState('dispatching');
    clearPolling();

    try {
      await api.renderWithCaption(video.id, trimmed);
      setPanelState('polling');

      // Immediate first check
      await pollStatus();

      // Poll every 5 seconds
      pollTimerRef.current = setInterval(pollStatus, 5000);
    } catch (err: any) {
      setPanelState('error');
      setErrorMessage(err.message || 'Failed to trigger render workflow.');
    }
  };

  const handleRefreshAndClose = () => {
    onRefreshLibrary();
    onClose();
  };

  const getStatusLabel = () => {
    if (panelState === 'dispatching') {
      return 'Dispatching job...';
    }
    if (runStatus?.status === 'queued') {
      return 'queued';
    }
    if (runStatus?.status === 'in_progress') {
      return 'in progress';
    }
    if (runStatus?.status === 'completed') {
      return runStatus.conclusion === 'success' ? 'completed (success)' : `completed (${runStatus.conclusion || 'failed'})`;
    }
    return runStatus?.status || 'processing';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <Clapperboard className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-100 truncate">Render with Caption</h3>
              <p className="text-xs text-slate-400 truncate">{video.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg transition-colors"
            aria-label="Close panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Note Banner */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs text-slate-400 leading-relaxed">
            <span className="text-slate-300 font-medium">Note:</span> Original video is not changed. Output is re-encoded at high quality, so it is not lossless.
          </div>

          {/* Form area when idle */}
          {panelState === 'idle' && (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="caption-input" className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-purple-400" />
                    <span>Overlay Caption</span>
                  </label>
                  <span className={`text-[11px] font-mono ${caption.length > 200 ? 'text-rose-400' : 'text-slate-500'}`}>
                    {caption.length}/200
                  </span>
                </div>
                <textarea
                  id="caption-input"
                  rows={3}
                  maxLength={200}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Enter text to overlay on the video..."
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm placeholder:text-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none"
                />
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="flex-1 leading-relaxed">{errorMessage}</p>
                </div>
              )}
            </div>
          )}

          {/* Real Status Display during Polling or Dispatching */}
          {(panelState === 'dispatching' || panelState === 'polling') && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Rendering Status</span>
                <span className="flex items-center gap-2 text-xs font-medium text-purple-300 capitalize">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" />
                  <span>{getStatusLabel()}</span>
                </span>
              </div>

              <div className="text-xs text-slate-400 space-y-1">
                <p>
                  Caption: <span className="text-slate-200">"{caption}"</span>
                </p>
                <p className="text-[11px] text-slate-500">
                  Polling real job status from GitHub Actions every 5 seconds...
                </p>
              </div>

              {runStatus?.html_url && (
                <a
                  href={runStatus.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <span>View workflow logs</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          {/* Success State */}
          {panelState === 'completed' && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-100">Render Completed</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Status: <span className="text-emerald-400 font-medium">completed (success)</span>
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  The rendered video will appear in your library.
                </p>
              </div>

              <button
                onClick={handleRefreshAndClose}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium text-xs hover:from-blue-500 hover:to-purple-500 transition-colors shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh library</span>
              </button>
            </div>
          )}

          {/* Error State */}
          {panelState === 'error' && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-2.5 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <p className="font-semibold text-rose-200">Render Failed</p>
                  <p className="leading-relaxed text-rose-300">{errorMessage}</p>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPanelState('idle');
                    setErrorMessage(null);
                  }}
                  className="min-h-[44px] px-3.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-800"
                >
                  Edit Caption
                </button>
                <button
                  type="button"
                  onClick={handleStartRender}
                  className="min-h-[44px] px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls when idle */}
        {panelState === 'idle' && (
          <div className="px-4 py-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleStartRender}
              disabled={!caption.trim() || caption.trim().length > 200}
              className="min-h-[44px] px-5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 active:scale-[0.99] text-white font-medium text-xs flex items-center gap-1.5 transition-transform disabled:opacity-50 shadow-sm"
            >
              <span>Render</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
