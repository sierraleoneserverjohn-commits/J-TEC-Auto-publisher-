import React, { useState } from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const WarningBanner: React.FC = () => {
  const { configStatus, checkStatus } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (configStatus?.configured || dismissed) {
    return null;
  }

  const handleCheckConnection = async () => {
    setChecking(true);
    setFeedback(null);
    try {
      const res = await checkStatus();
      if (res.configured) {
        setFeedback('Connected successfully!');
      } else {
        setFeedback('Still not connected. Check Settings > Secrets.');
        setTimeout(() => setFeedback(null), 3500);
      }
    } catch {
      setFeedback('Connection check failed.');
      setTimeout(() => setFeedback(null), 3500);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="bg-amber-950/70 border-b border-amber-800/60 px-3 py-2 text-xs text-amber-200">
      <div className="max-w-md mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="truncate">
            Supabase not connected: uploads and library are unavailable.
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCheckConnection}
            disabled={checking}
            className="px-2.5 py-1 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-medium transition-colors text-[11px] flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Checking...' : 'Check connection'}</span>
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-amber-400 hover:text-amber-200 rounded transition-colors"
            aria-label="Dismiss notice"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {feedback && (
        <div className="max-w-md mx-auto mt-1 text-[11px] text-amber-300 font-medium">
          {feedback}
        </div>
      )}
    </div>
  );
};
