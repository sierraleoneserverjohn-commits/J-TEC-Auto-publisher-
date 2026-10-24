import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Clapperboard,
  Type,
  RotateCcw,
  Sliders,
  Scissors,
  Eye,
  Sparkles,
  Gauge,
  Maximize2,
} from 'lucide-react';
import { VideoItem, RenderStatusResponse } from '../types';
import {
  RenderPlan,
  CaptionPosition,
  CaptionSize,
  CaptionColor,
  VideoLook,
  VideoZoom,
  DEFAULT_PLAN,
} from '../../shared/plan';
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
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(video.preview_url || null);
  const [duration, setDuration] = useState<number>(0);

  // Editor Plan States
  const [captionText, setCaptionText] = useState<string>('');
  const [captionPosition, setCaptionPosition] = useState<CaptionPosition>('bottom');
  const [captionSize, setCaptionSize] = useState<CaptionSize>('medium');
  const [captionColor, setCaptionColor] = useState<CaptionColor>('white');
  const [captionFadeIn, setCaptionFadeIn] = useState<number>(0);

  const [look, setLook] = useState<VideoLook>('none');
  const [zoom, setZoom] = useState<VideoZoom>('none');
  const [speed, setSpeed] = useState<number>(1);
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(0);
  const [videoFadeIn, setVideoFadeIn] = useState<number>(0);
  const [videoFadeOut, setVideoFadeOut] = useState<number>(0);

  // Workflow / Run Status
  const [panelState, setPanelState] = useState<PanelState>('idle');
  const [runStatus, setRunStatus] = useState<RenderStatusResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch short-lived streaming URL if needed
  useEffect(() => {
    let isMounted = true;
    api
      .getSignedUrl(video.id, false)
      .then((url) => {
        if (isMounted) setStreamUrl(url);
      })
      .catch(() => {
        // Fall back to preview_url if present
      });

    return () => {
      isMounted = false;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [video.id]);

  const handleLoadedMetadata = () => {
    if (videoRef.current && videoRef.current.duration) {
      const dur = Number(videoRef.current.duration.toFixed(1));
      setDuration(dur);
      if (trimEnd === 0) {
        setTrimEnd(dur);
      }
    }
  };

  const handleReset = () => {
    setCaptionText('');
    setCaptionPosition('bottom');
    setCaptionSize('medium');
    setCaptionColor('white');
    setCaptionFadeIn(0);
    setLook('none');
    setZoom('none');
    setSpeed(1);
    setTrimStart(0);
    setTrimEnd(duration);
    setVideoFadeIn(0);
    setVideoFadeOut(0);
    setErrorMessage(null);
  };

  // Has at least one option been modified?
  const isChanged = Boolean(
    captionText.trim() !== '' ||
      captionPosition !== 'bottom' ||
      captionSize !== 'medium' ||
      captionColor !== 'white' ||
      captionFadeIn !== 0 ||
      look !== 'none' ||
      zoom !== 'none' ||
      speed !== 1 ||
      trimStart > 0 ||
      (duration > 0 && trimEnd > 0 && Math.abs(trimEnd - duration) > 0.1) ||
      videoFadeIn !== 0 ||
      videoFadeOut !== 0
  );

  const clearPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

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
    if (!isChanged) return;

    // Validate trim range
    if (trimEnd > 0 && trimStart >= trimEnd) {
      setErrorMessage('Trim start must be less than trim end.');
      return;
    }

    setErrorMessage(null);
    setPanelState('dispatching');
    clearPolling();

    // Construct Plan matching shared/plan.ts schema
    const plan: RenderPlan = {
      look,
      zoom,
      speed,
      trim: {
        start: trimStart,
        end: trimEnd,
      },
      fade_in: videoFadeIn,
      fade_out: videoFadeOut,
    };

    if (captionText.trim()) {
      plan.text = {
        content: captionText.trim(),
        position: captionPosition,
        size: captionSize,
        color: captionColor,
        fade_in: captionFadeIn,
      };
    }

    try {
      await api.renderPlan(video.id, plan);
      setPanelState('polling');

      // Immediate check
      await pollStatus();

      // Poll every 5s
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

  // Build chosen options summary
  const getOptionsSummary = () => {
    const parts: string[] = [];
    if (captionText.trim()) {
      parts.push(`Caption: ${captionPosition} (${captionColor}, ${captionSize}${captionFadeIn ? `, fade ${captionFadeIn}s` : ''})`);
    }
    if (look !== 'none') parts.push(`Look: ${look}`);
    if (zoom !== 'none') parts.push(`Zoom: ${zoom.replace('_', ' ')}`);
    if (speed !== 1) parts.push(`Speed: ${speed}x`);
    if (trimStart > 0 || (duration > 0 && trimEnd < duration)) {
      parts.push(`Trim: ${trimStart}s - ${trimEnd}s`);
    }
    if (videoFadeIn > 0) parts.push(`Fade In: ${videoFadeIn}s`);
    if (videoFadeOut > 0) parts.push(`Fade Out: ${videoFadeOut}s`);

    if (parts.length === 0) return 'No modifications selected';
    return parts.join(' · ');
  };

  const getStatusLabel = () => {
    if (panelState === 'dispatching') return 'dispatching';
    if (runStatus?.status === 'queued') return 'queued';
    if (runStatus?.status === 'in_progress') return 'in progress';
    if (runStatus?.status === 'completed') {
      return runStatus.conclusion === 'success' ? 'completed (success)' : `completed (${runStatus.conclusion || 'failed'})`;
    }
    return runStatus?.status || 'processing';
  };

  // Approximate caption styling classes
  const getCaptionPreviewPositionClass = () => {
    switch (captionPosition) {
      case 'top':
        return 'top-3 inset-x-3 items-start justify-center';
      case 'center':
        return 'inset-3 items-center justify-center';
      case 'bottom':
      default:
        return 'bottom-3 inset-x-3 items-end justify-center';
    }
  };

  const getCaptionPreviewStyleClass = () => {
    let sizeClass = 'text-xs px-2.5 py-1';
    if (captionSize === 'medium') sizeClass = 'text-sm px-3.5 py-1.5';
    if (captionSize === 'large') sizeClass = 'text-base px-4 py-2 font-semibold';

    let colorClass = 'text-white bg-black/60';
    if (captionColor === 'yellow') colorClass = 'text-yellow-300 bg-black/60';
    if (captionColor === 'black') colorClass = 'text-black bg-white/80';

    return `${sizeClass} ${colorClass} rounded-lg backdrop-blur-xs text-center max-w-[90%] shadow-md`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[94vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <Clapperboard className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-100 truncate">Video Editor</h3>
              <p className="text-xs text-slate-400 truncate">{video.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {panelState === 'idle' && (
              <button
                type="button"
                onClick={handleReset}
                className="min-h-[44px] px-2.5 flex items-center gap-1 text-slate-400 hover:text-slate-200 text-xs font-medium rounded-lg transition-colors"
                title="Reset all settings to default"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg transition-colors"
              aria-label="Close editor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Video Preview at Top */}
          <div className="space-y-1.5">
            <div className="relative bg-black rounded-xl overflow-hidden aspect-video border border-slate-800">
              <video
                ref={videoRef}
                src={streamUrl || undefined}
                controls
                playsInline
                onLoadedMetadata={handleLoadedMetadata}
                className="w-full h-full object-contain"
              >
                Video playback preview unavailable.
              </video>

              {/* Approximate Caption Overlay Preview */}
              {captionText.trim() && (
                <div
                  className={`absolute pointer-events-none flex ${getCaptionPreviewPositionClass()}`}
                >
                  <div className={getCaptionPreviewStyleClass()}>
                    {captionText}
                  </div>
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-500 leading-tight px-1">
              Approximate preview. Looks, zoom, speed and fades appear only in the final render.
            </p>
          </div>

          {/* Controls (visible when idle) */}
          {panelState === 'idle' && (
            <div className="space-y-4">
              {/* 1. Caption Section */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-purple-400" />
                    <span>Caption</span>
                  </span>
                  <span className={`text-[11px] font-mono ${captionText.length > 200 ? 'text-rose-400' : 'text-slate-500'}`}>
                    {captionText.length}/200
                  </span>
                </div>

                <input
                  type="text"
                  maxLength={200}
                  value={captionText}
                  onChange={(e) => setCaptionText(e.target.value)}
                  placeholder="Enter overlay caption..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-purple-500"
                />

                {/* Caption Position, Size, Color & Fade-In Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                  {/* Position */}
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Position</label>
                    <select
                      value={captionPosition}
                      onChange={(e) => setCaptionPosition(e.target.value as CaptionPosition)}
                      className="w-full h-9 px-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-purple-500"
                    >
                      <option value="top">Top</option>
                      <option value="center">Center</option>
                      <option value="bottom">Bottom</option>
                    </select>
                  </div>

                  {/* Size */}
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Size</label>
                    <select
                      value={captionSize}
                      onChange={(e) => setCaptionSize(e.target.value as CaptionSize)}
                      className="w-full h-9 px-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-purple-500"
                    >
                      <option value="small">Small</option>
                      <option value="medium">Medium</option>
                      <option value="large">Large</option>
                    </select>
                  </div>

                  {/* Color */}
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Color</label>
                    <select
                      value={captionColor}
                      onChange={(e) => setCaptionColor(e.target.value as CaptionColor)}
                      className="w-full h-9 px-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-purple-500"
                    >
                      <option value="white">White</option>
                      <option value="yellow">Yellow</option>
                      <option value="black">Black</option>
                    </select>
                  </div>

                  {/* Caption Fade-In */}
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Fade In</label>
                    <select
                      value={captionFadeIn}
                      onChange={(e) => setCaptionFadeIn(Number(e.target.value))}
                      className="w-full h-9 px-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-purple-500"
                    >
                      <option value={0}>0s (None)</option>
                      <option value={1}>1s</option>
                      <option value={2}>2s</option>
                      <option value={3}>3s</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 2. Look & Zoom Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Look */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                  <label className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    <span>Look</span>
                  </label>
                  <select
                    value={look}
                    onChange={(e) => setLook(e.target.value as VideoLook)}
                    className="w-full h-9 px-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="none">None (Original)</option>
                    <option value="cinematic">Cinematic</option>
                    <option value="warm">Warm</option>
                    <option value="cool">Cool</option>
                    <option value="bw">Black & White</option>
                    <option value="vivid">Vivid</option>
                  </select>
                </div>

                {/* Zoom */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                  <label className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                    <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>Zoom</span>
                  </label>
                  <select
                    value={zoom}
                    onChange={(e) => setZoom(e.target.value as VideoZoom)}
                    className="w-full h-9 px-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="none">None</option>
                    <option value="slow_in">Slow zoom in</option>
                    <option value="slow_out">Slow zoom out</option>
                  </select>
                </div>
              </div>

              {/* 3. Speed Slider */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-200 flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-purple-400" />
                    <span>Speed</span>
                  </span>
                  <span className="font-mono text-purple-400 font-semibold">{speed}x</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-500 font-mono">0.5x</span>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={speed}
                    onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    className="flex-1 accent-purple-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <span className="text-[11px] text-slate-500 font-mono">2.0x</span>
                </div>
              </div>

              {/* 4. Trim Section */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-200 flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-blue-400" />
                    <span>Trim (Seconds)</span>
                  </span>
                  {duration > 0 && (
                    <span className="text-[11px] text-slate-500 font-mono">
                      Total: {duration}s
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Start (sec)</label>
                    <input
                      type="number"
                      min={0}
                      max={duration > 0 ? duration : 3600}
                      step="0.1"
                      value={trimStart}
                      onChange={(e) => setTrimStart(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full h-9 px-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">End (sec)</label>
                    <input
                      type="number"
                      min={trimStart}
                      max={duration > 0 ? duration : 3600}
                      step="0.1"
                      value={trimEnd}
                      onChange={(e) => setTrimEnd(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full h-9 px-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* 5. Video Fade In and Fade Out */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                <span className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-purple-400" />
                  <span>Video Fades (0 to 3s)</span>
                </span>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Fade In</label>
                    <select
                      value={videoFadeIn}
                      onChange={(e) => setVideoFadeIn(Number(e.target.value))}
                      className="w-full h-9 px-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-purple-500"
                    >
                      <option value={0}>0s (None)</option>
                      <option value={1}>1s</option>
                      <option value={2}>2s</option>
                      <option value={3}>3s</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Fade Out</label>
                    <select
                      value={videoFadeOut}
                      onChange={(e) => setVideoFadeOut(Number(e.target.value))}
                      className="w-full h-9 px-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-purple-500"
                    >
                      <option value={0}>0s (None)</option>
                      <option value={1}>1s</option>
                      <option value={2}>2s</option>
                      <option value={3}>3s</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Error Banner */}
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="flex-1 leading-relaxed">{errorMessage}</p>
                </div>
              )}
            </div>
          )}

          {/* Polling / Progress State */}
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
                  Selected options: <span className="text-slate-200">{getOptionsSummary()}</span>
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

          {/* Completed Success State */}
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
                  Adjust Options
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

        {/* Footer when idle */}
        {panelState === 'idle' && (
          <div className="px-4 py-3 bg-slate-950/90 border-t border-slate-800 flex flex-col gap-2 shrink-0">
            {/* Summary of chosen options */}
            <div className="text-[11px] text-slate-400 flex items-center gap-1 truncate">
              <span className="text-slate-500 shrink-0">Summary:</span>
              <span className="text-slate-300 truncate">{getOptionsSummary()}</span>
            </div>

            {/* Note */}
            <p className="text-[10px] text-slate-500 leading-tight">
              Original video is not changed. Output keeps the original size and is re-encoded at high quality, so it is not lossless.
            </p>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2 pt-1">
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
                disabled={!isChanged}
                className="min-h-[44px] px-5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 active:scale-[0.99] text-white font-medium text-xs flex items-center gap-1.5 transition-transform disabled:opacity-50 shadow-sm"
                title={!isChanged ? 'Modify at least one option to enable Render' : undefined}
              >
                <span>Render</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
