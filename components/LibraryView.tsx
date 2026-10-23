'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Grid,
  List,
  AlignJustify,
  ArrowUpDown,
  Star,
  X,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { VaultFile, FilterState } from '@/lib/types';
import { FileCard } from './FileCard';

interface LibraryViewProps {
  files: VaultFile[];
  taxonomy: {
    exams: string[];
    subjects: string[];
    topics: string[];
    years: number[];
    tags: string[];
  };
  initialSubjectFilter?: string;
  initialExamFilter?: string;
  initialSearchQuery?: string;
  onOpenFile: (file: VaultFile) => void;
  onViewDetails: (file: VaultFile) => void;
  onToggleFavorite: (id: string) => void;
}

export function LibraryView({
  files,
  taxonomy,
  initialSubjectFilter = 'all',
  initialExamFilter = 'all',
  initialSearchQuery = '',
  onOpenFile,
  onViewDetails,
  onToggleFavorite,
}: LibraryViewProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'compact'>('grid');
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [formatFilter, setFormatFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState(initialSubjectFilter);
  const [examFilter, setExamFilter] = useState(initialExamFilter);
  const [yearFilter, setYearFilter] = useState('all');
  const [topicFilter, setTopicFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [sortBy, setSortBy] = useState<FilterState['sortBy']>('modified_desc');

  // Filter and sort files
  const filteredFiles = useMemo(() => {
    let result = [...files];

    // Search query across name, subject, topic, exam, tags, description
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.subject?.toLowerCase().includes(q) ||
          f.topic?.toLowerCase().includes(q) ||
          f.exam?.toLowerCase().includes(q) ||
          f.description?.toLowerCase().includes(q) ||
          f.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Format filter
    if (formatFilter !== 'all') {
      if (formatFilter === 'pdf') {
        result = result.filter((f) => f.extension === 'pdf');
      } else if (formatFilter === 'sdocx') {
        result = result.filter((f) => f.extension === 'sdocx');
      } else if (formatFilter === 'docx') {
        result = result.filter((f) => f.extension === 'docx' || f.extension === 'doc');
      } else if (formatFilter === 'other') {
        result = result.filter((f) => !['pdf', 'sdocx', 'docx', 'doc'].includes(f.extension));
      }
    }

    // Subject filter
    if (subjectFilter !== 'all') {
      result = result.filter((f) => f.subject === subjectFilter);
    }

    // Exam filter
    if (examFilter !== 'all') {
      result = result.filter((f) => f.exam === examFilter);
    }

    // Year filter
    if (yearFilter !== 'all') {
      const y = parseInt(yearFilter, 10);
      result = result.filter((f) => f.year === y);
    }

    // Topic filter
    if (topicFilter !== 'all') {
      result = result.filter((f) => f.topic === topicFilter);
    }

    // Tag filter
    if (tagFilter !== 'all') {
      result = result.filter((f) => f.tags?.includes(tagFilter));
    }

    // Starred filter
    if (onlyFavorites) {
      result = result.filter((f) => f.isFavorite);
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'modified_desc') {
        return new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime();
      }
      if (sortBy === 'modified_asc') {
        return new Date(a.modifiedTime).getTime() - new Date(b.modifiedTime).getTime();
      }
      if (sortBy === 'name_asc') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'name_desc') {
        return b.name.localeCompare(a.name);
      }
      if (sortBy === 'size_desc') {
        return b.sizeBytes - a.sizeBytes;
      }
      if (sortBy === 'size_asc') {
        return a.sizeBytes - b.sizeBytes;
      }
      return 0;
    });

    return result;
  }, [
    files,
    searchQuery,
    formatFilter,
    subjectFilter,
    examFilter,
    yearFilter,
    topicFilter,
    tagFilter,
    onlyFavorites,
    sortBy,
  ]);

  const hasActiveFilters =
    searchQuery ||
    formatFilter !== 'all' ||
    subjectFilter !== 'all' ||
    examFilter !== 'all' ||
    yearFilter !== 'all' ||
    topicFilter !== 'all' ||
    tagFilter !== 'all' ||
    onlyFavorites;

  const handleResetFilters = () => {
    setSearchQuery('');
    setFormatFilter('all');
    setSubjectFilter('all');
    setExamFilter('all');
    setYearFilter('all');
    setTopicFilter('all');
    setTagFilter('all');
    setOnlyFavorites(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Title & Filter Toolbar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Study Notes Library
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Showing <span className="font-mono tabular-nums font-semibold text-zinc-800 dark:text-zinc-200">{filteredFiles.length}</span> of{' '}
              <span className="font-mono tabular-nums">{files.length}</span> indexed documents
            </p>
          </div>

          {/* View Mode & Sort Dropdowns */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* View Mode Toggle: Interactive segmented buttons */}
            <div className="flex items-center p-0.5 bg-zinc-100 dark:bg-zinc-800/80 rounded-lg border border-zinc-200/80 dark:border-zinc-700/80">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-medium'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
                title="Grid cards view"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-medium'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
                title="List view"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('compact')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'compact'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-xs font-medium'
                    : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
                title="Compact table rows"
              >
                <AlignJustify className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/80 rounded-lg text-xs text-zinc-600 dark:text-zinc-300">
              <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as FilterState['sortBy'])}
                className="bg-transparent focus:outline-none text-zinc-800 dark:text-zinc-200 cursor-pointer text-xs"
              >
                <option value="modified_desc">Recently Modified</option>
                <option value="modified_asc">Oldest First</option>
                <option value="name_asc">Name (A-Z)</option>
                <option value="name_desc">Name (Z-A)</option>
                <option value="size_desc">File Size (Largest)</option>
                <option value="size_asc">File Size (Smallest)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="space-y-2.5">
          {/* Format Tabs (Interactive segmented buttons with click handlers) */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {[
              { id: 'all', label: 'All Formats' },
              { id: 'pdf', label: 'PDFs' },
              { id: 'sdocx', label: 'Samsung Notes (.sdocx)' },
              { id: 'docx', label: 'DOCX' },
              { id: 'other', label: 'Other' },
            ].map((fmt) => (
              <button
                key={fmt.id}
                onClick={() => setFormatFilter(fmt.id)}
                className={`px-3 py-1.5 rounded-md transition-colors font-medium whitespace-nowrap shrink-0 ${
                  formatFilter === fmt.id
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {fmt.label}
              </button>
            ))}

            <button
              onClick={() => setOnlyFavorites(!onlyFavorites)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                onlyFavorites
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800'
                  : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${onlyFavorites ? 'fill-amber-400' : ''}`} />
              <span>Starred</span>
            </button>
          </div>

          {/* Secondary Filter Dropdowns: Subject, Exam, Year */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search within current selection..."
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400"
              />
            </div>

            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none cursor-pointer"
            >
              <option value="all">All Subjects</option>
              {taxonomy.subjects.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>

            <select
              value={examFilter}
              onChange={(e) => setExamFilter(e.target.value)}
              aria-label="Filter by exam"
              className="px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none cursor-pointer"
            >
              <option value="all">All Exams</option>
              {taxonomy.exams.map((ex) => (
                <option key={ex} value={ex}>
                  {ex}
                </option>
              ))}
            </select>

            {taxonomy.years.length > 0 && (
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                aria-label="Filter by year"
                className="px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none cursor-pointer"
              >
                <option value="all">All Years</option>
                {taxonomy.years.map((yr) => (
                  <option key={yr} value={String(yr)}>
                    {yr}
                  </option>
                ))}
              </select>
            )}

            {taxonomy.topics.length > 1 && (
              <select
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
                aria-label="Filter by topic"
                className="px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none cursor-pointer"
              >
                <option value="all">All Topics</option>
                {taxonomy.topics.map((tp) => (
                  <option key={tp} value={tp}>
                    {tp}
                  </option>
                ))}
              </select>
            )}

            {taxonomy.tags.length > 1 && (
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                aria-label="Filter by tag"
                className="px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none cursor-pointer"
              >
                <option value="all">All Tags</option>
                {taxonomy.tags.map((tg) => (
                  <option key={tg} value={tg}>
                    {tg}
                  </option>
                ))}
              </select>
            )}

            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:underline"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset filters</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Document List / Grid */}
      {files.length === 0 ? (
        <div className="py-20 text-center space-y-3 bg-zinc-50 dark:bg-zinc-900/30 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-6">
          <FileText className="w-10 h-10 mx-auto text-zinc-400" />
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
              No Notes in Vault Yet
            </h3>
            <p className="text-xs text-zinc-500">
              Connect your Google Drive from the top bar to scan and index all your personal PDFs, study notes, and Samsung Notes (`.sdocx`).
            </p>
          </div>
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="py-20 text-center space-y-3 bg-zinc-50 dark:bg-zinc-900/30 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800">
          <FileText className="w-8 h-8 mx-auto text-zinc-400" />
          <div className="space-y-1">
            <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
              No documents matched your criteria
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Try broadening your keyword, resetting active exam or subject filters, or clearing the search.
            </p>
          </div>
          <button
            onClick={handleResetFilters}
            className="px-4 py-2 text-xs font-medium rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
          >
            Clear all filters
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFiles.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              viewMode="grid"
              onOpen={onOpenFile}
              onViewDetails={onViewDetails}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-2.5">
          {filteredFiles.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              viewMode="list"
              onOpen={onOpenFile}
              onViewDetails={onViewDetails}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-zinc-50 dark:bg-zinc-950/40 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-medium text-zinc-500">
            <span className="w-14">Format</span>
            <span className="flex-1">Title</span>
            <span className="hidden sm:inline w-28">Subject</span>
            <span className="hidden md:inline w-28">Exam</span>
            <span className="w-16 text-right font-mono">Size</span>
            <span className="w-8"></span>
          </div>
          <div>
            {filteredFiles.map((file) => (
              <FileCard
                key={file.id}
                file={file}
                viewMode="compact"
                onOpen={onOpenFile}
                onViewDetails={onViewDetails}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
