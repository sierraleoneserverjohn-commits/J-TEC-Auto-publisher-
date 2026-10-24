import React from 'react';
import { Film, UploadCloud, Settings } from 'lucide-react';

export type TabType = 'library' | 'upload' | 'settings';

interface BottomNavProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onSelectTab }) => {
  const tabs = [
    { id: 'library' as TabType, label: 'Library', icon: Film },
    { id: 'upload' as TabType, label: 'Upload', icon: UploadCloud },
    { id: 'settings' as TabType, label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800">
      <div className="max-w-md mx-auto grid grid-cols-3 h-16 px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className="flex flex-col items-center justify-center min-h-[48px] py-1 transition-colors relative"
              aria-label={tab.label}
            >
              <div
                className={`flex items-center justify-center w-10 h-8 rounded-full transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-blue-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.2]' : 'stroke-[1.8]'}`} />
              </div>
              <span
                className={`text-[11px] font-medium tracking-tight mt-0.5 ${
                  isActive ? 'text-blue-400 font-semibold' : 'text-slate-400'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
