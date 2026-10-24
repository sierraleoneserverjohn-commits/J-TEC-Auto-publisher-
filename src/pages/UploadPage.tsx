import React, { useRef, useState } from 'react';
import { UploadCloud, FileVideo, CheckCircle2, AlertCircle, RefreshCw, X, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import { VideoItem } from '../types';

interface UploadPageProps {
  onUploadSuccess: (video: VideoItem) => void;
  onGoToLibrary: () => void;
}

const MAX_BYTES = 200 * 1024 * 1024; // 200 MB
const ALLOWED_EXTS = ['.mp4', '.mov', '.webm'];
const ALLOWED_MIMES = ['video/mp4', 'video/quicktime', 'video/webm'];

export const UploadPage: React.FC<UploadPageProps> = ({ onUploadSuccess, onGoToLibrary }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customName, setCustomName] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const [uploading, setUploading] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [bytesUploaded, setBytesUploaded] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number>(0);

  const [error, setError] = useState<string | null>(null);
  const [uploadedVideo, setUploadedVideo] = useState<VideoItem | null>(null);

  const validateAndSetFile = (file: File) => {
    setError(null);
    setUploadedVideo(null);

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const isExtAllowed = ALLOWED_EXTS.includes(ext);
    const isMimeAllowed = ALLOWED_MIMES.includes(file.type) || isExtAllowed;

    if (!isExtAllowed || !isMimeAllowed) {
      setError(`Invalid format: "${file.name}". Only MP4, MOV, and WebM videos are supported.`);
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setError(`File size exceeds 200 MB limit (selected: ${sizeMB} MB). Please choose a smaller file.`);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    // Suggest default title
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
    setCustomName(nameWithoutExt);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleStartUpload = async () => {
    if (!selectedFile) return;

    setError(null);
    setUploading(true);
    setProgressPercent(0);
    setBytesUploaded(0);
    setTotalBytes(selectedFile.size);

    try {
      const video = await api.uploadVideo(
        selectedFile,
        customName.trim() || selectedFile.name,
        (percent, loaded, total) => {
          setProgressPercent(percent);
          setBytesUploaded(loaded);
          setTotalBytes(total);
        }
      );

      setUploadedVideo(video);
      onUploadSuccess(video);
    } catch (err: any) {
      setError(err.message || 'Video upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setCustomName('');
    setError(null);
    setUploadedVideo(null);
    setProgressPercent(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="pb-24 pt-4 px-4 max-w-md mx-auto">
      {/* Title */}
      <div className="mb-5">
        <h2 className="text-lg font-bold text-slate-100 tracking-tight">Upload Video</h2>
        <p className="text-xs text-slate-400 mt-0.5">MP4, MOV, WebM up to 200 MB</p>
      </div>

      {/* Error state with retry */}
      {error && (
        <div className="mb-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex flex-col gap-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="flex-1 leading-relaxed">{error}</p>
          </div>
          {selectedFile && !uploading && (
            <button
              onClick={handleStartUpload}
              className="self-start px-3 py-1.5 rounded-lg bg-rose-600/30 hover:bg-rose-600/40 text-rose-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Upload</span>
            </button>
          )}
        </div>
      )}

      {/* Success State */}
      {uploadedVideo && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Upload Complete</h3>
            <p className="text-xs text-slate-400 mt-1 truncate max-w-[260px] mx-auto">
              "{uploadedVideo.name}" was securely uploaded to private storage.
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={onGoToLibrary}
              className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium text-xs hover:from-blue-500 hover:to-purple-500 transition-colors shadow-sm"
            >
              <span>View in Video Library</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleReset}
              className="w-full min-h-[44px] flex items-center justify-center px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 hover:text-white transition-colors"
            >
              Upload Another Video
            </button>
          </div>
        </div>
      )}

      {/* Uploading Progress Screen */}
      {uploading && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between text-xs font-medium text-slate-200">
            <span className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
              <span>Uploading to private storage...</span>
            </span>
            <span className="font-mono text-blue-400 font-semibold">{progressPercent}%</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-150"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Upload Metrics */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>
              {formatSize(bytesUploaded)} / {formatSize(totalBytes)}
            </span>
            <span>{selectedFile?.name}</span>
          </div>
        </div>
      )}

      {/* File Selection Form (when not uploaded yet and not currently uploading) */}
      {!uploadedVideo && !uploading && (
        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
            onChange={handleFileChange}
            className="hidden"
            id="video-file-picker"
          />

          {!selectedFile ? (
            <label
              htmlFor="video-file-picker"
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-blue-500 bg-blue-500/5'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600/20 to-purple-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              <span className="text-sm font-medium text-slate-200">Tap to select a video</span>
              <span className="text-xs text-slate-500 mt-1">or drag and drop here</span>
              <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-500">
                <span>MP4</span>
                <span aria-hidden="true">·</span>
                <span>MOV</span>
                <span aria-hidden="true">·</span>
                <span>WebM</span>
                <span aria-hidden="true">·</span>
                <span>Max 200 MB</span>
              </div>
            </label>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              {/* Selected File Card */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                    <FileVideo className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{selectedFile.name}</p>
                    <p className="text-[11px] text-slate-500 font-mono">{formatSize(selectedFile.size)}</p>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-300"
                  aria-label="Remove selected file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Video Title Input */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Display Title (Optional)
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Enter title for library..."
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Start Upload Button */}
              <button
                onClick={handleStartUpload}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 active:scale-[0.99] text-white font-medium text-sm transition-transform shadow-md shadow-blue-950/30"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Upload Video</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
