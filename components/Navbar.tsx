'use client';

import React from 'react';
import {
  Cloud,
  Moon,
  Sun,
  Search,
  Sparkles,
  FolderSync,
  Settings,
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  onOpenSync: () => void;
  onOpenSearch: () => void;
  onOpenAi: () => void;
  onOpenSettings: () => void;
  isConnected: boolean;
  userEmail?: string | null;
}

export function Navbar({
  activeTab,
  setActiveTab,
  isDarkMode,
  setIsDarkMode,
  onOpenSync,
  onOpenSearch,
  onOpenAi,
  onOpenSettings,
  isConnected,
  userEmail,
}: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark (Single text element in display style) */}
        <button
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-2.5 text-left text-zinc-900 dark:text-zinc-50 whitespace-nowrap shrink-0 group focus:outline-none"
        >
          <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-zinc-900 transition-transform group-hover:scale-95">
            <Cloud className="w-4 h-4" />
          </div>
          <span className="text-base font-semibold tracking-tight">NoteVault Cloud</span>
        </button>

        {/* Zone 2: 4–5 clean single-line navigation links (desktop) */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          <button
            onClick={() => setActiveTab('home')}
            className={`whitespace-nowrap shrink-0 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors ${
              activeTab === 'home'
                ? 'text-zinc-900 dark:text-zinc-50 font-semibold underline underline-offset-8 decoration-zinc-900 dark:decoration-zinc-100'
                : ''
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('library')}
            className={`whitespace-nowrap shrink-0 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors ${
              activeTab === 'library'
                ? 'text-zinc-900 dark:text-zinc-50 font-semibold underline underline-offset-8 decoration-zinc-900 dark:decoration-zinc-100'
                : ''
            }`}
          >
            All Notes
          </button>
          <button
            onClick={() => setActiveTab('exams')}
            className={`whitespace-nowrap shrink-0 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors ${
              activeTab === 'exams'
                ? 'text-zinc-900 dark:text-zinc-50 font-semibold underline underline-offset-8 decoration-zinc-900 dark:decoration-zinc-100'
                : ''
            }`}
          >
            Exams & Subjects
          </button>
          <button
            onClick={onOpenAi}
            className="whitespace-nowrap shrink-0 flex items-center gap-1.5 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors text-zinc-800 dark:text-zinc-200"
          >
            <Sparkles className="w-3.5 h-3.5 text-zinc-700 dark:text-zinc-300" />
            <span>Study Tutor</span>
          </button>
          <button
            onClick={() => setActiveTab('science')}
            className={`whitespace-nowrap shrink-0 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors ${
              activeTab === 'science'
                ? 'text-zinc-900 dark:text-zinc-50 font-semibold underline underline-offset-8 decoration-zinc-900 dark:decoration-zinc-100'
                : ''
            }`}
          >
            Science Scout
          </button>
        </nav>

        {/* Zone 3: 1 primary action + compact utilities */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenSearch}
            className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 rounded-md border border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
            title="Search notes (/ key)"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Search notes...</span>
            <kbd className="hidden lg:inline text-[10px] font-mono px-1 rounded bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
              /
            </kbd>
          </button>

          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            aria-label="Toggle theme"
            title={isDarkMode ? 'Switch to Light Monochrome' : 'Switch to Dark Slate'}
            className="w-8 h-8 flex items-center justify-center rounded-md text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 transition-colors"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={onOpenSettings}
            aria-label="Settings & Theme"
            title="Appearance & Settings"
            className="w-8 h-8 flex items-center justify-center rounded-md text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenSync}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white dark:text-zinc-900 bg-zinc-900 dark:bg-zinc-100 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors whitespace-nowrap shrink-0 shadow-xs"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-400'
              }`}
            />
            <FolderSync className="w-3.5 h-3.5" />
            <span>{isConnected ? 'Sync Drive' : 'Connect Drive'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
