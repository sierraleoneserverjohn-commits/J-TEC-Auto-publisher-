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
  Sparkles,
  Gauge,
  Maximize2,
  Plus,
  Trash2,
  Play,
  Pause,
  Tag,
} from 'lucide-react';
import { VideoItem, RenderStatusResponse } from '../types';
import {
  RenderPlan,
  PlanTextItem,
  CaptionSize,
  CaptionColor,
  CaptionStyle,
  VideoLook,
  VideoZoom,
  BrandTagConfig,
  DEFAULT_PLAN,
} from '../../shared/plan';
import { getStoredBrandTag, StoredBrandTag } from '../utils/brandTag';
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
  const previewBoxRef = useRef<HTMLDivElement | null>(null);

  const [streamUrl, setStreamUrl] = useState<string | null>(video.preview_url || null);
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Editor Plan States
  const [texts, setTexts] = useState<PlanTextItem[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);

  const [look, setLook] = useState<VideoLook>('none');
  const [zoom, setZoom] = useState<VideoZoom>('none');
  const [speed, setSpeed] = useState<number>(1);
  const [trimStart, setTrimStart] = useState<number>(0);
  const [trimEnd, setTrimEnd] = useState<number>(0);
  const [videoFadeIn, setVideoFadeIn] = useState<number>(0);
  const [videoFadeOut, setVideoFadeOut] = useState<number>(0);

  // Brand tag settings
  const [storedBrand, setStoredBrand] = useState<StoredBrandTag>({
    enabled: false,
    content: '',
    position: 'bottom_center',
  });
  const [includeBrandTag, setIncludeBrandTag] = useState<boolean>(false);

  // Dragging state
  const draggingIdRef = useRef<string | null>(null);

  // Workflow / Run Status
  const [panelState, setPanelState] = useState<PanelState>('idle');
  const [runStatus, setRunStatus] = useState<RenderStatusResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load stream URL and stored brand tag on mount
  useEffect(() => {
    let isMounted = true;
    const brand = getStoredBrandTag();
    setStoredBrand(brand);
    setIncludeBrandTag(brand.enabled && Boolean(brand.content));

    api
      .getSignedUrl(video.id, false)
      .then((url) => {
        if (isMounted) setStreamUrl(url);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [video.id]);

  // Video metadata duration
  const handleLoadedMetadata = () => {
    if (videoRef.current && videoRef.current.duration) {
      const dur = Number(videoRef.current.duration.toFixed(1));
      setDuration(dur);
      if (trimEnd === 0) {
        setTrimEnd(dur);
      }
    }
  };

  // Video time update loop for live preview
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    setCurrentTime(t);

    const effectiveEnd = trimEnd > 0 ? trimEnd : duration;

    // Enforce trim boundaries during playback
    if (t >= effectiveEnd && effectiveEnd > 0) {
      videoRef.current.pause();
      videoRef.current.currentTime = trimStart;
      setIsPlaying(false);
    } else if (t < trimStart) {
      videoRef.current.currentTime = trimStart;
    }
  };

  // Sync speed changes to playbackRate
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  }, [speed]);

  const togglePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      const effectiveEnd = trimEnd > 0 ? trimEnd : duration;
      if (videoRef.current.currentTime >= effectiveEnd || videoRef.current.currentTime < trimStart) {
        videoRef.current.currentTime = trimStart;
      }
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
    }
  };

  // Text management
  const handleAddText = () => {
    if (texts.length >= 6) return;
    const newId = `txt_${Date.now()}`;
    const newItem: PlanTextItem = {
      id: newId,
      content: `Text ${texts.length + 1}`,
      x: 0.5,
      y: texts.length === 0 ? 0.82 : 0.5,
      size: 'medium',
      color: 'white',
      style: 'clean',
      start: 0,
      end: null,
      fade_in: 0,
    };
    setTexts((prev) => [...prev, newItem]);
    setSelectedTextId(newId);
  };

  const handleDeleteSelectedText = () => {
    if (!selectedTextId) return;
    setTexts((prev) => prev.filter((t) => t.id !== selectedTextId));
    setSelectedTextId(null);
  };

  const updateSelectedText = (patch: Partial<PlanTextItem>) => {
    if (!selectedTextId) return;
    setTexts((prev) =>
      prev.map((t) => (t.id === selectedTextId ? { ...t, ...patch } : t))
    );
  };

  const selectedText = texts.find((t) => t.id === selectedTextId);

  // Dragging handlers for text
  const handlePointerDown = (id: string, e: React.PointerEvent) => {
    e.stopPropagation();
    setSelectedTextId(id);
    draggingIdRef.current = id;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingIdRef.current || !previewBoxRef.current) return;
    const rect = previewBoxRef.current.getBoundingClientRect();
    const rawX = (e.clientX - rect.left) / rect.width;
    const rawY = (e.clientY - rect.top) / rect.height;

    const clampedX = Math.min(Math.max(Number(rawX.toFixed(3)), 0.05), 0.95);
    const clampedY = Math.min(Math.max(Number(rawY.toFixed(3)), 0.05), 0.95);

    const targetId = draggingIdRef.current;
    setTexts((prev) =>
      prev.map((item) =>
        item.id === targetId ? { ...item, x: clampedX, y: clampedY } : item
      )
    );
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingIdRef.current) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      draggingIdRef.current = null;
    }
  };

  const handleReset = () => {
    setTexts([]);
    setSelectedTextId(null);
    setLook('none');
    setZoom('none');
    setSpeed(1);
    setTrimStart(0);
    setTrimEnd(duration);
    setVideoFadeIn(0);
    setVideoFadeOut(0);
    setIncludeBrandTag(storedBrand.enabled && Boolean(storedBrand.content));
    setErrorMessage(null);
    if (videoRef.current) {
      videoRef.current.playbackRate = 1;
      videoRef.current.currentTime = 0;
    }
  };

  // Change detection
  const isChanged = Boolean(
    texts.length > 0 ||
      look !== 'none' ||
      zoom !== 'none' ||
      speed !== 1 ||
      trimStart > 0 ||
      (duration > 0 && trimEnd > 0 && Math.abs(trimEnd - duration) > 0.1) ||
      videoFadeIn !== 0 ||
      videoFadeOut !== 0 ||
      (storedBrand.enabled && storedBrand.content && !includeBrandTag) // toggled off brand
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

    if (trimEnd > 0 && trimStart >= trimEnd) {
      setErrorMessage('Trim start must be less than trim end.');
      return;
    }

    setErrorMessage(null);
    setPanelState('dispatching');
    clearPolling();

    // Construct Plan
    const brandPayload: BrandTagConfig | undefined =
      includeBrandTag && storedBrand.content
        ? {
            content: storedBrand.content,
            position: storedBrand.position,
          }
        : undefined;

    const plan: RenderPlan = {
      texts: texts.map(({ id, ...rest }) => rest),
      brand: brandPayload,
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

  // Preview Calculations
  const effectiveEnd = trimEnd > 0 ? trimEnd : duration;
  const effectiveDuration = Math.max(0.1, effectiveEnd - trimStart);
  const editedTime = Math.max(0, (currentTime - trimStart) / speed);
  const finalDuration = effectiveDuration / speed;

  // Zoom scale
  const zoomProgress = effectiveDuration > 0 ? Math.max(0, Math.min(1, (currentTime - trimStart) / effectiveDuration)) : 0;
  let zoomScale = 1;
  if (zoom === 'slow_in') zoomScale = 1 + 0.15 * zoomProgress;
  else if (zoom === 'slow_out') zoomScale = 1.15 - 0.15 * zoomProgress;

  // CSS Filter for Look
  const getLookFilterStyle = () => {
    switch (look) {
      case 'cinematic':
        return 'contrast(1.12) saturate(1.12)';
      case 'warm':
        return 'sepia(0.25) saturate(1.1) contrast(1.04)';
      case 'cool':
        return 'hue-rotate(185deg) sepia(0.15) saturate(1.05)';
      case 'bw':
        return 'grayscale(1) contrast(1.1)';
      case 'vivid':
        return 'saturate(1.4) contrast(1.06)';
      case 'none':
      default:
        return 'none';
    }
  };

  // Video Fade Opacity
  let fadeBlackOpacity = 0;
  if (videoFadeIn > 0 && editedTime < videoFadeIn) {
    fadeBlackOpacity = (videoFadeIn - editedTime) / videoFadeIn;
  }
  if (videoFadeOut > 0 && finalDuration > 0) {
    const timeLeft = finalDuration - editedTime;
    if (timeLeft < videoFadeOut) {
      const outOp = (videoFadeOut - Math.max(0, timeLeft)) / videoFadeOut;
      fadeBlackOpacity = Math.max(fadeBlackOpacity, outOp);
    }
  }

  // Summary builder
  const getOptionsSummary = () => {
    const parts: string[] = [];
    if (texts.length > 0) {
      parts.push(`${texts.length} text${texts.length > 1 ? 's' : ''}`);
    }
    if (includeBrandTag && storedBrand.content) {
      parts.push(`Brand: "${storedBrand.content}"`);
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

  const formatTime = (secs: number) => {
    const s = Math.max(0, Math.floor(secs));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? '0' : ''}${rem}`;
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
              <h3 className="text-sm font-semibold text-slate-100 truncate">Interactive Video Editor</h3>
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
          {/* Live Interactive Preview Screen */}
          <div className="space-y-2">
            <div
              ref={previewBoxRef}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="relative bg-black rounded-xl overflow-hidden aspect-video border border-slate-800 select-none touch-none"
            >
              <video
                ref={videoRef}
                src={streamUrl || undefined}
                playsInline
                muted
                onLoadedMetadata={handleLoadedMetadata}
                onTimeUpdate={handleTimeUpdate}
                style={{
                  filter: getLookFilterStyle(),
                  transform: `scale(${zoomScale})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.05s linear',
                }}
                className="w-full h-full object-contain pointer-events-none"
              >
                Video playback preview unavailable.
              </video>

              {/* Black Fades Overlay */}
              {fadeBlackOpacity > 0 && (
                <div
                  className="absolute inset-0 bg-black pointer-events-none transition-opacity duration-75"
                  style={{ opacity: Math.min(1, fadeBlackOpacity) }}
                />
              )}

              {/* Text Overlays */}
              {texts.map((item) => {
                const isSelected = item.id === selectedTextId;
                const isTimeActive =
                  editedTime >= item.start && (item.end === null || editedTime <= item.end);

                if (!isTimeActive && panelState === 'idle' && !isSelected) {
                  // Hide when outside active time range, unless currently selected for editing
                  return null;
                }

                // Fade-in opacity
                let textOpacity = 1;
                if (item.fade_in > 0 && editedTime >= item.start) {
                  const age = editedTime - item.start;
                  if (age < item.fade_in) {
                    textOpacity = Math.max(0.1, age / item.fade_in);
                  }
                }

                // Text Size classes
                const sizeStyle =
                  item.size === 'small'
                    ? 'text-xs'
                    : item.size === 'medium'
                    ? 'text-sm'
                    : 'text-base font-bold';

                // Text Color classes
                const colorClass =
                  item.color === 'yellow'
                    ? 'text-yellow-300'
                    : item.color === 'black'
                    ? 'text-black'
                    : 'text-white';

                // Style appearance
                let styleClass = '';
                if (item.style === 'box') {
                  styleClass = 'bg-black/60 px-2.5 py-1 rounded-md backdrop-blur-xs';
                } else if (item.style === 'outline') {
                  styleClass = '[text-shadow:_0_0_2px_#000,_0_0_4px_#000,_0_0_6px_#000]';
                } else {
                  styleClass = 'drop-shadow-[0_2px_4px_rgba(0,0,0,0.85)]';
                }

                return (
                  <div
                    key={item.id}
                    onPointerDown={(e) => handlePointerDown(item.id!, e)}
                    style={{
                      left: `${item.x * 100}%`,
                      top: `${item.y * 100}%`,
                      transform: 'translate(-50%, -50%)',
                      opacity: isTimeActive ? textOpacity : 0.45,
                    }}
                    className={`absolute cursor-move select-none touch-none flex items-center justify-center text-center max-w-[85%] ${
                      isSelected ? 'ring-1.5 ring-purple-400 ring-offset-1 ring-offset-black/60 rounded' : ''
                    }`}
                  >
                    <span className={`${sizeStyle} ${colorClass} ${styleClass} whitespace-pre-wrap leading-tight`}>
                      {item.content || '(empty)'}
                    </span>
                  </div>
                );
              })}

              {/* Brand Tag in Preview */}
              {includeBrandTag && storedBrand.content && (
                <div
                  className={`absolute pointer-events-none z-10 flex ${
                    storedBrand.position === 'top_center'
                      ? 'top-2 inset-x-0 justify-center'
                      : storedBrand.position === 'bottom_left'
                      ? 'bottom-2 left-2'
                      : storedBrand.position === 'bottom_right'
                      ? 'bottom-2 right-2'
                      : 'bottom-2 inset-x-0 justify-center'
                  }`}
                >
                  <span className="text-[10px] text-white/90 bg-black/60 px-2 py-0.5 rounded border border-white/10 backdrop-blur-xs font-medium">
                    {storedBrand.content}
                  </span>
                </div>
              )}
            </div>

            {/* Transport Scrub Bar & Play/Pause */}
            <div className="flex items-center gap-2 px-1">
              <button
                type="button"
                onClick={togglePlayPause}
                className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-slate-300 ml-0.5" />}
              </button>

              <input
                type="range"
                min={trimStart}
                max={effectiveEnd > trimStart ? effectiveEnd : trimStart + 1}
                step="0.05"
                value={currentTime}
                onChange={handleScrub}
                className="flex-1 accent-purple-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />

              <span className="text-[11px] font-mono text-slate-400 shrink-0">
                {formatTime(currentTime)} / {formatTime(effectiveEnd)}
              </span>
            </div>

            <p className="text-[11px] text-slate-500 leading-tight px-1">
              Approximate preview. The final render is made by FFmpeg and may differ slightly.
            </p>
          </div>

          {/* Controls when idle */}
          {panelState === 'idle' && (
            <div className="space-y-4">
              {/* Text Overlays Management */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-purple-400" />
                    <span>Text Overlays ({texts.length}/6)</span>
                  </span>

                  <button
                    type="button"
                    onClick={handleAddText}
                    disabled={texts.length >= 6}
                    className="min-h-[32px] px-2.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-medium flex items-center gap-1 transition-colors disabled:opacity-40"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Text</span>
                  </button>
                </div>

                {/* Text Selector Tabs */}
                {texts.length > 0 && (
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {texts.map((t, idx) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTextId(t.id!)}
                        className={`min-h-[32px] px-3 py-1 rounded-lg text-xs font-medium shrink-0 transition-colors ${
                          selectedTextId === t.id
                            ? 'bg-purple-600 text-white shadow-sm'
                            : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        #{idx + 1} {t.content.slice(0, 10) || 'Text'}
                      </button>
                    ))}
                  </div>
                )}

                {/* Selected Text Controls */}
                {selectedText ? (
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-medium">Edit Selected Text</span>
                      <button
                        type="button"
                        onClick={handleDeleteSelectedText}
                        className="text-rose-400 hover:text-rose-300 text-xs flex items-center gap-1 p-1"
                        title="Delete selected text"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] text-slate-400">Content</label>
                        <span className="text-[11px] font-mono text-slate-500">
                          {selectedText.content.length}/200
                        </span>
                      </div>
                      <textarea
                        rows={2}
                        maxLength={200}
                        value={selectedText.content}
                        onChange={(e) => updateSelectedText({ content: e.target.value })}
                        placeholder="Enter text..."
                        className="w-full p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-purple-500 resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      {/* Size */}
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Size</label>
                        <select
                          value={selectedText.size}
                          onChange={(e) => updateSelectedText({ size: e.target.value as CaptionSize })}
                          className="w-full h-8 px-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-purple-500"
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
                          value={selectedText.color}
                          onChange={(e) => updateSelectedText({ color: e.target.value as CaptionColor })}
                          className="w-full h-8 px-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-purple-500"
                        >
                          <option value="white">White</option>
                          <option value="yellow">Yellow</option>
                          <option value="black">Black</option>
                        </select>
                      </div>

                      {/* Style */}
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Style</label>
                        <select
                          value={selectedText.style}
                          onChange={(e) => updateSelectedText({ style: e.target.value as CaptionStyle })}
                          className="w-full h-8 px-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-purple-500"
                        >
                          <option value="clean">Clean (Shadow)</option>
                          <option value="box">Box</option>
                          <option value="outline">Outline</option>
                        </select>
                      </div>

                      {/* Fade-In */}
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Fade In</label>
                        <select
                          value={selectedText.fade_in}
                          onChange={(e) => updateSelectedText({ fade_in: Number(e.target.value) })}
                          className="w-full h-8 px-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-purple-500"
                        >
                          <option value={0}>0s (None)</option>
                          <option value={1}>1s</option>
                          <option value={2}>2s</option>
                          <option value={3}>3s</option>
                        </select>
                      </div>
                    </div>

                    {/* Start and End Timers on Final Video */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-800/60">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Start (sec)</label>
                        <input
                          type="number"
                          min={0}
                          max={finalDuration}
                          step="0.1"
                          value={selectedText.start}
                          onChange={(e) =>
                            updateSelectedText({ start: Math.max(0, parseFloat(e.target.value) || 0) })
                          }
                          className="w-full h-8 px-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">End (sec, blank=all)</label>
                        <input
                          type="number"
                          min={selectedText.start}
                          max={finalDuration}
                          step="0.1"
                          value={selectedText.end ?? ''}
                          placeholder="End of video"
                          onChange={(e) => {
                            const val = e.target.value === '' ? null : parseFloat(e.target.value);
                            updateSelectedText({ end: val });
                          }}
                          className="w-full h-8 px-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">
                    Tap "Add Text" or drag any text overlay directly on the preview to position it.
                  </p>
                )}
              </div>

              {/* Brand Tag Switch for this video */}
              {storedBrand.enabled && storedBrand.content && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-purple-400" />
                    <div>
                      <span className="text-slate-200 font-medium">Brand Tag: </span>
                      <span className="text-slate-400">"{storedBrand.content}"</span>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeBrandTag}
                      onChange={(e) => setIncludeBrandTag(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-900 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600 border border-slate-800"></div>
                  </label>
                </div>
              )}

              {/* Look & Zoom Section */}
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

              {/* Speed Slider */}
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

              {/* Trim Section */}
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

              {/* Video Fades */}
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
