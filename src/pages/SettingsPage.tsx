import React, { useState, useEffect } from 'react';
import { LogOut, User, Sliders, CheckCircle2, ShieldCheck, RefreshCw, AlertCircle, Tag, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BrandPosition } from '../../shared/plan';
import { getStoredBrandTag, saveStoredBrandTag } from '../utils/brandTag';

export const SettingsPage: React.FC = () => {
  const { user, logout, configStatus, checkStatus, authRequired } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Brand tag settings
  const [brandEnabled, setBrandEnabled] = useState(false);
  const [brandContent, setBrandContent] = useState('');
  const [brandPosition, setBrandPosition] = useState<BrandPosition>('bottom_center');
  const [savedBadge, setSavedBadge] = useState(false);

  useEffect(() => {
    const stored = getStoredBrandTag();
    setBrandEnabled(stored.enabled);
    setBrandContent(stored.content);
    setBrandPosition(stored.position);
  }, []);

  const handleSaveBrand = (enabled: boolean, content: string, position: BrandPosition) => {
    saveStoredBrandTag({ enabled, content, position });
    setSavedBadge(true);
    setTimeout(() => setSavedBadge(false), 2000);
  };

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
        <p className="text-xs text-slate-400 mt-0.5">App configuration & preferences</p>
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

      {/* Brand Tag Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100">Brand Tag</h3>
              <p className="text-xs text-slate-400">Auto-stamp your channel/handle</p>
            </div>
          </div>

          {/* Enable Toggle */}
          <label className="relative inline-flex items-center cursor-pointer min-h-[44px] min-w-[44px] justify-center">
            <input
              type="checkbox"
              checked={brandEnabled}
              onChange={(e) => {
                const next = e.target.checked;
                setBrandEnabled(next);
                handleSaveBrand(next, brandContent, brandPosition);
              }}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-950 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[12px] after:left-[4px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-blue-600 peer-checked:to-purple-600 border border-slate-800"></div>
          </label>
        </div>

        <div className="space-y-3 pt-1">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-slate-300">Tag Text</label>
              <span className={`text-[11px] font-mono ${brandContent.length > 30 ? 'text-rose-400' : 'text-slate-500'}`}>
                {brandContent.length}/30
              </span>
            </div>
            <input
              type="text"
              maxLength={30}
              value={brandContent}
              onChange={(e) => {
                const val = e.target.value.slice(0, 30);
                setBrandContent(val);
                handleSaveBrand(brandEnabled, val, brandPosition);
              }}
              placeholder="@yourchannel or JTec"
              className="w-full h-9 px-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Position on Video</label>
            <select
              value={brandPosition}
              onChange={(e) => {
                const pos = e.target.value as BrandPosition;
                setBrandPosition(pos);
                handleSaveBrand(brandEnabled, brandContent, pos);
              }}
              className="w-full h-9 px-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-purple-500"
            >
              <option value="bottom_center">Bottom Center</option>
              <option value="bottom_left">Bottom Left</option>
              <option value="bottom_right">Bottom Right</option>
              <option value="top_center">Top Center</option>
            </select>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/80">
            <span>When active, included on every video render.</span>
            {savedBadge && (
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <Check className="w-3 h-3" />
                <span>Saved</span>
              </span>
            )}
          </div>
        </div>
      </div>

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
          Preferences placeholder section. No other options configured yet.
        </p>
      </div>
    </div>
  );
};
