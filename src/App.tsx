/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { BottomNav, TabType } from './components/BottomNav';
import { WarningBanner } from './components/WarningBanner';
import { AuthPage } from './pages/AuthPage';
import { LibraryPage } from './pages/LibraryPage';
import { UploadPage } from './pages/UploadPage';
import { SettingsPage } from './pages/SettingsPage';
import { VideoPreviewModal } from './components/VideoPreviewModal';
import { VideoItem } from './types';
import { RefreshCw } from 'lucide-react';

function AppContent() {
  const { user, loading, authRequired } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('library');
  const [previewVideo, setPreviewVideo] = useState<VideoItem | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 gap-3">
        <RefreshCw className="w-7 h-7 animate-spin text-blue-500" />
        <span className="text-xs font-medium tracking-wide">Loading JTec AutoPublisher...</span>
      </div>
    );
  }

  // If AUTH_REQUIRED is explicitly turned on and user is not signed in, display auth gate
  if (authRequired && !user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <WarningBanner />
        <AuthPage />
      </div>
    );
  }

  // App ALWAYS opens directly: Header, WarningBanner (if unconfigured), Active Tab, and BottomNav
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header />
      <WarningBanner />

      <main className="flex-1 overflow-y-auto">
        {activeTab === 'library' && (
          <LibraryPage
            onSelectVideoForPreview={(video) => setPreviewVideo(video)}
            onGoToUpload={() => setActiveTab('upload')}
          />
        )}
        {activeTab === 'upload' && (
          <UploadPage
            onUploadSuccess={() => {}}
            onGoToLibrary={() => setActiveTab('library')}
          />
        )}
        {activeTab === 'settings' && <SettingsPage />}
      </main>

      <BottomNav activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* Video Preview Modal */}
      {previewVideo && (
        <VideoPreviewModal
          video={previewVideo}
          onClose={() => setPreviewVideo(null)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
