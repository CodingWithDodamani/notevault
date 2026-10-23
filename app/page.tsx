'use client';

import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { Navbar } from '@/components/Navbar';
import { MobileNav } from '@/components/MobileNav';
import { Dashboard } from '@/components/Dashboard';
import { LibraryView } from '@/components/LibraryView';
import { ExamsSubjectsView } from '@/components/ExamsSubjectsView';
import { PdfViewerModal } from '@/components/PdfViewerModal';
import { SamsungNoteModal } from '@/components/SamsungNoteModal';
import { FileDetailsModal } from '@/components/FileDetailsModal';
import { GeminiStudyTutor } from '@/components/GeminiStudyTutor';
import { ScienceScoutModal } from '@/components/ScienceScoutModal';
import { DriveSyncModal } from '@/components/DriveSyncModal';
import { GlobalSearchModal } from '@/components/GlobalSearchModal';
import { SettingsModal, ThemePreference } from '@/components/SettingsModal';
import { useVaultStore } from '@/lib/vault-store';
import { VaultFile } from '@/lib/types';
import { initAuth } from '@/lib/firebase';
import { restoreDriveSession } from '@/lib/drive-session';
import { ToastProvider } from '@/lib/use-toast';
import { Settings } from 'lucide-react';
import { Toast } from '@/components/Toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ConfigCheck } from '@/components/ConfigCheck';
import { AppUrlCheck } from '@/components/AppUrlCheck';

const THEME_CHANGE_EVENT = 'notevault-theme-change';

function subscribeTheme(callback: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  mql.addEventListener('change', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
    mql.removeEventListener('change', callback);
  };
}

function getThemePreferenceSnapshot(): ThemePreference {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem('notevault_theme');
  if (saved === 'dark' || saved === 'light' || saved === 'system') return saved;
  return 'system';
}

function getServerThemePreferenceSnapshot(): ThemePreference {
  return 'light';
}

function getThemeSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  const saved = localStorage.getItem('notevault_theme');
  if (saved === 'dark') return true;
  if (saved === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function getServerThemeSnapshot(): boolean {
  return false;
}

export default function Home() {
  const {
    files,
    stats,
    taxonomy,
    recentlyOpened,
    recentlyAdded,
    syncInfo,
    isLoaded,
    toggleFavorite,
    recordOpened,
    updateFileMetadata,
    addDriveFiles,
    clearVault,
    saveSyncInfo,
  } = useVaultStore();

  const isDarkMode = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);
  const themePreference = useSyncExternalStore(
    subscribeTheme,
    getThemePreferenceSnapshot,
    getServerThemePreferenceSnapshot
  );

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  }, [isDarkMode]);

  const handleSetThemePreference = (pref: ThemePreference) => {
    localStorage.setItem('notevault_theme', pref);
    const shouldBeDark =
      pref === 'dark' ||
      (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const root = document.documentElement;
    if (shouldBeDark) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  };

  const handleToggleTheme = (val: boolean) => {
    handleSetThemePreference(val ? 'dark' : 'light');
  };

  const [activeTab, setActiveTab] = useState<'home' | 'library' | 'exams' | 'favorites' | 'science'>('home');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('all');
  const [selectedExamFilter, setSelectedExamFilter] = useState('all');

  // Modals state
  const [activePdfFile, setActivePdfFile] = useState<VaultFile | null>(null);
  const [activeSamsungNote, setActiveSamsungNote] = useState<VaultFile | null>(null);
  const [activeDetailsFile, setActiveDetailsFile] = useState<VaultFile | null>(null);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [activeAiDoc, setActiveAiDoc] = useState<VaultFile | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const [isScienceOpen, setIsScienceOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Initialize Google Auth state listener
  useEffect(() => {
    const unsub = initAuth(
      (user, token) => {
        saveSyncInfo((prev) => ({
          ...prev,
          isConnected: true,
          userEmail: user.email,
          userName: user.displayName,
          isSyncing: false,
        }));
        void token;
      },
      () => {
        // The Firebase session survived but the in-memory Google access token
        // did not. Try a silent restore from the server-held refresh token.
        void restoreDriveSession(saveSyncInfo);
      }
    );
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [saveSyncInfo]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        setIsSearchOpen(true);
      } else if (e.key === 'g' || e.key === 'G') {
        setActiveTab('library');
      } else if (e.key === 'f' || e.key === 'F') {
        setActiveTab('favorites');
      } else if (e.key === 'r' || e.key === 'R') {
        setIsSyncOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // File open dispatcher
  const handleOpenFile = (file: VaultFile) => {
    recordOpened(file.id);

    if (file.extension === 'sdocx') {
      setActiveSamsungNote(file);
    } else if (file.extension === 'pdf') {
      setActivePdfFile(file);
    } else {
      // DOCX, presentation, etc: open details modal with direct Drive link & preview
      setActiveDetailsFile(file);
    }
  };

  const handleAskAiAboutFile = (file: VaultFile) => {
    setActiveAiDoc(file);
    setActivePdfFile(null);
    setActiveSamsungNote(null);
    setIsAiOpen(true);
  };

  const handleSelectSubject = (subject: string) => {
    setSelectedSubjectFilter(subject);
    setSelectedExamFilter('all');
    setActiveTab('library');
  };

  const handleSelectExam = (exam: string) => {
    setSelectedExamFilter(exam);
    setSelectedSubjectFilter('all');
    setActiveTab('library');
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center text-xs text-zinc-500">
        <span className="font-mono">Loading NoteVault Cloud...</span>
      </div>
    );
  }

  return (
    <ToastProvider>
      <ErrorBoundary fallback={({ error, reset }) => (
        <div className="min-h-screen flex items-center justify-center p-4 text-center">
          <div className="max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl p-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Something went wrong</h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-4">{error.message}</p>
            <button onClick={reset} className="px-3 py-1.5 text-xs font-medium rounded bg-zinc-900 dark:bg-zinc-100 text-white hover:bg-zinc-800 dark:hover:bg-zinc-800">
              Try again
            </button>
          </div>
        </div>
      )}>
        <ConfigCheck />
        <Toast />
        <AppUrlCheck />
        <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 transition-colors flex flex-col font-sans">
      {/* Top Bar Contract (1 row, 3 zones) */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab: any) => {
          if (tab === 'science') {
            setIsScienceOpen(true);
          } else {
            setActiveTab(tab);
          }
        }}
        isDarkMode={isDarkMode}
        setIsDarkMode={handleToggleTheme}
        onOpenSync={() => setIsSyncOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenAi={() => {
          setActiveAiDoc(null);
          setIsAiOpen(true);
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isConnected={syncInfo.isConnected}
        userEmail={syncInfo.userEmail}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-20 md:pb-12">
        {activeTab === 'home' && (
          <Dashboard
            stats={stats}
            recentlyOpened={recentlyOpened}
            recentlyAdded={recentlyAdded}
            onOpenSearch={() => setIsSearchOpen(true)}
            onOpenSync={() => setIsSyncOpen(true)}
            onOpenAi={() => {
              setActiveAiDoc(null);
              setIsAiOpen(true);
            }}
            onOpenFile={handleOpenFile}
            onSelectSubject={handleSelectSubject}
            onSelectExam={handleSelectExam}
            onViewAllFiles={() => {
              setSelectedSubjectFilter('all');
              setSelectedExamFilter('all');
              setActiveTab('library');
            }}
          />
        )}

        {activeTab === 'library' && (
          <LibraryView
            files={files}
            taxonomy={taxonomy}
            initialSubjectFilter={selectedSubjectFilter}
            initialExamFilter={selectedExamFilter}
            onOpenFile={handleOpenFile}
            onViewDetails={(f) => setActiveDetailsFile(f)}
            onToggleFavorite={toggleFavorite}
          />
        )}

        {activeTab === 'exams' && (
          <ExamsSubjectsView
            files={files}
            onSelectExam={handleSelectExam}
            onSelectSubject={handleSelectSubject}
            onOpenFile={handleOpenFile}
          />
        )}

        {activeTab === 'favorites' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                Starred Notes ({stats.favoritesCount})
              </h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Quick-access bookmarks for critical formula sheets and revision materials.
              </p>
            </div>
            <LibraryView
              files={files.filter((f) => f.isFavorite)}
              taxonomy={taxonomy}
              onOpenFile={handleOpenFile}
              onViewDetails={(f) => setActiveDetailsFile(f)}
              onToggleFavorite={toggleFavorite}
            />
          </div>
        )}
      </main>

      {/* Mobile Ergonomic Thumb-Zone Bottom Tab Bar */}
      <MobileNav
        activeTab={activeTab}
        setActiveTab={(tab: any) => setActiveTab(tab)}
        onOpenSearch={() => setIsSearchOpen(true)}
        onOpenAi={() => {
          setActiveAiDoc(null);
          setIsAiOpen(true);
        }}
        favoritesCount={stats.favoritesCount}
      />

      {/* Floating Utilities (Settings trigger in bottom right on desktop) */}
      <div className="hidden md:flex fixed bottom-5 right-6 z-30 items-center gap-2">
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="p-2.5 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-md text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all"
          title="Settings & Privacy"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Modals & Drawers */}
      {activePdfFile && (
        <PdfViewerModal
          key={activePdfFile.id}
          file={activePdfFile}
          onClose={() => setActivePdfFile(null)}
          onRecordProgress={recordOpened}
          onToggleFavorite={toggleFavorite}
          onAskAi={handleAskAiAboutFile}
        />
      )}

      {activeSamsungNote && (
        <SamsungNoteModal
          key={activeSamsungNote.id}
          file={activeSamsungNote}
          onClose={() => setActiveSamsungNote(null)}
          onToggleFavorite={toggleFavorite}
          onAskAi={handleAskAiAboutFile}
          onRecordProgress={recordOpened}
        />
      )}

      {activeDetailsFile && (
        <FileDetailsModal
          key={activeDetailsFile.id}
          file={activeDetailsFile}
          onClose={() => setActiveDetailsFile(null)}
          onSave={updateFileMetadata}
          onToggleFavorite={toggleFavorite}
        />
      )}

      <GeminiStudyTutor
        isOpen={isAiOpen}
        onClose={() => {
          setIsAiOpen(false);
          setActiveAiDoc(null);
        }}
        activeDocument={activeAiDoc}
      />

      <ScienceScoutModal
        key={isScienceOpen ? 'science-open' : 'science-closed'}
        isOpen={isScienceOpen}
        onClose={() => setIsScienceOpen(false)}
        initialQuery="Hemoglobin"
      />

      <DriveSyncModal
        isOpen={isSyncOpen}
        onClose={() => setIsSyncOpen(false)}
        syncInfo={syncInfo}
        onUpdateSyncInfo={saveSyncInfo}
        onAddFiles={addDriveFiles}
        onClearVault={clearVault}
      />

      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        files={files}
        onSelectFile={handleOpenFile}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        syncInfo={syncInfo}
        files={files}
        isDarkMode={isDarkMode}
        themePreference={themePreference}
        setThemePreference={handleSetThemePreference}
        setIsDarkMode={handleToggleTheme}
        onResetVault={clearVault}
        onOpenSync={() => {
          setIsSettingsOpen(false);
          setIsSyncOpen(true);
        }}
      />
    </div>
    </ErrorBoundary>
    <ConfigCheck />
    <Toast />
    </ToastProvider>
  );
}
