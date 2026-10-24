import React from 'react';
import { PlaySquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Header: React.FC = () => {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 h-14 flex items-center justify-between gap-4">
      {/* Brand */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white shadow-sm">
          <PlaySquare className="w-4 h-4" />
        </div>
        <span className="text-sm font-semibold tracking-tight text-slate-100 whitespace-nowrap">
          JTec AutoPublisher
        </span>
      </div>

      {/* User Info / State */}
      {user && (
        <div className="text-xs text-slate-400 truncate max-w-[180px]">
          <span className="text-slate-300 font-medium">{user.email}</span>
        </div>
      )}
    </header>
  );
};
