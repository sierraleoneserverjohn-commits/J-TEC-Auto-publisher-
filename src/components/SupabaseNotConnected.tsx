import React, { useState } from 'react';
import { AlertCircle, RefreshCw, KeyRound, ExternalLink, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const SupabaseNotConnected: React.FC = () => {
  const { configStatus, checkStatus } = useAuth();
  const [checking, setChecking] = useState(false);
  const [justChecked, setJustChecked] = useState(false);

  const missingKeys = configStatus?.missingKeys || ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];

  const handleRetry = async () => {
    setChecking(true);
    setJustChecked(false);
    await checkStatus();
    setChecking(false);
    setJustChecked(true);
    setTimeout(() => setJustChecked(false), 3000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center px-4 py-8">
      <div className="w-full max-w-md mx-auto bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-100 tracking-tight">Supabase Not Connected</h1>
            <p className="text-xs text-slate-400">Database and private storage require credentials</p>
          </div>
        </div>

        {/* Missing Keys Section */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 mb-5">
          <div className="flex items-center gap-2 mb-2 text-xs font-medium text-slate-300">
            <KeyRound className="w-3.5 h-3.5 text-purple-400" />
            <span>Missing Server Secrets ({missingKeys.length})</span>
          </div>
          <div className="space-y-1.5 font-mono text-xs">
            {missingKeys.map((key) => (
              <div
                key={key}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300"
              >
                <span>{key}</span>
                <span className="text-[10px] text-amber-400 font-sans uppercase font-medium">Required</span>
              </div>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div className="text-xs text-slate-400 space-y-2 mb-6 leading-relaxed">
          <p>
            To activate user authentication, the <code className="text-purple-300 font-mono">videos</code> table, and private video storage:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-slate-400 pl-1">
            <li>Create or open your Supabase project.</li>
            <li>Copy your Project URL, Anon Key, and Service Role Key.</li>
            <li>Save them in this applet's <strong>Settings &gt; Secrets</strong>.</li>
            <li>Run the SQL commands provided in the project README.md.</li>
          </ol>
        </div>

        {/* Action Button */}
        <div className="space-y-3">
          <button
            onClick={handleRetry}
            disabled={checking}
            className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 active:scale-[0.99] text-white font-medium text-sm transition-transform disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Testing Connection...' : 'Check Connection'}</span>
          </button>

          {justChecked && (
            <p className="text-center text-xs text-amber-400 flex items-center justify-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Keys are still missing or invalid. Check Settings &gt; Secrets.</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
