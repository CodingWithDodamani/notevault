'use client';

import React from 'react';
import { LayoutGrid, BookOpen, Search, Star, Sparkles } from 'lucide-react';

interface MobileNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenSearch: () => void;
  onOpenAi: () => void;
  favoritesCount: number;
}

export function MobileNav({
  activeTab,
  setActiveTab,
  onOpenSearch,
  onOpenAi,
  favoritesCount,
}: MobileNavProps) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 transition-colors">
      <div className="grid grid-cols-5 items-center h-14 max-w-md mx-auto px-1">
        <button
          onClick={() => setActiveTab('home')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors ${
            activeTab === 'home'
              ? 'text-zinc-900 dark:text-zinc-100 font-medium'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          <span className="text-[10px] tracking-tight mt-0.5">Home</span>
        </button>

        <button
          onClick={() => setActiveTab('library')}
          className={`flex flex-col items-center justify-center h-full min-h-[44px] transition-colors ${
            activeTab === 'library'
              ? 'text-zinc-900 dark:text-zinc-100 font-medium'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span className="text-[10px] tracking-tight mt-0.5">Library</span>
        </button>

        <button
          onClick={onOpenSearch}
          className="flex flex-col items-center justify-center h-full min-h-[44px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
        >
          <Search className="w-4 h-4" />
          <span className="text-[10px] tracking-tight mt-0.5">Search</span>
        </button>

        <button
          onClick={() => setActiveTab('favorites')}
          className={`relative flex flex-col items-center justify-center h-full min-h-[44px] transition-colors ${
            activeTab === 'favorites'
              ? 'text-zinc-900 dark:text-zinc-100 font-medium'
              : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
          }`}
        >
          <Star className="w-4 h-4" />
          <span className="text-[10px] tracking-tight mt-0.5">Starred</span>
          {favoritesCount > 0 && (
            <span className="absolute top-1.5 right-4 w-1.5 h-1.5 rounded-full bg-amber-500" />
          )}
        </button>

        <button
          onClick={onOpenAi}
          className="flex flex-col items-center justify-center h-full min-h-[44px] text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          <span className="text-[10px] tracking-tight mt-0.5">Study AI</span>
        </button>
      </div>
    </nav>
  );
}
