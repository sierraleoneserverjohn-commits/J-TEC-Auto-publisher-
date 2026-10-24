import React, { useState } from 'react';
import { LogOut, User, Sliders, CheckCircle2, ShieldCheck, RefreshCw, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const SettingsPage: React.FC = () => {
  const { user, logout, configStatus, checkStatus, authRequired } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  const handleRefreshStatus = async () => {
    setRefreshing(true);
    await checkStatus();
    setRefreshing(false);
  };

  return (
    <div className="pb-24 pt-4 px-4 max-w-md mx-auto space-y-5">
      {/* Page Title */}
      <div>
        <h2 className="text-lg font-bold text-slate-100 tracking-tight">Settings</h2>
        <p className="text-xs text-slate-400 mt-0.5">App configuration & storage status</p>
      </div>

      {/* Account Info Card (Only shown if AUTH_REQUIRED is enabled) */}
      {authRequired && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-100">Account</h3>
              <p className="text-xs text-slate-400 truncate">{user?.email || 'Logged in user'}</p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>User ID</span>
            <span className="font-mono text-[11px] text-slate-300 truncate max-w-[180px]">
              {user?.id}
            </span>
          </div>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 text-xs font-medium transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{loggingOut ? 'Signing out...' : 'Log Out'}</span>
          </button>
        </div>
      )}

      {/* Backend & Supabase Status Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Storage & Database</h3>
              <p className="text-xs text-slate-400">Supabase backend</p>
            </div>
          </div>
          <button
            onClick={handleRefreshStatus}
            disabled={refreshing}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors"
            title="Check backend status"
            aria-label="Refresh connection status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Connection State</span>
            {configStatus?.configured ? (
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Connected</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Not Connected</span>
              </span>
            )}
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Mode</span>
            <span className="text-slate-300 font-medium">
              {authRequired ? 'Multi-User (Auth Required)' : 'Single Owner (No Login)'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Storage Security</span>
            <span className="text-slate-300 font-medium">Private (Signed URLs)</span>
          </div>
        </div>
      </div>

      {/* Empty Preferences Section Placeholder */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
        <div className="flex items-center gap-2 text-slate-300">
          <Sliders className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-slate-100">Preferences</h3>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Preferences placeholder section. No options configured yet.
        </p>
      </div>
    </div>
  );
};
